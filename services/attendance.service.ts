import { prisma } from '@/lib/prisma';
import { verifyStaffDevice, DeviceVerificationResult } from './verification.service';
import { isWithinGeofence } from '@/lib/geolocation';
import {
  AttendanceType,
  AttendanceVerificationStatus,
  AttendanceSource,
  CorrectionRequestType,
  CorrectionRequestStatus,
  DeviceStatus,
} from '@prisma/client';
import { recordAuditLog } from './audit.service';
import { calculateStaffDaySchedule } from './roster.service';
import { sendEmail } from './email.service';
import { MAX_DAILY_ATTENDANCE_CYCLES } from '@/lib/config';

export function calculateAttendanceTimeMetrics(params: {
  type: AttendanceType;
  punchTime: Date;
  scheduledStartTimeStr?: string | null;
  scheduledEndTimeStr?: string | null;
  shiftName?: string | null;
}) {
  const { type, punchTime, scheduledStartTimeStr, scheduledEndTimeStr, shiftName } = params;

  if (!scheduledStartTimeStr || !scheduledEndTimeStr) {
    return {
      scheduledShiftName: shiftName || null,
      scheduledStartTime: scheduledStartTimeStr || null,
      scheduledEndTime: scheduledEndTimeStr || null,
      attendanceStartTime: punchTime,
      lateMinutes: 0,
      earlyDepartureMinutes: 0,
    };
  }

  const [startH, startM] = scheduledStartTimeStr.split(':').map(Number);
  const [endH, endM] = scheduledEndTimeStr.split(':').map(Number);

  const scheduledStart = new Date(punchTime);
  scheduledStart.setHours(startH, startM, 0, 0);

  const scheduledEnd = new Date(punchTime);
  scheduledEnd.setHours(endH, endM, 0, 0);
  if (scheduledEnd.getTime() < scheduledStart.getTime()) {
    scheduledEnd.setDate(scheduledEnd.getDate() + 1);
  }

  let attendanceStartTime: Date = punchTime;
  let lateMinutes = 0;
  let earlyDepartureMinutes = 0;

  if (type === 'CLOCK_IN') {
    if (punchTime.getTime() <= scheduledStart.getTime()) {
      attendanceStartTime = scheduledStart;
      lateMinutes = 0;
    } else {
      attendanceStartTime = punchTime;
      const diffMs = punchTime.getTime() - scheduledStart.getTime();
      lateMinutes = Math.floor(diffMs / (1000 * 60));
    }
  } else if (type === 'CLOCK_OUT') {
    if (punchTime.getTime() < scheduledEnd.getTime()) {
      const diffMs = scheduledEnd.getTime() - punchTime.getTime();
      earlyDepartureMinutes = Math.floor(diffMs / (1000 * 60));
    } else {
      earlyDepartureMinutes = 0;
    }
  }

  return {
    scheduledShiftName: shiftName || null,
    scheduledStartTime: scheduledStartTimeStr,
    scheduledEndTime: scheduledEndTimeStr,
    attendanceStartTime,
    lateMinutes,
    earlyDepartureMinutes,
  };
}
import {
  templateCorrectionRequestSubmitted,
  templateCorrectionApproved,
  templateCorrectionRejected,
  templateAdminManualAttendanceCreated,
} from './email-templates';

