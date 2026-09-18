import { prisma } from '@/lib/prisma';
import { LeaveType, LeaveRequestStatus } from '@prisma/client';
import { sendEmail } from '@/services/email.service';
import {
  templateLeaveRequestSubmitted,
  templateLeaveApproved,
  templateLeaveRejected,
  templateAdminManualLeave,
} from '@/services/email-templates';

// Helper to normalize Date to UTC Midnight (YYYY-MM-DD 00:00:00.000Z)
export function normalizeDate(d: Date | string): Date {
  const dateObj = typeof d === 'string' ? new Date(d) : d;
  return new Date(Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate(), 0, 0, 0, 0));
}

export function formatUtcDateString(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function countDaysBetween(startDate: Date, endDate: Date): number {
  const start = normalizeDate(startDate).getTime();
  const end = normalizeDate(endDate).getTime();
  const diffTime = end - start;
  return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

// -----------------------------------------------------------------------------
// 1. Leave Balances Management (Section 26, 27, 28, 29)
// -----------------------------------------------------------------------------
export async function getOrCreateStaffLeaveBalances(
  staffProfileId: string,
  organizationId: string,
  year: number = new Date().getUTCFullYear()
) {
  const defaultTypes: Array<{ type: LeaveType; entitlement: number }> = [
    { type: 'ANNUAL', entitlement: 12 },
    { type: 'SICK', entitlement: 12 },
    { type: 'OTHER', entitlement: 0 },
    { type: 'DUTY', entitlement: 0 },
  ];

  const existing = await prisma.leaveBalance.findMany({
    where: {
      staffProfileId,
      organizationId,
      year,
    },
  });

  const existingMap = new Map(existing.map((b) => [b.leaveType, b]));
  const balances = [];

  for (const def of defaultTypes) {
    if (existingMap.has(def.type)) {
      const b = existingMap.get(def.type)!;
      balances.push({
        ...b,
        remaining: Math.max(0, b.entitlement - b.used),
      });
    } else {
      const created = await prisma.leaveBalance.create({
        data: {
          staffProfileId,
          organizationId,
          year,
          leaveType: def.type,
          entitlement: def.entitlement,
          used: 0,
        },
      });
      balances.push({
        ...created,
        remaining: created.entitlement,
      });
    }
  }

  return balances;
}

// -----------------------------------------------------------------------------
// 2. Overlap & Existing Attendance Detection (Section 31, 32, 34)
// -----------------------------------------------------------------------------
export async function checkLeaveOverlap(
  staffProfileId: string,
  startDate: Date,
  endDate: Date,
  excludeRequestId?: string
): Promise<{ hasOverlap: boolean; overlappingRequest?: any }> {
  const normStart = normalizeDate(startDate);
  const normEnd = normalizeDate(endDate);

  const overlapping = await prisma.leaveRequest.findFirst({
    where: {
      staffProfileId,
      status: { in: ['PENDING', 'APPROVED'] },
      id: excludeRequestId ? { not: excludeRequestId } : undefined,
      startDate: { lte: normEnd },
      endDate: { gte: normStart },
    },
  });

  return {
    hasOverlap: !!overlapping,
    overlappingRequest: overlapping,
  };
}

export async function checkRetroactiveAttendance(
  staffProfileId: string,
  startDate: Date,
  endDate: Date
): Promise<{ hasAttendance: boolean; recordsCount: number }> {
  const normStart = normalizeDate(startDate);
  const normEnd = normalizeDate(endDate);
  normEnd.setUTCHours(23, 59, 59, 999);

  const count = await prisma.attendanceRecord.count({
    where: {
      staffProfileId,
      verificationStatus: 'VERIFIED',
      timestamp: {
        gte: normStart,
        lte: normEnd,
      },
    },
  });

  return {
    hasAttendance: count > 0,
    recordsCount: count,
  };
}

// -----------------------------------------------------------------------------
// 3. Staffing Picture & Minimum Threshold Engine (Section 13, 14, 15, 16, 20)
// -----------------------------------------------------------------------------
export interface DayStaffingPicture {
  date: string; // YYYY-MM-DD
  dayOfWeek: string;
  isHoliday: boolean;
  branchName: string | null;
  shiftName: string | null;
  shiftHours: string | null;
  totalAssignedStaff: number;
  alreadyOnLeaveStaff: number;
  afterApprovalAvailable: number;
  minimumStaffingThreshold: number;
  status: 'GREEN' | 'AMBER' | 'RED' | 'HOLIDAY' | 'NO_SHIFT' | 'OFF_DUTY';
  statusMessage: string;

  // Frontend & API Aliases
  totalScheduled?: number;
  onLeaveCount?: number;
  onLeaveWithThis?: number;
  remainingStaff?: number;
  minRequired?: number;
  isShortage?: boolean;
}

export async function calculateStaffingImpact(
  organizationId: string,
  staffProfileId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  days: DayStaffingPicture[];
  hasShortage: boolean;
  totalShortageDays: number;
}> {
  const normStart = normalizeDate(startDate);
  const normEnd = normalizeDate(endDate);
  const totalDays = countDaysBetween(normStart, normEnd);

  // Load staff profile with branch assignments, active shift assignments & additional shifts
  const staff = await prisma.staffProfile.findUnique({
    where: { id: staffProfileId },
    include: {
      branchAssignments: { include: { branch: true } },
      shiftAssignments: {
        include: {
          shiftPattern: {
            include: { weeklyDays: true },
          },
        },
        orderBy: { effectiveFrom: 'desc' },
      },
      additionalShifts: {
        where: {
          date: {
            gte: normStart,
            lte: normEnd,
          },
        },
      },
    },
  });

  if (!staff) {
    throw new Error('Staff profile not found.');
  }

  const daysResult: DayStaffingPicture[] = [];
  let totalShortageDays = 0;
  const branchId = staff.branchAssignments[0]?.branchId;

  const weekdaysMap = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as const;

  for (let i = 0; i < totalDays; i++) {
    const currDate = new Date(normStart.getTime() + i * 24 * 60 * 60 * 1000);
    const dateStr = formatUtcDateString(currDate);
    const dayOfWeek = weekdaysMap[currDate.getUTCDay()];

    // 1. Find all active shift assignments for staff on this date
    const activeAssignments = staff.shiftAssignments.filter(
      (a) =>
        a.effectiveFrom <= currDate &&
        (!a.effectiveTo || a.effectiveTo >= currDate)
    );

    // Find shift patterns assigned to staff that operate on this weekday
    const activePatternsForDay = activeAssignments
      .map((a) => a.shiftPattern)
      .filter((p) => p && p.isActive)
      .filter((p) => p.weeklyDays.some((d) => d.weekday === dayOfWeek));

    // Find additional shifts assigned to staff on this date
    const staffAddShiftsForDay = (staff.additionalShifts || []).filter((s) => {
      const sIso = formatUtcDateString(new Date(s.date));
      return sIso === dateStr;
    });

    // If staff has NO scheduled shift pattern and NO additional shift on this date -> OFF DUTY
    if (activePatternsForDay.length === 0 && staffAddShiftsForDay.length === 0) {
      daysResult.push({
        date: dateStr,
        dayOfWeek,
        isHoliday: false,
        branchName: staff.branchAssignments[0]?.branch.name || null,
        shiftName: 'Off Duty',
        shiftHours: 'Rest Day',
        totalAssignedStaff: 0,
        alreadyOnLeaveStaff: 0,
        afterApprovalAvailable: 0,
        minimumStaffingThreshold: 0,
        status: 'OFF_DUTY',
        statusMessage: 'Off Duty / Non-Working Day',
        totalScheduled: 0,
        onLeaveCount: 0,
        onLeaveWithThis: 1,
        remainingStaff: 0,
        minRequired: 0,
        isShortage: false,
      });
      continue;
    }

    // Process each active shift pattern for this date
    for (const shiftPattern of activePatternsForDay) {
      const weeklyDay = shiftPattern.weeklyDays.find((d) => d.weekday === dayOfWeek);

      const override = await prisma.staffShiftOverride.findUnique({
        where: {
          staffProfileId_date: {
            staffProfileId,
            date: currDate,
          },
        },
      });

      const isHoliday = override ? override.isHoliday : weeklyDay ? weeklyDay.isHoliday : false;

      if (isHoliday) {
        daysResult.push({
          date: dateStr,
          dayOfWeek,
          isHoliday: true,
          branchName: staff.branchAssignments[0]?.branch.name || null,
          shiftName: shiftPattern.name,
          shiftHours: 'Holiday',
          totalAssignedStaff: 0,
          alreadyOnLeaveStaff: 0,
          afterApprovalAvailable: 0,
          minimumStaffingThreshold: 0,
          status: 'HOLIDAY',
          statusMessage: 'Scheduled Holiday',
          totalScheduled: 0,
          onLeaveCount: 0,
          onLeaveWithThis: 1,
          remainingStaff: 0,
          minRequired: 0,
          isShortage: false,
        });
        continue;
      }

      const shiftHours = override
        ? `${override.startTime || '09:00'} - ${override.endTime || '17:00'}`
        : `${weeklyDay?.startTime || '09:00'} - ${weeklyDay?.endTime || '17:00'}`;

      const regularAssignedStaff = await prisma.shiftAssignment.count({
        where: {
          shiftPatternId: shiftPattern.id,
          effectiveFrom: { lte: currDate },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: currDate } }],
          staffProfile: {
            organizationId,
            user: { status: 'ACTIVE' },
          },
        },
      });

      // Count additional shifts assigned to staff for this shift pattern on currDate
      const additionalAssignedStaff = await prisma.additionalShift.count({
        where: {
          organizationId,
          date: currDate,
          title: { equals: shiftPattern.name, mode: 'insensitive' },
          staffProfile: {
            user: { status: 'ACTIVE' },
          },
        },
      });

      const totalAssignedStaff = regularAssignedStaff + additionalAssignedStaff;

      const approvedLeavesOnDate = await prisma.leaveRequest.count({
        where: {
          organizationId,
          status: 'APPROVED',
          staffProfileId: { not: staffProfileId },
          startDate: { lte: currDate },
          endDate: { gte: currDate },
          staffProfile: {
            shiftAssignments: {
              some: {
                shiftPatternId: shiftPattern.id,
                effectiveFrom: { lte: currDate },
                OR: [{ effectiveTo: null }, { effectiveTo: { gte: currDate } }],
              },
            },
          },
        },
      });

      const minimum = shiftPattern.minimumStaffingThreshold || 1;
      const afterApprovalAvailable = Math.max(0, totalAssignedStaff - approvedLeavesOnDate - 1);
      const isShortage = afterApprovalAvailable < minimum;

      let status: 'GREEN' | 'AMBER' | 'RED' = 'GREEN';
      let statusMessage = 'Meets minimum staffing threshold';

      if (isShortage) {
        status = 'RED';
        statusMessage = `Below minimum (${afterApprovalAvailable} / ${minimum} required)`;
        totalShortageDays++;
      } else if (afterApprovalAvailable === minimum) {
        status = 'AMBER';
        statusMessage = `Exactly at minimum (${afterApprovalAvailable} / ${minimum})`;
      }

      daysResult.push({
        date: dateStr,
        dayOfWeek,
        isHoliday: false,
        branchName: staff.branchAssignments[0]?.branch.name || null,
        shiftName: shiftPattern.name,
        shiftHours,
        totalAssignedStaff,
        alreadyOnLeaveStaff: approvedLeavesOnDate,
        afterApprovalAvailable,
        minimumStaffingThreshold: minimum,
        status,
        statusMessage,

        // Aliases for Frontend & API
        totalScheduled: totalAssignedStaff,
        onLeaveCount: approvedLeavesOnDate,
        onLeaveWithThis: approvedLeavesOnDate + 1,
        remainingStaff: afterApprovalAvailable,
        minRequired: minimum,
        isShortage,
      });
    }

    // Process each additional shift assigned to staff for this date
    for (const addShift of staffAddShiftsForDay) {
      const shiftName = addShift.title || 'Additional Shift';
      const shiftHours = `${addShift.startTime} - ${addShift.endTime}`;

      const additionalAssignedStaff = await prisma.additionalShift.count({
        where: {
          organizationId,
          date: currDate,
          title: { equals: shiftName, mode: 'insensitive' },
          staffProfile: {
            user: { status: 'ACTIVE' },
          },
        },
      });

      const totalAssignedStaff = Math.max(1, additionalAssignedStaff);
      const approvedLeavesOnDate = await prisma.leaveRequest.count({
        where: {
          organizationId,
          status: 'APPROVED',
          staffProfileId: { not: staffProfileId },
          startDate: { lte: currDate },
          endDate: { gte: currDate },
          staffProfile: {
            additionalShifts: {
              some: {
                date: currDate,
                title: { equals: shiftName, mode: 'insensitive' },
              },
            },
          },
        },
      });

      const minimum = 1;
      const afterApprovalAvailable = Math.max(0, totalAssignedStaff - approvedLeavesOnDate - 1);
      const isShortage = afterApprovalAvailable < minimum;

      let status: 'GREEN' | 'AMBER' | 'RED' = 'GREEN';
      let statusMessage = 'Meets minimum staffing threshold';

      if (isShortage) {
        status = 'RED';
        statusMessage = `Below minimum (${afterApprovalAvailable} / ${minimum} required)`;
        totalShortageDays++;
      } else if (afterApprovalAvailable === minimum) {
        status = 'AMBER';
        statusMessage = `Exactly at minimum (${afterApprovalAvailable} / ${minimum})`;
      }

      daysResult.push({
        date: dateStr,
        dayOfWeek,
        isHoliday: false,
        branchName: staff.branchAssignments[0]?.branch.name || null,
        shiftName,
        shiftHours,
        totalAssignedStaff,
        alreadyOnLeaveStaff: approvedLeavesOnDate,
        afterApprovalAvailable,
        minimumStaffingThreshold: minimum,
        status,
        statusMessage,

        totalScheduled: totalAssignedStaff,
        onLeaveCount: approvedLeavesOnDate,
        onLeaveWithThis: approvedLeavesOnDate + 1,
        remainingStaff: afterApprovalAvailable,
        minRequired: minimum,
        isShortage,
      });
    }
  }

  return {
    days: daysResult,
    hasShortage: totalShortageDays > 0,
    totalShortageDays,
  };
}