export interface LocationInput {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface LayerStatus {
  isVerified: boolean;
  title: string;
  message: string;
  status: 'SUCCESS' | 'FAILED' | 'WARNING';
}

export interface ThreeLayerEvaluationResult {
  isReady: boolean;
  layer1Device: LayerStatus & { deviceStatus: DeviceStatus; label?: string | null };
  layer2Network: LayerStatus & { branchId?: string; branchName?: string; requestIp: string };
  layer3Geofence: LayerStatus & {
    distanceMeters?: number;
    allowedRadiusMeters?: number;
    accuracyMeters?: number;
  };
  candidateBranch?: {
    id: string;
    name: string;
    latitude: number | null;
    longitude: number | null;
    geofenceRadiusMeters: number;
    publicIp: string | null;
  } | null;
  failureReasons: string[];
}

/**
 * Perform server-side Three-Layer Attendance Verification (Section 1, 2, 12-26)
 */
export async function evaluateThreeLayerAttendance(
  staffProfileId: string,
  organizationId: string,
  requestIp: string,
  rawDeviceSecret?: string | null,
  coordinates?: LocationInput | null
): Promise<ThreeLayerEvaluationResult> {
  const failureReasons: string[] = [];
  const cleanIp = requestIp.trim();

  // ---------------------------------------------------------------------------
  // 1. LAYER 1: REGISTERED DEVICE VERIFICATION
  // ---------------------------------------------------------------------------
  const deviceCheck = await verifyStaffDevice(staffProfileId, rawDeviceSecret || '');
  let layer1: LayerStatus & { deviceStatus: DeviceStatus; label?: string | null };

  if (deviceCheck.isVerified) {
    layer1 = {
      isVerified: true,
      status: 'SUCCESS',
      title: 'Registered Device',
      message: 'This browser/device is registered to your staff account.',
      deviceStatus: 'REGISTERED',
      label: deviceCheck.deviceLabel,
    };
  } else {
    failureReasons.push(deviceCheck.failureReason || 'Device verification failed.');
    let msg = 'Current browser is not registered to this staff account.';
    if (deviceCheck.deviceStatus === 'RESET_REQUIRED') {
      msg = 'Device registration was reset by administrator. Please re-register your device.';
    }

    layer1 = {
      isVerified: false,
      status: 'FAILED',
      title: 'Registered Device',
      message: msg,
      deviceStatus: deviceCheck.deviceStatus,
      label: deviceCheck.deviceLabel,
    };
  }

  // ---------------------------------------------------------------------------
  // 2. LAYER 2: BRANCH NETWORK / PUBLIC IP VERIFICATION
  // ---------------------------------------------------------------------------
  // Fetch active branches assigned to this staff member
  const staffProfile = await prisma.staffProfile.findUnique({
    where: { id: staffProfileId },
    include: {
      branchAssignments: {
        include: {
          branch: {
            include: {
              networkIdentities: {
                where: { isActive: true },
              },
            },
          },
        },
      },
    },
  });

  const allAssignedBranches =
    staffProfile?.branchAssignments
      .map((ba) => ba.branch)
      .filter((b) => b.organizationId === organizationId) || [];

  const assignedActiveBranches = allAssignedBranches.filter((b) => b.status === 'ACTIVE');
  const hasInactiveBranchAssignment = allAssignedBranches.some((b) => b.status === 'INACTIVE');

  // Match current request IP against assigned active branches (IPv4 and IPv6 support)
  const matchingBranches = assignedActiveBranches.filter((branch) => {
    const mainMatch = Boolean(branch.publicIp && branch.publicIp.trim() === cleanIp);
    const identityMatch = branch.networkIdentities.some(
      (n) => n.isActive && n.publicIp.trim() === cleanIp
    );
    return mainMatch || identityMatch;
  });

  let candidateBranch: typeof assignedActiveBranches[0] | null = null;
  let layer2: LayerStatus & { branchId?: string; branchName?: string; requestIp: string };

  if (matchingBranches.length === 0) {
    const message =
      assignedActiveBranches.length === 0 && hasInactiveBranchAssignment
        ? 'This branch is currently inactive. Attendance is unavailable.'
        : 'Your current network is not an approved branch network.';

    failureReasons.push(message);
    layer2 = {
      isVerified: false,
      status: 'FAILED',
      title: 'Branch Network',
      message,
      requestIp: cleanIp,
    };
  } else if (matchingBranches.length === 1) {
    candidateBranch = matchingBranches[0];
    layer2 = {
      isVerified: true,
      status: 'SUCCESS',
      title: 'Branch Network',
      message: `Connected to ${candidateBranch.name} network.`,
      branchId: candidateBranch.id,
      branchName: candidateBranch.name,
      requestIp: cleanIp,
    };
  } else {
    // Multiple matching branches (Section 16)
    if (
      coordinates &&
      coordinates.latitude !== undefined &&
      coordinates.longitude !== undefined
    ) {
      // Find closest assigned branch
      let closestBranch = matchingBranches[0];
      let minDistance = Infinity;
      for (const b of matchingBranches) {
        if (b.latitude !== null && b.longitude !== null) {
          const d = isWithinGeofence(
            coordinates.latitude,
            coordinates.longitude,
            b.latitude,
            b.longitude,
            b.geofenceRadiusMeters,
            coordinates.accuracy
          ).distanceMeters;
          if (d < minDistance) {
            minDistance = d;
            closestBranch = b;
          }
        }
      }
      candidateBranch = closestBranch;
    } else {
      candidateBranch = matchingBranches[0];
    }

    layer2 = {
      isVerified: true,
      status: 'SUCCESS',
      title: 'Branch Network',
      message: `Connected to ${candidateBranch.name} network.`,
      branchId: candidateBranch.id,
      branchName: candidateBranch.name,
      requestIp: cleanIp,
    };
  }

  // ---------------------------------------------------------------------------
  // 3. LAYER 3: GEOFENCE / PHYSICAL LOCATION VERIFICATION
  // ---------------------------------------------------------------------------
  let targetBranch = candidateBranch;

  // If physical GPS coordinates are provided, determine the assigned active branch physically closest to the staff member
  if (coordinates && coordinates.latitude !== undefined && coordinates.longitude !== undefined && assignedActiveBranches.length > 0) {
    let closestWithGps: typeof assignedActiveBranches[0] | null = null;
    let minDistance = Infinity;

    for (const b of assignedActiveBranches) {
      if (b.latitude !== null && b.longitude !== null) {
        const geoResult = isWithinGeofence(
          coordinates.latitude,
          coordinates.longitude,
          b.latitude,
          b.longitude,
          b.geofenceRadiusMeters,
          coordinates.accuracy
        );
        if (geoResult.distanceMeters < minDistance) {
          minDistance = geoResult.distanceMeters;
          closestWithGps = b;
        }
      }
    }

    if (closestWithGps) {
      targetBranch = closestWithGps;
    }
  }

  if (!targetBranch && assignedActiveBranches.length > 0) {
    targetBranch = assignedActiveBranches.find((b) => b.latitude !== null && b.longitude !== null) || assignedActiveBranches[0];
  }

  let layer3: LayerStatus & {
    distanceMeters?: number;
    allowedRadiusMeters?: number;
    accuracyMeters?: number;
  };

  if (!targetBranch) {
    layer3 = {
      isVerified: false,
      status: 'FAILED',
      title: 'Location Geofence',
      message: 'No active branch assigned to verify location perimeter.',
    };
  } else if (targetBranch.latitude === null || targetBranch.longitude === null) {
    failureReasons.push(`${targetBranch.name} location coordinates have not been configured.`);
    layer3 = {
      isVerified: false,
      status: 'FAILED',
      title: 'Location Geofence',
      message: `${targetBranch.name} GPS perimeter is not configured.`,
      branchId: targetBranch.id,
    } as any;
  } else if (!coordinates || coordinates.latitude === undefined || coordinates.longitude === undefined) {
    failureReasons.push('Location permission is required to verify attendance.');
    layer3 = {
      isVerified: false,
      status: 'FAILED',
      title: 'Location Geofence',
      message: 'Location permission is required to verify attendance.',
    };
  } else {
    // Check accuracy threshold (Section 20)
    const accuracy = coordinates.accuracy || 0;
    const MAX_ACCURACY_THRESHOLD = 150000; // Supports desktop/Wi-Fi IP geolocation estimates (up to 150km)

    if (accuracy > MAX_ACCURACY_THRESHOLD) {
      failureReasons.push('Location accuracy is too low to verify your attendance. Move to an open area and try again.');
    }

    const geoCheck = isWithinGeofence(
      coordinates.latitude,
      coordinates.longitude,
      targetBranch.latitude,
      targetBranch.longitude,
      targetBranch.geofenceRadiusMeters,
      coordinates.accuracy
    );

    if (geoCheck.isWithin && accuracy <= MAX_ACCURACY_THRESHOLD) {
      layer3 = {
        isVerified: true,
        status: 'SUCCESS',
        title: 'Location Geofence',
        message: `Inside ${targetBranch.name} • ${geoCheck.distanceMeters}m from center.`,
        distanceMeters: geoCheck.distanceMeters,
        allowedRadiusMeters: targetBranch.geofenceRadiusMeters,
        accuracyMeters: accuracy,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      } as any;
    } else {
      const reason =
        accuracy > MAX_ACCURACY_THRESHOLD
          ? 'Location accuracy is too low to verify your attendance.'
          : `Outside geofence (${geoCheck.distanceMeters}m from branch; allowed radius: ${targetBranch.geofenceRadiusMeters}m).`;
      if (!failureReasons.includes(reason)) failureReasons.push(reason);

      layer3 = {
        isVerified: false,
        status: 'FAILED',
        title: 'Location Geofence',
        message: reason,
        distanceMeters: geoCheck.distanceMeters,
        allowedRadiusMeters: targetBranch.geofenceRadiusMeters,
        accuracyMeters: accuracy,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      } as any;
    }
  }

  const isReady = layer1.isVerified && layer2.isVerified && layer3.isVerified;

  return {
    isReady,
    layer1Device: layer1,
    layer2Network: layer2,
    layer3Geofence: layer3,
    candidateBranch: candidateBranch
      ? {
          id: candidateBranch.id,
          name: candidateBranch.name,
          latitude: candidateBranch.latitude,
          longitude: candidateBranch.longitude,
          geofenceRadiusMeters: candidateBranch.geofenceRadiusMeters,
          publicIp: candidateBranch.publicIp,
        }
      : null,
    failureReasons,
  };
}

/**
 * Record Clock In or Clock Out Attendance (Section 13, 14, 16, 18, 19, 25, 26, 27, 28, 29)
 */
export async function recordAttendance(params: {
  organizationId: string;
  staffProfileId: string;
  userId: string;
  type: AttendanceType;
  requestIp: string;
  rawDeviceSecret?: string | null;
  coordinates?: LocationInput | null;
  deviceLabel?: string | null;
  userAgent?: string | null;
}): Promise<{
  success: boolean;
  record?: any;
  error?: string;
  evaluation: ThreeLayerEvaluationResult;
}> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

  // 1. Fresh Server-side Three-Layer Evaluation
  const evaluation = await evaluateThreeLayerAttendance(
    params.staffProfileId,
    params.organizationId,
    params.requestIp,
    params.rawDeviceSecret,
    params.coordinates
  );

  // 2. Resolve Scheduled Shift for Today (Section 14, 15, 29)
  const staffAssignments = await prisma.shiftAssignment.findMany({
    where: { staffProfileId: params.staffProfileId },
    include: { shiftPattern: { include: { weeklyDays: true } } },
  });
  const staffOverrides = await prisma.staffShiftOverride.findMany({
    where: { staffProfileId: params.staffProfileId },
  });

  const daySchedule = calculateStaffDaySchedule(now, staffAssignments, staffOverrides);

  // Section 14 & 29: NO SCHEDULE = NO ATTENDANCE (Clock In & Clock Out blocked)
  if (!daySchedule.isScheduled || daySchedule.isHoliday) {
    return {
      success: false,
      error: 'You cannot clock in or clock out because no schedule is assigned for today.',
      evaluation,
    };
  }

  // 3. Strict Three-Layer Security Verification (Section 1, 13, 16, 25, 26, 27, 28)
  if (!evaluation.isReady) {
    let errorMessage = 'Attendance verification failed.';
    if (!evaluation.layer1Device.isVerified) {
      errorMessage =
        'This device is not registered for your account. Contact your administrator if you need to reset/register your device.';
    } else if (!evaluation.layer2Network.isVerified) {
      errorMessage = evaluation.layer2Network.message || 'Your current network is not the registered branch network.';
    } else if (!evaluation.layer3Geofence.isVerified) {
      if (evaluation.layer3Geofence.distanceMeters === null) {
        errorMessage =
          'Location permission is required to verify that you are within your assigned branch.';
      } else {
        errorMessage = `Outside branch geofence (${evaluation.layer3Geofence.distanceMeters} m from branch; allowed radius: ${evaluation.layer3Geofence.allowedRadiusMeters} m).`;
      }
    }

    return {
      success: false,
      error: errorMessage,
      evaluation,
    };
  }

  // 4. Daily Attendance Cycle Accounting (Section 17, 18, 19, 20, 21)
  const verifiedTodayRecords = await prisma.attendanceRecord.findMany({
    where: {
      staffProfileId: params.staffProfileId,
      verificationStatus: 'VERIFIED',
      timestamp: { gte: startOfDay },
    },
    orderBy: { timestamp: 'asc' },
  });

  const completedCyclesCount = verifiedTodayRecords.filter((r) => r.type === 'CLOCK_OUT').length;
  const lastVerifiedRecord =
    verifiedTodayRecords.length > 0 ? verifiedTodayRecords[verifiedTodayRecords.length - 1] : null;
  const isCurrentlyClockedIn = lastVerifiedRecord?.type === 'CLOCK_IN';

  if (params.type === 'CLOCK_IN') {
    if (isCurrentlyClockedIn) {
      return {
        success: false,
        error: 'Already clocked in.',
        evaluation,
      };
    }
    if (completedCyclesCount >= MAX_DAILY_ATTENDANCE_CYCLES) {
      return {
        success: false,
        error:
          MAX_DAILY_ATTENDANCE_CYCLES > 1
            ? "Today's maximum attendance cycles have been reached."
            : "Today's attendance has already been completed.",
        evaluation,
      };
    }
  } else if (params.type === 'CLOCK_OUT') {
    if (!isCurrentlyClockedIn) {
      return {
        success: false,
        error: 'You are not currently clocked in.',
        evaluation,
      };
    }
  }

  // 5. Calculate Time Metrics & Create Verified Attendance Record
  const metrics = calculateAttendanceTimeMetrics({
    type: params.type,
    punchTime: now,
    scheduledStartTimeStr: daySchedule.startTime,
    scheduledEndTimeStr: daySchedule.endTime,
    shiftName: daySchedule.shiftPatternName,
  });

  const record = await prisma.attendanceRecord.create({
    data: {
      organizationId: params.organizationId,
      staffProfileId: params.staffProfileId,
      branchId: evaluation.candidateBranch?.id || null,
      type: params.type,
      verificationStatus: 'VERIFIED',
      rejectionReason: null,
      source: 'NORMAL',

      scheduledShiftName: metrics.scheduledShiftName,
      scheduledStartTime: metrics.scheduledStartTime,
      scheduledEndTime: metrics.scheduledEndTime,
      attendanceStartTime: metrics.attendanceStartTime,
      lateMinutes: metrics.lateMinutes,
      earlyDepartureMinutes: metrics.earlyDepartureMinutes,

      deviceStatus: evaluation.layer1Device.deviceStatus,
      deviceMatched: evaluation.layer1Device.isVerified,
      deviceLabel: params.deviceLabel || evaluation.layer1Device.label || null,

      ipAddress: params.requestIp,
      ipMatched: evaluation.layer2Network.isVerified,

      latitude: params.coordinates?.latitude || null,
      longitude: params.coordinates?.longitude || null,
      locationAccuracy: params.coordinates?.accuracy || null,
      distanceMeters: evaluation.layer3Geofence.distanceMeters || null,
      geofenceRadiusMeters: evaluation.layer3Geofence.allowedRadiusMeters || null,
      geofenceMatched: evaluation.layer3Geofence.isVerified,

      timestamp: now,
    },
    include: {
      branch: true,
    },
  });