// -----------------------------------------------------------------------------
// 4. Alternative Date Suggestions Algorithm (Section 22, 23, 24, 25)
// -----------------------------------------------------------------------------
export interface AlternativeSuggestion {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  daysCount: number;
  shortageDaysCount: number;
  overlapCount: number;
  impactLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
}

export async function suggestAlternativeDateRanges(
  organizationId: string,
  staffProfileId: string,
  originalStartDate: Date,
  originalEndDate: Date,
  daysCount: number
): Promise<AlternativeSuggestion[]> {
  const normStart = normalizeDate(originalStartDate);
  const candidates: AlternativeSuggestion[] = [];

  // Search window ±14 days (excluding offset 0 which is original)
  const offsets = [-7, 7, -3, 3, -14, 14];

  for (const offset of offsets) {
    const candStart = new Date(normStart.getTime() + offset * 24 * 60 * 60 * 1000);
    const candEnd = new Date(candStart.getTime() + (daysCount - 1) * 24 * 60 * 60 * 1000);

    // Skip candidate windows in the past
    if (candStart < normalizeDate(new Date())) continue;

    // Check overlap for this candidate window
    const overlap = await checkLeaveOverlap(staffProfileId, candStart, candEnd);
    const overlapCount = overlap.hasOverlap ? 1 : 0;

    // Calculate staffing impact for this window
    const impact = await calculateStaffingImpact(organizationId, staffProfileId, candStart, candEnd);

    let impactLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (impact.totalShortageDays > 1 || overlapCount > 0) {
      impactLevel = 'HIGH';
    } else if (impact.totalShortageDays === 1) {
      impactLevel = 'MEDIUM';
    }

    let desc = 'Meets minimum staffing';
    if (impact.totalShortageDays > 0) {
      desc = `${impact.totalShortageDays} day(s) below threshold`;
    } else if (overlapCount > 0) {
      desc = 'Overlaps existing requested leave';
    }

    candidates.push({
      startDate: formatUtcDateString(candStart),
      endDate: formatUtcDateString(candEnd),
      daysCount,
      shortageDaysCount: impact.totalShortageDays,
      overlapCount,
      impactLevel,
      description: desc,
    });
  }

  // Sort candidates by:
  // 1. Least overlap
  // 2. Least shortage days
  // 3. Closeness to original date
  candidates.sort((a, b) => {
    if (a.overlapCount !== b.overlapCount) return a.overlapCount - b.overlapCount;
    if (a.shortageDaysCount !== b.shortageDaysCount) return a.shortageDaysCount - b.shortageDaysCount;
    return 0;
  });

  // Return top 3 distinct suggestions
  return candidates.slice(0, 3);
}