  // 6. Record Audit Log
  await recordAuditLog({
    organizationId: params.organizationId,
    actorUserId: params.userId,
    action: params.type === 'CLOCK_IN' ? 'ATTENDANCE_CLOCK_IN' : 'ATTENDANCE_CLOCK_OUT',
    entityType: 'AttendanceRecord',
    entityId: record.id,
    metadata: {
      type: params.type,
      isVerified: true,
      branchId: record.branchId,
      branchName: record.branch?.name,
      distanceMeters: record.distanceMeters,
      deviceMatched: record.deviceMatched,
      ipMatched: record.ipMatched,
      geofenceMatched: record.geofenceMatched,
    },
    ipAddress: params.requestIp,
    userAgent: params.userAgent || undefined,
  });

  return {
    success: true,
    record,
    evaluation,
  };
}

/**
 * Retrieve staff's current attendance state for today
 */
export async function getStaffTodayAttendanceStatus(staffProfileId: string) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

  const staffAssignments = await prisma.shiftAssignment.findMany({
    where: { staffProfileId },
    include: { shiftPattern: { include: { weeklyDays: true } } },
  });
  const staffOverrides = await prisma.staffShiftOverride.findMany({
    where: { staffProfileId },
  });

  const daySchedule = calculateStaffDaySchedule(now, staffAssignments, staffOverrides);

  const todayRecords = await prisma.attendanceRecord.findMany({
    where: {
      staffProfileId,
      timestamp: { gte: startOfDay },
    },
    orderBy: { timestamp: 'asc' },
    include: { branch: true },
  });

  const verifiedRecords = todayRecords.filter((r) => r.verificationStatus === 'VERIFIED');
  const completedCyclesCount = verifiedRecords.filter((r) => r.type === 'CLOCK_OUT').length;
  const lastVerified = verifiedRecords.length > 0 ? verifiedRecords[verifiedRecords.length - 1] : null;

  const isClockedIn = lastVerified?.type === 'CLOCK_IN';
  const lastClockIn = verifiedRecords.filter((r) => r.type === 'CLOCK_IN').pop();
  const lastClockOut = verifiedRecords.filter((r) => r.type === 'CLOCK_OUT').pop();
  const isDailyLimitReached = completedCyclesCount >= MAX_DAILY_ATTENDANCE_CYCLES;

  return {
    isClockedIn,
    completedCycles: completedCyclesCount,
    maxCycles: MAX_DAILY_ATTENDANCE_CYCLES,
    isDailyLimitReached,
    hasSchedule: Boolean(daySchedule.isScheduled && !daySchedule.isHoliday),
    schedule: daySchedule,
    lastClockInTime: lastClockIn?.timestamp || null,
    attendanceStartTime: lastClockIn?.attendanceStartTime || lastClockIn?.timestamp || null,
    lateMinutes: lastClockIn?.lateMinutes || 0,
    lastClockOutTime: lastClockOut?.timestamp || null,
    earlyDepartureMinutes: lastClockOut?.earlyDepartureMinutes || 0,
    currentBranch: lastVerified?.branch || null,
    todayRecords,
  };
}

/**
 * Retrieve monthly attendance summary and history
 */
export async function getStaffMonthlyAttendanceSummary(
  staffProfileId: string,
  year: number,
  month: number // 1-12
) {
  const startOfMonth = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  const records = await prisma.attendanceRecord.findMany({
    where: {
      staffProfileId,
      timestamp: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
    },
    orderBy: { timestamp: 'desc' },
    include: { branch: true },
  });

  const verified = records.filter((r) => r.verificationStatus === 'VERIFIED');
  const presentDaySet = new Set<string>();

  for (const r of verified) {
    if (r.type === 'CLOCK_IN') {
      presentDaySet.add(r.timestamp.toISOString().slice(0, 10));
    }
  }

  return {
    year,
    month,
    totalRecords: records.length,
    presentDaysCount: presentDaySet.size,
    records,
  };
}

// =============================================================================
// PHASE 7: MANUAL ATTENDANCE & ATTENDANCE CORRECTIONS
// =============================================================================

export function normalizeDate(dateInput: Date | string): Date {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : new Date(dateInput.getTime());
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

export function formatUtcDateString(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseTimeToDate(baseDate: Date, timeInput?: Date | string | null): Date | null {
  if (!timeInput) return null;
  if (timeInput instanceof Date) return timeInput;

  // Handle ISO string or "HH:MM"
  if (timeInput.includes('T') || timeInput.includes('Z')) {
    return new Date(timeInput);
  }

  const parts = timeInput.split(':');
  if (parts.length < 2) return null;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return null;

  const result = new Date(baseDate.getTime());
  result.setUTCHours(hours, minutes, 0, 0);
  return result;
}

/**
 * 1. Submit Attendance Correction Request (Staff) - Section 3, 4, 14, 15, 17, 18, 29
 */
export async function submitAttendanceCorrectionRequest(params: {
  organizationId: string;
  staffProfileId: string;
  userId: string;
  type: CorrectionRequestType;
  date: Date | string;
  requestedClockIn?: Date | string | null;
  requestedClockOut?: Date | string | null;
  reason: string;
  branchId?: string | null;
  originUrl?: string;
}) {
  const cleanReason = params.reason?.trim();
  if (!cleanReason || cleanReason.length < 3) {
    throw new Error('A valid reason is required for attendance correction requests.');
  }

  const targetDate = normalizeDate(params.date);
  const todayMidnight = normalizeDate(new Date());

  // Section 17: Disallow future dates
  if (targetDate > todayMidnight) {
    throw new Error('Attendance corrections cannot be requested for future dates.');
  }

  // Fetch organization and staff
  const [org, staff] = await Promise.all([
    prisma.organization.findUnique({ where: { id: params.organizationId } }),
    prisma.staffProfile.findFirst({
      where: {
        id: params.staffProfileId,
        organizationId: params.organizationId,
        user: { status: 'ACTIVE' },
      },
      include: {
        user: true,
        organization: true,
        branchAssignments: { include: { branch: true } },
      },
    }),
  ]);

  if (!org || !staff) {
    throw new Error('Organization or Staff profile not found.');
  }

  // Section 15: Configurable correction window
  const windowDays = org.attendanceCorrectionWindowDays || 5;
  const diffMs = todayMidnight.getTime() - targetDate.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  if (diffDays > windowDays) {
    throw new Error(`Attendance corrections can only be requested within ${windowDays} days.`);
  }

  // Parse requested times
  const parsedClockIn = parseTimeToDate(targetDate, params.requestedClockIn);
  const parsedClockOut = parseTimeToDate(targetDate, params.requestedClockOut);

  // Section 18: Time validation
  if (parsedClockIn && parsedClockOut && parsedClockOut <= parsedClockIn) {
    // Check if end is next day overnight or invalid
    throw new Error('Clock-out time cannot be earlier than or equal to clock-in time.');
  }

  // Section 14: Duplicate / conflicting pending request check
  const existingPending = await prisma.attendanceCorrectionRequest.findFirst({
    where: {
      organizationId: params.organizationId,
      staffProfileId: params.staffProfileId,
      date: targetDate,
      status: 'PENDING',
    },
  });

  if (existingPending) {
    throw new Error('There is already a pending correction for this attendance record.');
  }

  // Section 12: Snapshot existing attendance values
  const startOfDay = new Date(targetDate.getTime());
  const endOfDay = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000 - 1);

  const existingRecords = await prisma.attendanceRecord.findMany({
    where: {
      staffProfileId: params.staffProfileId,
      timestamp: { gte: startOfDay, lte: endOfDay },
      verificationStatus: 'VERIFIED',
    },
    orderBy: { timestamp: 'asc' },
  });

  const originalClockIn = existingRecords.find((r) => r.type === 'CLOCK_IN')?.timestamp || null;
  const originalClockOut = existingRecords.find((r) => r.type === 'CLOCK_OUT')?.timestamp || null;
  const targetRecordId = existingRecords[0]?.id || null;

  // Create correction request
  const correctionRequest = await prisma.attendanceCorrectionRequest.create({
    data: {
      organizationId: params.organizationId,
      staffProfileId: params.staffProfileId,
      branchId: params.branchId || staff.branchAssignments[0]?.branchId || null,
      attendanceRecordId: targetRecordId,
      type: params.type,
      date: targetDate,
      requestedClockIn: parsedClockIn,
      requestedClockOut: parsedClockOut,
      originalClockIn,
      originalClockOut,
      reason: cleanReason,
      status: 'PENDING',
      createdById: params.userId,
    },
  });

  // Audit log
  await recordAuditLog({
    organizationId: params.organizationId,
    actorUserId: params.userId,
    action: 'ATTENDANCE_CORRECTION_REQUESTED',
    entityType: 'AttendanceCorrectionRequest',
    entityId: correctionRequest.id,
    metadata: {
      staffProfileId: params.staffProfileId,
      type: params.type,
      date: formatUtcDateString(targetDate),
      requestedClockIn: parsedClockIn?.toISOString() || null,
      requestedClockOut: parsedClockOut?.toISOString() || null,
      reason: cleanReason,
    },
  });

  // Non-blocking Email to Org Admin
  try {
    const orgAdmin = await prisma.user.findFirst({
      where: {
        organizationId: params.organizationId,
        role: 'ORG_ADMIN',
        status: 'ACTIVE',
      },
    });

    if (orgAdmin?.email) {
      const reviewUrl = `${params.originUrl || 'https://shiftguard.app'}/${staff.organization.organizationCode}/admin/attendance/corrections/${correctionRequest.id}`;
      const payload = templateCorrectionRequestSubmitted({
        orgName: staff.organization.name,
        staffName: staff.name,
        staffId: staff.staffId,
        type: params.type.replace(/_/g, ' '),
        date: formatUtcDateString(targetDate),
        requestedTime: `${parsedClockIn ? parsedClockIn.toISOString().slice(11, 16) : '—'} to ${parsedClockOut ? parsedClockOut.toISOString().slice(11, 16) : '—'}`,
        reason: cleanReason,
        reviewUrl,
      });

      await sendEmail({
        organizationId: params.organizationId,
        recipient: orgAdmin.email,
        type: 'ATTENDANCE_CORRECTION_SUBMITTED',
        subject: payload.subject,
        htmlContent: payload.html,
        textContent: payload.text,
      });
    }
  } catch (emailErr) {
    console.error('Non-blocking correction request email delivery error:', emailErr);
  }

  return correctionRequest;
}

/**
 * 2. Approve Attendance Correction Request (Admin) - Section 10, 12, 13, 30, 40, 41
 */
export async function approveAttendanceCorrection(params: {
  organizationId: string;
  requestId: string;
  reviewerUserId: string;
  reviewerComment?: string;
  originUrl?: string;
}) {
  return await prisma.$transaction(
    async (tx) => {
      // 1. Fetch & lock correction request
      const request = await tx.attendanceCorrectionRequest.findUnique({
        where: { id: params.requestId },
        include: {
          staffProfile: {
            include: {
              user: true,
              organization: true,
              branchAssignments: { include: { branch: true } },
            },
          },
        },
      });

      if (!request || request.organizationId !== params.organizationId) {
        throw new Error('Attendance correction request not found.');
      }

      // Section 41: Race condition handling
      if (request.status !== 'PENDING') {
        throw new Error('This request has already been processed.');
      }

      const targetBranchId = request.branchId || request.staffProfile.branchAssignments[0]?.branchId || null;
      const targetDate = request.date;
      const startOfDay = new Date(targetDate.getTime());
      const endOfDay = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000 - 1);

      // 2. Find existing attendance records for the date
      const existingRecords = await tx.attendanceRecord.findMany({
        where: {
          staffProfileId: request.staffProfileId,
          timestamp: { gte: startOfDay, lte: endOfDay },
          verificationStatus: 'VERIFIED',
        },
        orderBy: { timestamp: 'asc' },
      });

      const existingClockIn = existingRecords.find((r) => r.type === 'CLOCK_IN');
      const existingClockOut = existingRecords.find((r) => r.type === 'CLOCK_OUT');

      let targetRecordId = existingClockIn?.id || existingClockOut?.id || null;

      // 3. Apply Clock In Correction if requested
      if (request.requestedClockIn) {
        if (existingClockIn) {
          await tx.attendanceRecord.update({
            where: { id: existingClockIn.id },
            data: {
              timestamp: request.requestedClockIn,
              source: 'ADJUSTED',
              correctionRequestId: request.id,
            },
          });
          targetRecordId = existingClockIn.id;
        } else {
          const newClockIn = await tx.attendanceRecord.create({
            data: {
              organizationId: params.organizationId,
              staffProfileId: request.staffProfileId,
              branchId: targetBranchId,
              type: 'CLOCK_IN',
              verificationStatus: 'VERIFIED',
              source: 'ADJUSTED',
              correctionRequestId: request.id,
              deviceStatus: 'REGISTERED',
              deviceMatched: true,
              ipAddress: '127.0.0.1',
              ipMatched: true,
              geofenceMatched: true,
              timestamp: request.requestedClockIn,
            },
          });
          targetRecordId = newClockIn.id;
        }
      }

      // 4. Apply Clock Out Correction if requested
      if (request.requestedClockOut) {
        if (existingClockOut) {
          await tx.attendanceRecord.update({
            where: { id: existingClockOut.id },
            data: {
              timestamp: request.requestedClockOut,
              source: 'ADJUSTED',
              correctionRequestId: request.id,
            },
          });
        } else {
          await tx.attendanceRecord.create({
            data: {
              organizationId: params.organizationId,
              staffProfileId: request.staffProfileId,
              branchId: targetBranchId,
              type: 'CLOCK_OUT',
              verificationStatus: 'VERIFIED',
              source: 'ADJUSTED',
              correctionRequestId: request.id,
              deviceStatus: 'REGISTERED',
              deviceMatched: true,
              ipAddress: '127.0.0.1',
              ipMatched: true,
              geofenceMatched: true,
              timestamp: request.requestedClockOut,
            },
          });
        }
      }

      // 5. Section 13: Create AttendanceAdjustmentAudit entry
      await tx.attendanceAdjustmentAudit.create({
        data: {
          organizationId: params.organizationId,
          staffProfileId: request.staffProfileId,
          attendanceRecordId: targetRecordId,
          requestId: request.id,
          previousClockIn: request.originalClockIn,
          previousClockOut: request.originalClockOut,
          newClockIn: request.requestedClockIn,
          newClockOut: request.requestedClockOut,
          reason: request.reason,
          requesterUserId: request.createdById,
          reviewerUserId: params.reviewerUserId,
          requestedAt: request.createdAt,
          reviewedAt: new Date(),
          action: 'CORRECTION_APPROVED',
        },
      });

      // 6. Update Correction Request status
      const updated = await tx.attendanceCorrectionRequest.update({
        where: { id: request.id },
        data: {
          status: 'APPROVED',
          reviewerUserId: params.reviewerUserId,
          reviewedAt: new Date(),
          reviewerComment: params.reviewerComment?.trim() || null,
        },
      });

      // 7. Record Audit Log
      await tx.auditLog.create({
        data: {
          organizationId: params.organizationId,
          actorUserId: params.reviewerUserId,
          action: 'ATTENDANCE_CORRECTION_APPROVED',
          entityType: 'AttendanceCorrectionRequest',
          entityId: updated.id,
          metadata: {
            staffProfileId: request.staffProfileId,
            date: formatUtcDateString(request.date),
            requestedClockIn: request.requestedClockIn?.toISOString() || null,
            requestedClockOut: request.requestedClockOut?.toISOString() || null,
            reviewerComment: params.reviewerComment || null,
          },
        },
      });

      // 8. Dispatch Staff Email Notification (Non-blocking)
      setTimeout(async () => {
        try {
          if (request.staffProfile.user.email) {
            const loginUrl = `${params.originUrl || 'https://shiftguard.app'}/${request.staffProfile.organization.organizationCode}/staff/attendance`;
            const payload = templateCorrectionApproved({
              orgName: request.staffProfile.organization.name,
              staffName: request.staffProfile.name,
              date: formatUtcDateString(request.date),
              type: request.type.replace(/_/g, ' '),
              approvedTime: `${request.requestedClockIn ? request.requestedClockIn.toISOString().slice(11, 16) : '—'} to ${request.requestedClockOut ? request.requestedClockOut.toISOString().slice(11, 16) : '—'}`,
              reviewerComment: params.reviewerComment || null,
              loginUrl,
            });

            await sendEmail({
              organizationId: params.organizationId,
              recipient: request.staffProfile.user.email,
              type: 'ATTENDANCE_CORRECTION_APPROVED',
              subject: payload.subject,
              htmlContent: payload.html,
              textContent: payload.text,
            });
          }
        } catch (err) {
          console.error('Non-blocking approval email error:', err);
        }
      }, 0);

      return updated;
    },
    { timeout: 30000, maxWait: 15000 }
  );
}