// -----------------------------------------------------------------------------
// 4b. Leave Restriction Rules & Blackout Engine
// -----------------------------------------------------------------------------
export async function getOrganizationLeaveRestrictionRules(organizationId: string) {
  return await prisma.leaveRestrictionRule.findMany({
    where: {
      organizationId,
      isActive: true,
    },
    orderBy: { startDate: 'asc' },
  });
}

export async function validateLeaveDatesAgainstRules(
  organizationId: string,
  startDate: Date,
  endDate: Date,
  leaveType: LeaveType
) {
  const normStart = normalizeDate(startDate);
  const normEnd = normalizeDate(endDate);

  const rules = await getOrganizationLeaveRestrictionRules(organizationId);

  if (rules.length === 0) return { isValid: true };

  // 1. Check Blackout Periods
  const blackoutRules = rules.filter(
    (r) =>
      r.ruleType === 'BLACKOUT_PERIOD' &&
      (r.leaveType === 'ALL' || r.leaveType === leaveType)
  );

  for (const rule of blackoutRules) {
    const ruleStart = normalizeDate(rule.startDate);
    const ruleEnd = normalizeDate(rule.endDate);

    if (normStart <= ruleEnd && normEnd >= ruleStart) {
      return {
        isValid: false,
        error: `Leave applications are restricted during blackout period: "${rule.title}" (${formatUtcDateString(ruleStart)} to ${formatUtcDateString(ruleEnd)}).`,
        rule,
      };
    }
  }

  // 2. Check Allowed Windows (If any ALLOWED_WINDOW rule exists for this leave type)
  const allowedRules = rules.filter(
    (r) =>
      r.ruleType === 'ALLOWED_WINDOW' &&
      (r.leaveType === 'ALL' || r.leaveType === leaveType)
  );

  if (allowedRules.length > 0) {
    const insideAllowedWindow = allowedRules.some((rule) => {
      const ruleStart = normalizeDate(rule.startDate);
      const ruleEnd = normalizeDate(rule.endDate);
      return normStart >= ruleStart && normEnd <= ruleEnd;
    });

    if (!insideAllowedWindow) {
      const windowDescs = allowedRules
        .map((r) => `"${r.title}" (${formatUtcDateString(r.startDate)} to ${formatUtcDateString(r.endDate)})`)
        .join(', ');
      return {
        isValid: false,
        error: `Requested dates fall outside allowed leave application windows. Active allowed windows for ${leaveType}: ${windowDescs}.`,
      };
    }
  }

  return { isValid: true };
}