/**
 * 3. Reject Attendance Correction Request (Admin) - Section 11, 31
 */
export async function rejectAttendanceCorrection(params: {
  organizationId: string;
  requestId: string;
  reviewerUserId: string;
  rejectionReason: string;
  originUrl?: string;
}) {
  const cleanReason = params.rejectionReason?.trim();
  if (!cleanReason) {
    throw new Error('A rejection reason is required.');
  }

  const request = await prisma.attendanceCorrectionRequest.findUnique({
    where: { id: params.requestId },
    include: {
      staffProfile: {
        include: {
          user: true,
          organization: true,
        },
      },
    },
  });

  if (!request || request.organizationId !== params.organizationId) {
    throw new Error('Attendance correction request not found.');
  }

  if (request.status !== 'PENDING') {
    throw new Error('This request has already been processed.');
  }

  const updated = await prisma.attendanceCorrectionRequest.update({
    where: { id: request.id },
    data: {
      status: 'REJECTED',
      reviewerUserId: params.reviewerUserId,
      reviewedAt: new Date(),
      reviewerComment: cleanReason,
    },
  });

  // Create adjustment audit
  await prisma.attendanceAdjustmentAudit.create({
    data: {
      organizationId: params.organizationId,
      staffProfileId: request.staffProfileId,
      requestId: request.id,
      previousClockIn: request.originalClockIn,
      previousClockOut: request.originalClockOut,
      reason: cleanReason,
      requesterUserId: request.createdById,
      reviewerUserId: params.reviewerUserId,
      requestedAt: request.createdAt,
      reviewedAt: new Date(),
      action: 'CORRECTION_REJECTED',
    },
  });

  // Record Audit Log
  await prisma.auditLog.create({
    data: {
      organizationId: params.organizationId,
      actorUserId: params.reviewerUserId,
      action: 'ATTENDANCE_CORRECTION_REJECTED',
      entityType: 'AttendanceCorrectionRequest',
      entityId: updated.id,
      metadata: {
        staffProfileId: request.staffProfileId,
        date: formatUtcDateString(request.date),
        rejectionReason: cleanReason,
      },
    },
  });

  // Send rejection email (Non-blocking)
  try {
    if (request.staffProfile.user.email) {
      const loginUrl = `${params.originUrl || 'https://shiftguard.app'}/${request.staffProfile.organization.organizationCode}/login`;
      const payload = templateCorrectionRejected({
        orgName: request.staffProfile.organization.name,
        staffName: request.staffProfile.name,
        date: formatUtcDateString(request.date),
        type: request.type.replace(/_/g, ' '),
        rejectionReason: cleanReason,
        loginUrl,
      });

      await sendEmail({
        organizationId: params.organizationId,
        recipient: request.staffProfile.user.email,
        type: 'ATTENDANCE_CORRECTION_REJECTED',
        subject: payload.subject,
        htmlContent: payload.html,
        textContent: payload.text,
      });
    }
  } catch (err) {
    console.error('Non-blocking rejection email error:', err);
  }

  return updated;
}

/**
 * 4. Cancel Attendance Correction Request (Staff) - Section 7
 */
export async function cancelAttendanceCorrection(params: {
  organizationId: string;
  requestId: string;
  staffProfileId: string;
  userId: string;
}) {
  const request = await prisma.attendanceCorrectionRequest.findUnique({
    where: { id: params.requestId },
  });

  if (!request || request.organizationId !== params.organizationId || request.staffProfileId !== params.staffProfileId) {
    throw new Error('Attendance correction request not found.');
  }

  if (request.status !== 'PENDING') {
    throw new Error('Only pending correction requests can be cancelled.');
  }

  const updated = await prisma.attendanceCorrectionRequest.update({
    where: { id: request.id },
    data: { status: 'CANCELLED' },
  });

  await prisma.auditLog.create({
    data: {
      organizationId: params.organizationId,
      actorUserId: params.userId,
      action: 'ATTENDANCE_CORRECTION_CANCELLED',
      entityType: 'AttendanceCorrectionRequest',
      entityId: updated.id,
      metadata: {
        staffProfileId: params.staffProfileId,
        cancelledAt: new Date().toISOString(),
      },
    },
  });

  return updated;
}

/**
 * 5. Create Admin Manual Attendance (Admin) - Section 5, 6, 16, 28, 32, 42
 */
export async function createAdminManualAttendance(params: {
  organizationId: string;
  adminUserId: string;
  staffProfileId: string;
  branchId?: string | null;
  date: Date | string;
  clockInTime: string | Date;
  clockOutTime?: string | Date | null;
  reason: string;
  adminComment?: string;
  originUrl?: string;
}) {
  const cleanReason = params.reason?.trim();
  if (!cleanReason || cleanReason.length < 3) {
    throw new Error('A reason is required when recording manual attendance.');
  }

  const targetDate = normalizeDate(params.date);
  const todayMidnight = normalizeDate(new Date());

  // Section 17: Disallow future dates unless required
  if (targetDate > todayMidnight) {
    throw new Error('Manual attendance cannot be recorded for future dates.');
  }

  // Fetch admin and staff
  const [adminUser, staff] = await Promise.all([
    prisma.user.findUnique({ where: { id: params.adminUserId } }),
    prisma.staffProfile.findFirst({
      where: { id: params.staffProfileId, organizationId: params.organizationId },
      include: { user: true, organization: true, branchAssignments: { include: { branch: true } } },
    }),
  ]);

  if (!adminUser || !staff) {
    throw new Error('Admin or Staff profile not found.');
  }

  const targetBranchId = params.branchId || staff.branchAssignments[0]?.branchId || null;
  const parsedClockIn = parseTimeToDate(targetDate, params.clockInTime);
  const parsedClockOut = parseTimeToDate(targetDate, params.clockOutTime);

  if (!parsedClockIn) {
    throw new Error('A valid Clock-in time is required.');
  }

  if (parsedClockOut && parsedClockOut <= parsedClockIn) {
    throw new Error('Clock-out time cannot be earlier than or equal to clock-in time.');
  }

  return await prisma.$transaction(
    async (tx) => {
      // Create Clock In Record (source = MANUAL, isManualEntry = true)
      const clockInRecord = await tx.attendanceRecord.create({
        data: {
          organizationId: params.organizationId,
          staffProfileId: params.staffProfileId,
          branchId: targetBranchId,
          type: 'CLOCK_IN',
          verificationStatus: 'VERIFIED',
          source: 'MANUAL',
          isManualEntry: true,
          manualReason: cleanReason,
          createdById: params.adminUserId,
          deviceStatus: 'REGISTERED',
          deviceMatched: true,
          ipAddress: '127.0.0.1',
          ipMatched: true,
          geofenceMatched: true,
          timestamp: parsedClockIn,
        },
      });

      // Create Clock Out Record if provided
      let clockOutRecord: any = null;
      if (parsedClockOut) {
        clockOutRecord = await tx.attendanceRecord.create({
          data: {
            organizationId: params.organizationId,
            staffProfileId: params.staffProfileId,
            branchId: targetBranchId,
            type: 'CLOCK_OUT',
            verificationStatus: 'VERIFIED',
            source: 'MANUAL',
            isManualEntry: true,
            manualReason: cleanReason,
            createdById: params.adminUserId,
            deviceStatus: 'REGISTERED',
            deviceMatched: true,
            ipAddress: '127.0.0.1',
            ipMatched: true,
            geofenceMatched: true,
            timestamp: parsedClockOut,
          },
        });
      }

      // Create AttendanceAdjustmentAudit entry
      await tx.attendanceAdjustmentAudit.create({
        data: {
          organizationId: params.organizationId,
          staffProfileId: params.staffProfileId,
          attendanceRecordId: clockInRecord.id,
          newClockIn: parsedClockIn,
          newClockOut: parsedClockOut,
          reason: cleanReason,
          reviewerUserId: params.adminUserId,
          reviewedAt: new Date(),
          action: 'MANUAL_ENTRY_CREATED',
        },
      });

      // Create Audit Log
      await tx.auditLog.create({
        data: {
          organizationId: params.organizationId,
          actorUserId: params.adminUserId,
          action: 'MANUAL_ATTENDANCE_CREATED',
          entityType: 'AttendanceRecord',
          entityId: clockInRecord.id,
          metadata: {
            staffProfileId: params.staffProfileId,
            date: formatUtcDateString(targetDate),
            clockIn: parsedClockIn.toISOString(),
            clockOut: parsedClockOut?.toISOString() || null,
            reason: cleanReason,
            adminComment: params.adminComment || null,
            adminName: adminUser.name,
          },
        },
      });

      // Send Staff Email Notification (Non-blocking)
      setTimeout(async () => {
        try {
          if (staff.user.email) {
            const loginUrl = `${params.originUrl || 'https://shiftguard.app'}/${staff.organization.organizationCode}/staff/attendance`;
            const payload = templateAdminManualAttendanceCreated({
              orgName: staff.organization.name,
              staffName: staff.name,
              date: formatUtcDateString(targetDate),
              clockInTime: parsedClockIn.toISOString().slice(11, 16),
              clockOutTime: parsedClockOut ? parsedClockOut.toISOString().slice(11, 16) : null,
              reason: cleanReason,
              adminName: adminUser.name,
              loginUrl,
            });

            await sendEmail({
              organizationId: params.organizationId,
              recipient: staff.user.email,
              type: 'MANUAL_ATTENDANCE_CREATED',
              subject: payload.subject,
              htmlContent: payload.html,
              textContent: payload.text,
            });
          }
        } catch (err) {
          console.error('Non-blocking manual attendance email error:', err);
        }
      }, 0);

      return {
        clockInRecord,
        clockOutRecord,
      };
    },
    { timeout: 30000, maxWait: 15000 }
  );
}