// -----------------------------------------------------------------------------
// 5. Submit Staff Leave Request (Section 4, 5, 30, 31, 37)
// -----------------------------------------------------------------------------
export async function submitStaffLeaveRequest(params: {
  organizationId: string;
  staffProfileId: string;
  userId: string;
  type: LeaveType;
  startDate: Date | string;
  endDate: Date | string;
  reason: string;
  originUrl?: string;
}) {
  const normStart = normalizeDate(params.startDate);
  const normEnd = normalizeDate(params.endDate);

  if (normStart > normEnd) {
    throw new Error('Start date cannot be after end date.');
  }

  const daysCount = countDaysBetween(normStart, normEnd);
  const year = normStart.getUTCFullYear();

  // 1. Verify staff belongs to organization and is active
  const staff = await prisma.staffProfile.findFirst({
    where: {
      id: params.staffProfileId,
      organizationId: params.organizationId,
      user: { status: 'ACTIVE' },
    },
    include: {
      organization: true,
      user: true,
    },
  });

  if (!staff) {
    throw new Error('Staff profile not found or inactive.');
  }

  // 1b. Validate against Organization Leave Restriction Rules (Allowed Windows & Blackout Periods)
  const ruleCheck = await validateLeaveDatesAgainstRules(
    params.organizationId,
    normStart,
    normEnd,
    params.type
  );
  if (!ruleCheck.isValid) {
    throw new Error(ruleCheck.error || 'Requested leave dates are restricted by organization policy.');
  }

  // 2. Check overlap
  const overlap = await checkLeaveOverlap(params.staffProfileId, normStart, normEnd);
  if (overlap.hasOverlap) {
    throw new Error('These dates overlap an existing pending or approved leave request.');
  }

  // 3. Balance verification (for ANNUAL & SICK)
  if (params.type === 'ANNUAL' || params.type === 'SICK') {
    const balances = await getOrCreateStaffLeaveBalances(params.staffProfileId, params.organizationId, year);
    const balance = balances.find((b) => b.leaveType === params.type);
    if (!balance || balance.remaining < daysCount) {
      throw new Error(`Insufficient ${params.type.toLowerCase()} leave balance. Available: ${balance?.remaining || 0} days, Requested: ${daysCount} days.`);
    }
  }

  // 4. Check retroactive attendance
  const retro = await checkRetroactiveAttendance(params.staffProfileId, normStart, normEnd);

  // 5. Create Leave Request
  const leaveRequest = await prisma.leaveRequest.create({
    data: {
      organizationId: params.organizationId,
      staffProfileId: params.staffProfileId,
      type: params.type,
      startDate: normStart,
      endDate: normEnd,
      daysCount,
      reason: params.reason.trim(),
      status: 'PENDING',
    },
  });

  // 6. Audit Log
  await prisma.auditLog.create({
    data: {
      organizationId: params.organizationId,
      actorUserId: params.userId,
      action: 'LEAVE_REQUESTED',
      entityType: 'LeaveRequest',
      entityId: leaveRequest.id,
      metadata: {
        leaveType: params.type,
        startDate: formatUtcDateString(normStart),
        endDate: formatUtcDateString(normEnd),
        daysCount,
        hasRetroactiveAttendance: retro.hasAttendance,
      },
    },
  });

  // 7. Dispatch Email Notification to Org Admin (Non-blocking)
  try {
    const orgAdmin = await prisma.user.findFirst({
      where: {
        organizationId: params.organizationId,
        role: 'ORG_ADMIN',
        status: 'ACTIVE',
      },
    });

    if (orgAdmin?.email) {
      const reviewUrl = `${params.originUrl || 'https://shiftguard.app'}/${staff.organization.organizationCode}/admin/leave/${leaveRequest.id}`;
      const payload = templateLeaveRequestSubmitted({
        orgName: staff.organization.name,
        staffName: staff.name,
        staffId: staff.staffId,
        leaveType: params.type,
        dateRange: `${formatUtcDateString(normStart)} to ${formatUtcDateString(normEnd)}`,
        daysCount,
        reason: params.reason,
        reviewUrl,
      });

      await sendEmail({
        organizationId: params.organizationId,
        recipient: orgAdmin.email,
        type: 'LEAVE_REQUEST_SUBMITTED',
        subject: payload.subject,
        htmlContent: payload.html,
        textContent: payload.text,
      });
    }
  } catch (emailErr) {
    console.error('Non-blocking leave request email preparation error:', emailErr);
  }

  return {
    leaveRequest,
    retroactiveWarning: retro.hasAttendance ? 'Attendance records exist for these dates. Admin approval is required.' : null,
  };
}