/**
 * 6. Query Staff Correction Requests - Section 7
 */
export async function getStaffCorrectionRequests(staffProfileId: string, organizationId: string) {
  return await prisma.attendanceCorrectionRequest.findMany({
    where: {
      staffProfileId,
      organizationId,
    },
    orderBy: { createdAt: 'desc' },
    include: {
      reviewerUser: { select: { id: true, name: true, email: true } },
      branch: true,
    },
  });
}

/**
 * 7. Query Admin Correction Requests Directory - Section 8
 */
export async function getAdminCorrectionRequests(params: {
  organizationId: string;
  status?: CorrectionRequestStatus;
  type?: CorrectionRequestType;
  staffProfileId?: string;
  branchId?: string;
  search?: string;
}) {
  const where: any = {
    organizationId: params.organizationId,
  };

  if (params.status) where.status = params.status;
  if (params.type) where.type = params.type;
  if (params.staffProfileId) where.staffProfileId = params.staffProfileId;
  if (params.branchId) where.branchId = params.branchId;

  if (params.search) {
    where.staffProfile = {
      OR: [
        { name: { contains: params.search, mode: 'insensitive' } },
        { staffId: { contains: params.search, mode: 'insensitive' } },
      ],
    };
  }

  const [requests, pendingCount, approvedCount, rejectedCount] = await Promise.all([
    prisma.attendanceCorrectionRequest.findMany({
      where,
      include: {
        staffProfile: {
          include: {
            branchAssignments: { include: { branch: true } },
          },
        },
        reviewerUser: { select: { id: true, name: true, email: true } },
        branch: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.attendanceCorrectionRequest.count({
      where: { organizationId: params.organizationId, status: 'PENDING' },
    }),
    prisma.attendanceCorrectionRequest.count({
      where: { organizationId: params.organizationId, status: 'APPROVED' },
    }),
    prisma.attendanceCorrectionRequest.count({
      where: { organizationId: params.organizationId, status: 'REJECTED' },
    }),
  ]);

  return {
    requests,
    metrics: {
      pendingCount,
      approvedCount,
      rejectedCount,
      totalCount: requests.length,
    },
  };
}

/**
 * 8. Query Admin Daily Attendance with Source Badges - Section 25, 26
 */
export async function getAdminDailyAttendance(params: {
  organizationId: string;
  date: Date | string;
  branchId?: string;
  source?: AttendanceSource;
  search?: string;
}) {
  const targetDate = normalizeDate(params.date);
  const startOfDay = new Date(targetDate.getTime());
  const endOfDay = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000 - 1);

  const where: any = {
    organizationId: params.organizationId,
    timestamp: { gte: startOfDay, lte: endOfDay },
    verificationStatus: 'VERIFIED',
  };

  if (params.branchId) where.branchId = params.branchId;
  if (params.source) where.source = params.source;

  if (params.search) {
    where.staffProfile = {
      OR: [
        { name: { contains: params.search, mode: 'insensitive' } },
        { staffId: { contains: params.search, mode: 'insensitive' } },
      ],
    };
  }

  const records = await prisma.attendanceRecord.findMany({
    where,
    include: {
      staffProfile: {
        include: {
          branchAssignments: { include: { branch: true } },
        },
      },
      branch: true,
      creatorUser: { select: { id: true, name: true, email: true } },
    },
    orderBy: { timestamp: 'asc' },
  });

  // Group punches by staffProfileId
  const staffAttendanceMap = new Map<string, any>();

  for (const r of records) {
    if (!staffAttendanceMap.has(r.staffProfileId)) {
      staffAttendanceMap.set(r.staffProfileId, {
        staff: r.staffProfile,
        branch: r.branch,
        clockIn: null,
        clockOut: null,
        source: r.source,
        isManualEntry: r.isManualEntry,
        manualReason: r.manualReason,
        creator: r.creatorUser,
      });
    }

    const item = staffAttendanceMap.get(r.staffProfileId);
    if (r.type === 'CLOCK_IN' && !item.clockIn) {
      item.clockIn = r.timestamp;
      item.source = r.source;
    } else if (r.type === 'CLOCK_OUT') {
      item.clockOut = r.timestamp;
    }
  }

  const dailyList = Array.from(staffAttendanceMap.values());
  const normalCount = dailyList.filter((d) => d.source === 'NORMAL').length;
  const manualCount = dailyList.filter((d) => d.source === 'MANUAL').length;
  const adjustedCount = dailyList.filter((d) => d.source === 'ADJUSTED').length;

  return {
    date: formatUtcDateString(targetDate),
    dailyList,
    metrics: {
      totalPresent: dailyList.length,
      normalCount,
      manualCount,
      adjustedCount,
    },
  };
}

/**
 * 9. Get Correction Request Detail with Day's Existing Attendance Context - Section 9
 */
export async function getCorrectionRequestDetail(requestId: string, organizationId: string) {
  const request = await prisma.attendanceCorrectionRequest.findUnique({
    where: { id: requestId },
    include: {
      staffProfile: {
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          branchAssignments: { include: { branch: true } },
        },
      },
      branch: true,
      reviewerUser: { select: { id: true, name: true, email: true } },
      createdByUser: { select: { id: true, name: true, email: true } },
      attendanceRecord: true,
    },
  });

  if (!request || request.organizationId !== organizationId) {
    return null;
  }

  const startOfDay = new Date(request.date.getTime());
  const endOfDay = new Date(request.date.getTime() + 24 * 60 * 60 * 1000 - 1);

  const existingRecords = await prisma.attendanceRecord.findMany({
    where: {
      staffProfileId: request.staffProfileId,
      timestamp: { gte: startOfDay, lte: endOfDay },
      verificationStatus: 'VERIFIED',
    },
    orderBy: { timestamp: 'asc' },
    include: { branch: true },
  });

  return {
    request,
    existingRecords,
  };
}