// -----------------------------------------------------------------------------
// 6. Approve Leave Request (Section 12, 21, 38, 50, 51)
// -----------------------------------------------------------------------------
export async function approveLeaveRequest(params: {
  organizationId: string;
  requestId: string;
  reviewerUserId: string;
  reviewerComment?: string;
  approvedStartDate?: Date | string;
  approvedEndDate?: Date | string;
  originUrl?: string;
}) {
  return await prisma.$transaction(async (tx) => {
    // 1. Fetch & lock leave request
    const request = await tx.leaveRequest.findUnique({
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
      throw new Error('Leave request not found.');
    }

    if (request.status !== 'PENDING') {
      throw new Error(`This leave request is already ${request.status.toLowerCase()}.`);
    }

    // Determine approved date range & approved days count
    const normRequestStart = normalizeDate(request.startDate);
    const normRequestEnd = normalizeDate(request.endDate);

    let normApprovedStart = normRequestStart;
    let normApprovedEnd = normRequestEnd;

    if (params.approvedStartDate) {
      normApprovedStart = normalizeDate(params.approvedStartDate);
    }
    if (params.approvedEndDate) {
      normApprovedEnd = normalizeDate(params.approvedEndDate);
    }

    if (normApprovedStart < normRequestStart || normApprovedEnd > normRequestEnd) {
      throw new Error('Approved date range must fall within original requested leave dates.');
    }
    if (normApprovedStart > normApprovedEnd) {
      throw new Error('Approved start date cannot be after approved end date.');
    }

    const approvedDaysCount = countDaysBetween(normApprovedStart, normApprovedEnd);
    const isPartiallyApproved = approvedDaysCount < request.daysCount;
    const year = normApprovedStart.getUTCFullYear();

    // 2. If ANNUAL or SICK, check & update balance transactionally for approvedDaysCount ONLY
    if (request.type === 'ANNUAL' || request.type === 'SICK') {
      let balance = await tx.leaveBalance.findUnique({
        where: {
          staffProfileId_year_leaveType: {
            staffProfileId: request.staffProfileId,
            year,
            leaveType: request.type,
          },
        },
      });

      if (!balance) {
        balance = await tx.leaveBalance.create({
          data: {
            organizationId: params.organizationId,
            staffProfileId: request.staffProfileId,
            year,
            leaveType: request.type,
            entitlement: 12,
            used: 0,
          },
        });
      }

      const remaining = balance.entitlement - balance.used;
      if (remaining < approvedDaysCount) {
        throw new Error(`Cannot approve: insufficient ${request.type.toLowerCase()} balance. Available: ${remaining}, Required: ${approvedDaysCount}.`);
      }

      // Deduct used balance for approvedDaysCount
      await tx.leaveBalance.update({
        where: { id: balance.id },
        data: {
          used: { increment: approvedDaysCount },
        },
      });
    }

    // 3. Update Leave Request with approved dates & daysCount
    const updated = await tx.leaveRequest.update({
      where: { id: request.id },
      data: {
        startDate: normApprovedStart,
        endDate: normApprovedEnd,
        daysCount: approvedDaysCount,
        status: 'APPROVED',
        reviewerUserId: params.reviewerUserId,
        reviewedAt: new Date(),
        reviewerComment: params.reviewerComment?.trim() || null,
      },
    });

    // 4. Create Audit Log
    await tx.auditLog.create({
      data: {
        organizationId: params.organizationId,
        actorUserId: params.reviewerUserId,
        action: isPartiallyApproved ? 'LEAVE_PARTIALLY_APPROVED' : 'LEAVE_APPROVED',
        entityType: 'LeaveRequest',
        entityId: updated.id,
        metadata: {
          staffProfileId: request.staffProfileId,
          leaveType: request.type,
          originalStartDate: formatUtcDateString(normRequestStart),
          originalEndDate: formatUtcDateString(normRequestEnd),
          originalDaysCount: request.daysCount,
          approvedStartDate: formatUtcDateString(normApprovedStart),
          approvedEndDate: formatUtcDateString(normApprovedEnd),
          approvedDaysCount,
          isPartiallyApproved,
          reviewerComment: params.reviewerComment || null,
        },
      },
    });

    // 5. Send Staff Email Notification (isolated execution outside transaction failure)
    setTimeout(async () => {
      try {
        if (request.staffProfile.user.email) {
          const loginUrl = `${params.originUrl || 'https://shiftguard.app'}/${request.staffProfile.organization.organizationCode}/login`;
          const payload = templateLeaveApproved({
            orgName: request.staffProfile.organization.name,
            staffName: request.staffProfile.name,
            leaveType: request.type,
            dateRange: `${formatUtcDateString(normApprovedStart)} to ${formatUtcDateString(normApprovedEnd)}${isPartiallyApproved ? ' (Partially Approved)' : ''}`,
            daysCount: approvedDaysCount,
            reviewerComment: params.reviewerComment
              ? `${params.reviewerComment}${isPartiallyApproved ? ` [Original request: ${formatUtcDateString(normRequestStart)} to ${formatUtcDateString(normRequestEnd)}]` : ''}`
              : isPartiallyApproved
              ? `Approved for ${approvedDaysCount} day(s) (${formatUtcDateString(normApprovedStart)} to ${formatUtcDateString(normApprovedEnd)}) out of ${request.daysCount} requested days.`
              : undefined,
            loginUrl,
          });

          await sendEmail({
            organizationId: params.organizationId,
            recipient: request.staffProfile.user.email,
            type: 'LEAVE_APPROVED',
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
  }, { timeout: 30000, maxWait: 15000 });
}

// -----------------------------------------------------------------------------
// 7. Reject Leave Request (Section 12, 39, 52)
// -----------------------------------------------------------------------------
export async function rejectLeaveRequest(params: {
  organizationId: string;
  requestId: string;
  reviewerUserId: string;
  reviewerComment?: string;
  originUrl?: string;
}) {
  const request = await prisma.leaveRequest.findUnique({
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
    throw new Error('Leave request not found.');
  }

  if (request.status !== 'PENDING') {
    throw new Error(`This leave request is already ${request.status.toLowerCase()}.`);
  }

  const updated = await prisma.leaveRequest.update({
    where: { id: request.id },
    data: {
      status: 'REJECTED',
      reviewerUserId: params.reviewerUserId,
      reviewedAt: new Date(),
      reviewerComment: params.reviewerComment?.trim() || null,
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId: params.organizationId,
      actorUserId: params.reviewerUserId,
      action: 'LEAVE_REJECTED',
      entityType: 'LeaveRequest',
      entityId: updated.id,
      metadata: {
        staffProfileId: request.staffProfileId,
        leaveType: request.type,
        startDate: formatUtcDateString(request.startDate),
        endDate: formatUtcDateString(request.endDate),
        rejectionReason: params.reviewerComment || null,
      },
    },
  });

  // Send rejection email (Non-blocking)
  try {
    if (request.staffProfile.user.email) {
      const loginUrl = `${params.originUrl || 'https://shiftguard.app'}/${request.staffProfile.organization.organizationCode}/login`;
      const payload = templateLeaveRejected({
        orgName: request.staffProfile.organization.name,
        staffName: request.staffProfile.name,
        leaveType: request.type,
        dateRange: `${formatUtcDateString(request.startDate)} to ${formatUtcDateString(request.endDate)}`,
        rejectionReason: params.reviewerComment,
        loginUrl,
      });

      await sendEmail({
        organizationId: params.organizationId,
        recipient: request.staffProfile.user.email,
        type: 'LEAVE_REJECTED',
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

// -----------------------------------------------------------------------------
// 8. Cancel Staff Leave Request (Section 43)
// -----------------------------------------------------------------------------
export async function cancelStaffLeaveRequest(params: {
  organizationId: string;
  requestId: string;
  staffProfileId: string;
  userId: string;
}) {
  return await prisma.$transaction(async (tx) => {
    const request = await tx.leaveRequest.findUnique({
      where: { id: params.requestId },
    });

    if (!request || request.organizationId !== params.organizationId || request.staffProfileId !== params.staffProfileId) {
      throw new Error('Leave request not found.');
    }

    if (request.status !== 'PENDING' && request.status !== 'APPROVED') {
      throw new Error('This leave request cannot be cancelled.');
    }

    // If request was approved and leave was ANNUAL or SICK, restore used leave balance
    if (request.status === 'APPROVED' && (request.type === 'ANNUAL' || request.type === 'SICK')) {
      const year = request.startDate.getUTCFullYear();
      const balance = await tx.leaveBalance.findUnique({
        where: {
          staffProfileId_year_leaveType: {
            staffProfileId: request.staffProfileId,
            year,
            leaveType: request.type,
          },
        },
      });

      if (balance && balance.used >= request.daysCount) {
        await tx.leaveBalance.update({
          where: { id: balance.id },
          data: {
            used: { decrement: request.daysCount },
          },
        });
      }
    }

    const updated = await tx.leaveRequest.update({
      where: { id: request.id },
      data: { status: 'CANCELLED' },
    });

    await tx.auditLog.create({
      data: {
        organizationId: params.organizationId,
        actorUserId: params.userId,
        action: 'LEAVE_CANCELLED',
        entityType: 'LeaveRequest',
        entityId: updated.id,
        metadata: {
          staffProfileId: params.staffProfileId,
          previousStatus: request.status,
          cancelledAt: new Date().toISOString(),
        },
      },
    });

    return updated;
  });
}

// -----------------------------------------------------------------------------
// 9. Admin Manual Leave Creation (Section 8, 9, 40, 45)
// -----------------------------------------------------------------------------
export async function createAdminManualLeave(params: {
  organizationId: string;
  adminUserId: string;
  staffProfileId: string;
  type: LeaveType;
  startDate: Date | string;
  endDate: Date | string;
  reason: string;
  adminComment?: string;
  originUrl?: string;
}) {
  const normStart = normalizeDate(params.startDate);
  const normEnd = normalizeDate(params.endDate);

  if (normStart > normEnd) {
    throw new Error('Start date cannot be after end date.');
  }

  const daysCount = countDaysBetween(normStart, normEnd);
  const year = normStart.getUTCFullYear();

  // Fetch admin and staff
  const [adminUser, staff] = await Promise.all([
    prisma.user.findUnique({ where: { id: params.adminUserId } }),
    prisma.staffProfile.findFirst({
      where: { id: params.staffProfileId, organizationId: params.organizationId },
      include: { user: true, organization: true },
    }),
  ]);

  if (!adminUser || !staff) {
    throw new Error('Admin or Staff profile not found.');
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Balance adjustment if ANNUAL or SICK
    if (params.type === 'ANNUAL' || params.type === 'SICK') {
      let balance = await tx.leaveBalance.findUnique({
        where: {
          staffProfileId_year_leaveType: {
            staffProfileId: params.staffProfileId,
            year,
            leaveType: params.type,
          },
        },
      });

      if (!balance) {
        balance = await tx.leaveBalance.create({
          data: {
            organizationId: params.organizationId,
            staffProfileId: params.staffProfileId,
            year,
            leaveType: params.type,
            entitlement: 12,
            used: 0,
          },
        });
      }

      await tx.leaveBalance.update({
        where: { id: balance.id },
        data: { used: { increment: daysCount } },
      });
    }

    // 2. Create Approved Leave Request with isManualEntry = true
    const leave = await tx.leaveRequest.create({
      data: {
        organizationId: params.organizationId,
        staffProfileId: params.staffProfileId,
        type: params.type,
        startDate: normStart,
        endDate: normEnd,
        daysCount,
        reason: params.reason.trim(),
        status: 'APPROVED',
        isManualEntry: true,
        enteredByAdminId: params.adminUserId,
        reviewerUserId: params.adminUserId,
        reviewedAt: new Date(),
        reviewerComment: params.adminComment?.trim() || 'Manual entry by Administrator',
      },
    });

    // 3. Create Audit Log
    await tx.auditLog.create({
      data: {
        organizationId: params.organizationId,
        actorUserId: params.adminUserId,
        action: 'MANUAL_LEAVE_CREATED',
        entityType: 'LeaveRequest',
        entityId: leave.id,
        metadata: {
          staffProfileId: params.staffProfileId,
          leaveType: params.type,
          startDate: formatUtcDateString(normStart),
          endDate: formatUtcDateString(normEnd),
          daysCount,
          enteredByAdminName: adminUser.name,
          reason: params.reason,
        },
      },
    });

    // 4. Send Staff Email Notification (Non-blocking)
    setTimeout(async () => {
      try {
        if (staff.user.email) {
          const loginUrl = `${params.originUrl || 'https://shiftguard.app'}/${staff.organization.organizationCode}/login`;
          const payload = templateAdminManualLeave({
            orgName: staff.organization.name,
            staffName: staff.name,
            leaveType: params.type,
            dateRange: `${formatUtcDateString(normStart)} to ${formatUtcDateString(normEnd)}`,
            daysCount,
            reason: params.reason,
            adminName: adminUser.name,
            loginUrl,
          });

          await sendEmail({
            organizationId: params.organizationId,
            recipient: staff.user.email,
            type: 'MANUAL_LEAVE_CREATED',
            subject: payload.subject,
            htmlContent: payload.html,
            textContent: payload.text,
          });
        }
      } catch (err) {
        console.error('Non-blocking manual leave email error:', err);
      }
    }, 0);

    return leave;
  }, { timeout: 30000, maxWait: 15000 });
}
