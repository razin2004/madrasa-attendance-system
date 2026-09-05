import { prisma } from '@/lib/prisma';
import { calculateStaffDaySchedule } from './roster.service';
import { AttendanceSource, LeaveType, Weekday } from '@prisma/client';
import { formatUtcDateString, normalizeDate } from './attendance.service';

export interface DailyReportFilterParams {
  organizationId: string;
  date: string; // "YYYY-MM-DD"
  branchId?: string;
  staffId?: string;
  status?: string;
  source?: AttendanceSource;
  search?: string;
}

export interface MonthlyReportFilterParams {
  organizationId: string;
  year: number;
  month: number; // 1 - 12
  staffId?: string;
  branchId?: string;
  status?: string;
  source?: AttendanceSource;
}

export interface DateRangeReportFilterParams {
  organizationId: string;
  startDate: string; // "YYYY-MM-DD"
  endDate: string;   // "YYYY-MM-DD"
  branchId?: string;
  staffId?: string;
  status?: string;
  source?: AttendanceSource;
  search?: string;
}

export interface AttendanceReportRow {
  staffProfileId: string;
  staffId: string;
  staffName: string;
  staffPhone: string;
  accountStatus: string;
  date: string; // "YYYY-MM-DD"
  dayOfWeek: string;
  branchId: string | null;
  branchName: string;
  shiftPatternName: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  isOvernight: boolean;
  isRosterHoliday: boolean;
  clockInTime: string | null;
  clockOutTime: string | null;
  clockInIso: string | null;
  clockOutIso: string | null;
  status:
    | 'PRESENT'
    | 'PARTIAL'
    | 'HOLIDAY'
    | 'APPROVED LEAVE'
    | 'ABSENT'
    | 'NOT YET CLOCKED IN'
    | 'IN PROGRESS'
    | 'OFF DUTY';
  source: AttendanceSource | '—';
  leaveType: LeaveType | null;
  leaveTypeName: string | null;
  leaveReason: string | null;
  hasConflict: boolean;
  conflictDetails: string | null;
  manualReason: string | null;
  creatorName: string | null;
  reviewerName: string | null;
  adjustmentReason: string | null;
}

export interface ReportMetricsSummary {
  totalCount: number;
  presentCount: number;
  partialCount: number;
  holidayCount: number;
  leaveCount: number;
  annualLeaveCount: number;
  sickLeaveCount: number;
  dutyLeaveCount: number;
  otherLeaveCount: number;
  absentCount: number;
  notYetClockedInCount: number;
  inProgressCount: number;
  sourceMetrics: {
    normalCount: number;
    manualCount: number;
    adjustedCount: number;
  };
}

/**
 * Helper to parse YYYY-MM-DD into a UTC midnight Date
 */

export function parseIsoDateString(dateStr: string): Date {
  const parts = dateStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
}

/**
 * 1. Calculate Daily Attendance Report (Section 6 - 20, 28 - 35)
 */
export async function getDailyAttendanceReport(params: DailyReportFilterParams) {
  const targetDateObj = parseIsoDateString(params.date);
  const startOfDay = new Date(targetDateObj.getTime());
  const endOfDay = new Date(targetDateObj.getTime() + 24 * 60 * 60 * 1000 - 1);
  const dateStr = params.date;
  const now = new Date();

  const isToday =
    now.getUTCFullYear() === targetDateObj.getUTCFullYear() &&
    now.getUTCMonth() === targetDateObj.getUTCMonth() &&
    now.getUTCDate() === targetDateObj.getUTCDate();

  // Query staff profiles (including historical/inactive staff) scoped strictly by organizationId
  const staffProfiles = await prisma.staffProfile.findMany({
    where: {
      organizationId: params.organizationId,
      id: params.staffId ? params.staffId : undefined,
      branchAssignments: params.branchId
        ? { some: { branchId: params.branchId } }
        : undefined,
    },
    include: {
      user: { select: { id: true, name: true, status: true, email: true } },
      branchAssignments: {
        include: {
          branch: { select: { id: true, name: true, status: true } },
        },
      },
      shiftAssignments: {
        include: {
          shiftPattern: {
            include: {
              weeklyDays: true,
            },
          },
        },
      },
      shiftOverrides: {
        where: {
          date: { gte: startOfDay, lte: endOfDay },
        },
      },
    },
    orderBy: { staffId: 'asc' },
  });

  // Apply optional search filter
  let filteredProfiles = staffProfiles;
  if (params.search?.trim()) {
    const q = params.search.trim().toLowerCase();
    filteredProfiles = staffProfiles.filter(
      (p) => p.name.toLowerCase().includes(q) || p.staffId.toLowerCase().includes(q)
    );
  }

  const profileIds = filteredProfiles.map((p) => p.id);

  // Query AttendanceRecords for the target date
  const attendanceRecords = await prisma.attendanceRecord.findMany({
    where: {
      organizationId: params.organizationId,
      staffProfileId: { in: profileIds },
      timestamp: { gte: startOfDay, lte: endOfDay },
      verificationStatus: 'VERIFIED',
    },
    include: {
      branch: { select: { id: true, name: true } },
      creatorUser: { select: { id: true, name: true } },
      correctionRequest: {
        include: {
          reviewerUser: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { timestamp: 'asc' },
  });

  // Query Approved LeaveRequests for the target date
  const approvedLeaves = await prisma.leaveRequest.findMany({
    where: {
      organizationId: params.organizationId,
      staffProfileId: { in: profileIds },
      status: 'APPROVED',
      startDate: { lte: endOfDay },
      endDate: { gte: startOfDay },
    },
    include: {
      reviewerUser: { select: { id: true, name: true } },
    },
  });

  const rows: AttendanceReportRow[] = [];

  const metrics: ReportMetricsSummary = {
    totalCount: 0,
    presentCount: 0,
    partialCount: 0,
    holidayCount: 0,
    leaveCount: 0,
    annualLeaveCount: 0,
    sickLeaveCount: 0,
    dutyLeaveCount: 0,
    otherLeaveCount: 0,
    absentCount: 0,
    notYetClockedInCount: 0,
    inProgressCount: 0,
    sourceMetrics: {
      normalCount: 0,
      manualCount: 0,
      adjustedCount: 0,
    },
  };

  const weekdaysMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayOfWeek = weekdaysMap[targetDateObj.getUTCDay()];

  for (const profile of filteredProfiles) {
    // 1. Calculate roster schedule for date
    const schedule = calculateStaffDaySchedule(
      targetDateObj,
      profile.shiftAssignments,
      profile.shiftOverrides
    );

    // 2. Extract attendance records for this profile
    const staffRecords = attendanceRecords.filter((r) => r.staffProfileId === profile.id);
    const clockInRecord = staffRecords.find((r) => r.type === 'CLOCK_IN');
    const clockOutRecord = staffRecords.find((r) => r.type === 'CLOCK_OUT');

    // 3. Extract approved leave for this profile
    const staffLeave = approvedLeaves.find((l) => l.staffProfileId === profile.id);

    // 4. Determine Historical Branch
    let branchId = params.branchId || null;
    let branchName = 'Unassigned';

    const recordedBranch = clockInRecord?.branch || clockOutRecord?.branch;
    if (recordedBranch) {
      branchId = recordedBranch.id;
      branchName = recordedBranch.name;
    } else if (profile.branchAssignments.length > 0) {
      branchId = profile.branchAssignments[0].branch.id;
      branchName = profile.branchAssignments[0].branch.name;
    }

    // Filter by branchId if branch filter was passed and doesn't match
    if (params.branchId && branchId !== params.branchId) {
      continue;
    }

    // 5. Source Determination
    let source: AttendanceSource | '—' = '—';
    if (clockInRecord?.source) {
      source = clockInRecord.source;
    } else if (clockOutRecord?.source) {
      source = clockOutRecord.source;
    }

    // 6. Status Determination
    let status: AttendanceReportRow['status'] = 'OFF DUTY';
    let hasConflict = false;
    let conflictDetails: string | null = null;

    const hasClockIn = Boolean(clockInRecord);
    const hasClockOut = Boolean(clockOutRecord);

    if (hasClockIn && hasClockOut) {
      status = 'PRESENT';
      if (staffLeave) {
        hasConflict = true;
        conflictDetails = `Staff clocked in (${clockInRecord?.timestamp.toISOString().slice(11, 16)}) despite approved ${staffLeave.type} Leave. Both records preserved.`;
      }
    } else if (hasClockIn || hasClockOut) {
      if (isToday) {
        // Current day ongoing check
        status = 'IN PROGRESS';
      } else {
        status = 'PARTIAL';
      }

      if (staffLeave) {
        hasConflict = true;
        conflictDetails = `Partial punch recorded alongside approved ${staffLeave.type} Leave.`;
      }
    } else if (staffLeave) {
      status = 'APPROVED LEAVE';
    } else if (schedule.isHoliday) {
      status = 'HOLIDAY';
    } else if (!schedule.isScheduled) {
      status = 'OFF DUTY';
    } else {
      // Scheduled to work, no punches, no leave, not holiday
      const targetDateMidnight = new Date(Date.UTC(targetDateObj.getUTCFullYear(), targetDateObj.getUTCMonth(), targetDateObj.getUTCDate()));
      const todayMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

      if (targetDateMidnight.getTime() > todayMidnight.getTime()) {
        // Future date: NOT YET CLOCKED IN, never ABSENT
        status = 'NOT YET CLOCKED IN';
      } else if (isToday) {
        // Current day ongoing check
        const shiftEndHour = schedule.endTime ? parseInt(schedule.endTime.split(':')[0], 10) : 17;
        const nowHour = now.getUTCHours();
        if (nowHour < shiftEndHour) {
          status = 'NOT YET CLOCKED IN';
        } else {
          status = 'ABSENT';
        }
      } else {
        status = 'ABSENT';
      }
    }

    // Optional status / source UI filters
    if (params.status && params.status !== 'ALL') {
      if (params.status === 'LEAVE' && status !== 'APPROVED LEAVE') continue;
      else if (params.status !== 'LEAVE' && status !== params.status) continue;
    }

    if (params.source && params.source !== source) {
      continue;
    }

    // Metadata extraction
    let manualReason: string | null = null;
    let creatorName: string | null = null;
    let reviewerName: string | null = null;
    let adjustmentReason: string | null = null;

    if (clockInRecord?.isManualEntry || clockOutRecord?.isManualEntry) {
      manualReason = clockInRecord?.manualReason || clockOutRecord?.manualReason || null;
      creatorName = clockInRecord?.creatorUser?.name || clockOutRecord?.creatorUser?.name || null;
    }

    if (clockInRecord?.correctionRequest || clockOutRecord?.correctionRequest) {
      const cr = clockInRecord?.correctionRequest || clockOutRecord?.correctionRequest;
      adjustmentReason = cr?.reason || null;
      reviewerName = cr?.reviewerUser?.name || null;
    }

    // Metrics aggregation
    metrics.totalCount++;
    if (status === 'PRESENT') metrics.presentCount++;
    else if (status === 'PARTIAL') metrics.partialCount++;
    else if (status === 'HOLIDAY') metrics.holidayCount++;
    else if (status === 'APPROVED LEAVE') {
      metrics.leaveCount++;
      if (staffLeave?.type === 'ANNUAL') metrics.annualLeaveCount++;
      else if (staffLeave?.type === 'SICK') metrics.sickLeaveCount++;
      else if (staffLeave?.type === 'DUTY') metrics.dutyLeaveCount++;
      else metrics.otherLeaveCount++;
    } else if (status === 'ABSENT') metrics.absentCount++;
    else if (status === 'NOT YET CLOCKED IN') metrics.notYetClockedInCount++;
    else if (status === 'IN PROGRESS') metrics.inProgressCount++;

    if (source === 'NORMAL') metrics.sourceMetrics.normalCount++;
    else if (source === 'MANUAL') metrics.sourceMetrics.manualCount++;
    else if (source === 'ADJUSTED') metrics.sourceMetrics.adjustedCount++;

    rows.push({
      staffProfileId: profile.id,
      staffId: profile.staffId,
      staffName: profile.name,
      staffPhone: profile.phone || '',
      accountStatus: profile.user.status,
      date: dateStr,
      dayOfWeek,
      branchId,
      branchName,
      shiftPatternName: schedule.shiftPatternName || 'Default Shift',
      scheduledStart: schedule.startTime,
      scheduledEnd: schedule.endTime,
      isOvernight: schedule.isOvernight,
      isRosterHoliday: schedule.isHoliday,
      clockInTime: clockInRecord ? clockInRecord.timestamp.toISOString().slice(11, 16) : null,
      clockOutTime: clockOutRecord ? clockOutRecord.timestamp.toISOString().slice(11, 16) : null,
      clockInIso: clockInRecord?.timestamp.toISOString() || null,
      clockOutIso: clockOutRecord?.timestamp.toISOString() || null,
      status,
      source,
      leaveType: staffLeave?.type || null,
      leaveTypeName: staffLeave ? `${staffLeave.type} LEAVE` : null,
      leaveReason: staffLeave?.reason || null,
      hasConflict,
      conflictDetails,
      manualReason,
      creatorName,
      reviewerName,
      adjustmentReason,
    });
  }

  return {
    date: dateStr,
    dayOfWeek,
    metrics,
    rows,
  };
}

/**
 * 2. Calculate Monthly Employee Attendance Report (Section 21, 22, 23)
 */
export async function getMonthlyEmployeeAttendanceReport(params: MonthlyReportFilterParams) {
  const { organizationId, year, month, staffId, branchId } = params;

  // Determine staff member to evaluate
  let targetStaffProfileId = staffId;
  if (!targetStaffProfileId) {
    const firstStaff = await prisma.staffProfile.findFirst({
      where: { organizationId },
      orderBy: { staffId: 'asc' },
    });
    if (!firstStaff) {
      throw new Error('No staff members found for this organization.');
    }
    targetStaffProfileId = firstStaff.id;
  }

  const staffProfile = await prisma.staffProfile.findFirst({
    where: { id: targetStaffProfileId, organizationId },
    include: {
      user: { select: { id: true, name: true, email: true, status: true } },
      branchAssignments: { include: { branch: true } },
    },
  });

  if (!staffProfile) {
    throw new Error('Staff profile not found.');
  }

  // Calculate start & end of selected month in UTC
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const startOfMonth = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const endOfMonth = new Date(Date.UTC(year, month - 1, daysInMonth, 23, 59, 59, 999));

  // Query staff shift assignments and overrides for schedule calculation
  const staffFull = await prisma.staffProfile.findFirst({
    where: { id: targetStaffProfileId, organizationId },
    include: {
      user: { select: { id: true, name: true, email: true, status: true } },
      branchAssignments: { include: { branch: true } },
      shiftAssignments: {
        include: {
          shiftPattern: {
            include: { weeklyDays: true },
          },
        },
      },
      shiftOverrides: {
        where: {
          date: { gte: startOfMonth, lte: endOfMonth },
        },
      },
    },
  });

  if (!staffFull) {
    throw new Error('Staff profile not found.');
  }

  // Batch query all attendance records for the entire month in 1 DB query
  const monthAttendanceRecords = await prisma.attendanceRecord.findMany({
    where: {
      organizationId,
      staffProfileId: targetStaffProfileId,
      timestamp: { gte: startOfMonth, lte: endOfMonth },
      verificationStatus: 'VERIFIED',
    },
    include: {
      branch: { select: { id: true, name: true } },
      creatorUser: { select: { id: true, name: true } },
      correctionRequest: {
        include: { reviewerUser: { select: { id: true, name: true } } },
      },
    },
    orderBy: { timestamp: 'asc' },
  });

  // Batch query all approved leave requests for the entire month in 1 DB query
  const monthApprovedLeaves = await prisma.leaveRequest.findMany({
    where: {
      organizationId,
      staffProfileId: targetStaffProfileId,
      status: 'APPROVED',
      startDate: { lte: endOfMonth },
      endDate: { gte: startOfMonth },
    },
  });

  const daysRows: AttendanceReportRow[] = [];
  const weekdaysMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const now = new Date();

  for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
    const targetDateObj = new Date(Date.UTC(year, month - 1, dayNum, 0, 0, 0, 0));
    const dayStart = new Date(targetDateObj.getTime());
    const dayEnd = new Date(targetDateObj.getTime() + 24 * 60 * 60 * 1000 - 1);
    const dayStr = `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    const dayOfWeek = weekdaysMap[targetDateObj.getUTCDay()];

    const isToday =
      now.getUTCFullYear() === targetDateObj.getUTCFullYear() &&
      now.getUTCMonth() === targetDateObj.getUTCMonth() &&
      now.getUTCDate() === targetDateObj.getUTCDate();

    // 1. Roster schedule for day
    const schedule = calculateStaffDaySchedule(
      targetDateObj,
      staffFull.shiftAssignments,
      staffFull.shiftOverrides
    );

    // 2. Attendance records for day
    const dayRecords = monthAttendanceRecords.filter(
      (r) => r.timestamp >= dayStart && r.timestamp <= dayEnd
    );
    const clockInRecord = dayRecords.find((r) => r.type === 'CLOCK_IN');
    const clockOutRecord = dayRecords.find((r) => r.type === 'CLOCK_OUT');

    // 3. Approved leave for day
    const dayLeave = monthApprovedLeaves.find(
      (l) => l.startDate <= dayEnd && l.endDate >= dayStart
    );

    // 4. Branch
    let rowBranchId = branchId || null;
    let rowBranchName = 'Unassigned';
    const recordedBranch = clockInRecord?.branch || clockOutRecord?.branch;
    if (recordedBranch) {
      rowBranchId = recordedBranch.id;
      rowBranchName = recordedBranch.name;
    } else if (staffFull.branchAssignments.length > 0) {
      rowBranchId = staffFull.branchAssignments[0].branch.id;
      rowBranchName = staffFull.branchAssignments[0].branch.name;
    }

    if (branchId && rowBranchId !== branchId) {
      continue;
    }

    // 5. Source
    let rowSource: AttendanceSource | '—' = '—';
    if (clockInRecord?.source) rowSource = clockInRecord.source;
    else if (clockOutRecord?.source) rowSource = clockOutRecord.source;

    // 6. Status
    let rowStatus: AttendanceReportRow['status'] = 'OFF DUTY';
    let hasConflict = false;
    let conflictDetails: string | null = null;

    const hasClockIn = Boolean(clockInRecord);
    const hasClockOut = Boolean(clockOutRecord);

    if (hasClockIn && hasClockOut) {
      rowStatus = 'PRESENT';
      if (dayLeave) {
        hasConflict = true;
        conflictDetails = `Staff clocked in despite approved ${dayLeave.type} Leave. Both records preserved.`;
      }
    } else if (hasClockIn || hasClockOut) {
      rowStatus = isToday ? 'IN PROGRESS' : 'PARTIAL';
      if (dayLeave) {
        hasConflict = true;
        conflictDetails = `Partial punch recorded alongside approved ${dayLeave.type} Leave.`;
      }
    } else if (dayLeave) {
      rowStatus = 'APPROVED LEAVE';
    } else if (schedule.isHoliday) {
      rowStatus = 'HOLIDAY';
    } else if (!schedule.isScheduled) {
      rowStatus = 'OFF DUTY';
    } else {
      const targetDateMidnight = new Date(Date.UTC(targetDateObj.getUTCFullYear(), targetDateObj.getUTCMonth(), targetDateObj.getUTCDate()));
      const todayMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

      if (targetDateMidnight.getTime() > todayMidnight.getTime()) {
        // Future date: NOT YET CLOCKED IN, never ABSENT
        rowStatus = 'NOT YET CLOCKED IN';
      } else if (isToday) {
        const shiftEndHour = schedule.endTime ? parseInt(schedule.endTime.split(':')[0], 10) : 17;
        rowStatus = now.getUTCHours() < shiftEndHour ? 'NOT YET CLOCKED IN' : 'ABSENT';
      } else {
        rowStatus = 'ABSENT';
      }
    }

    if (params.status && params.status !== 'ALL') {
      if (params.status === 'LEAVE' && rowStatus !== 'APPROVED LEAVE') continue;
      else if (params.status !== 'LEAVE' && rowStatus !== params.status) continue;
    }

    if (params.source && params.source !== rowSource) {
      continue;
    }

    let manualReason: string | null = null;
    let creatorName: string | null = null;
    let reviewerName: string | null = null;
    let adjustmentReason: string | null = null;

    if (clockInRecord?.isManualEntry || clockOutRecord?.isManualEntry) {
      manualReason = clockInRecord?.manualReason || clockOutRecord?.manualReason || null;
      creatorName = clockInRecord?.creatorUser?.name || clockOutRecord?.creatorUser?.name || null;
    }

    if (clockInRecord?.correctionRequest || clockOutRecord?.correctionRequest) {
      const cr = clockInRecord?.correctionRequest || clockOutRecord?.correctionRequest;
      adjustmentReason = cr?.reason || null;
      reviewerName = cr?.reviewerUser?.name || null;
    }

    daysRows.push({
      staffProfileId: staffFull.id,
      staffId: staffFull.staffId,
      staffName: staffFull.name,
      staffPhone: staffFull.phone || '',
      accountStatus: staffFull.user.status,
      date: dayStr,
      dayOfWeek,
      branchId: rowBranchId,
      branchName: rowBranchName,
      shiftPatternName: schedule.shiftPatternName || 'Default Shift',
      scheduledStart: schedule.startTime,
      scheduledEnd: schedule.endTime,
      isOvernight: schedule.isOvernight,
      isRosterHoliday: schedule.isHoliday,
      clockInTime: clockInRecord ? clockInRecord.timestamp.toISOString().slice(11, 16) : null,
      clockOutTime: clockOutRecord ? clockOutRecord.timestamp.toISOString().slice(11, 16) : null,
      clockInIso: clockInRecord?.timestamp.toISOString() || null,
      clockOutIso: clockOutRecord?.timestamp.toISOString() || null,
      status: rowStatus,
      source: rowSource,
      leaveType: dayLeave?.type || null,
      leaveTypeName: dayLeave ? `${dayLeave.type} LEAVE` : null,
      leaveReason: dayLeave?.reason || null,
      hasConflict,
      conflictDetails,
      manualReason,
      creatorName,
      reviewerName,
      adjustmentReason,
    });
  }

  // Aggregate Monthly Summary Metrics
  const monthlyMetrics = {
    year,
    month,
    daysInMonth,
    workingDaysCount: daysRows.filter((r) => r.status !== 'HOLIDAY' && r.status !== 'OFF DUTY').length,
    presentDaysCount: daysRows.filter((r) => r.status === 'PRESENT').length,
    partialDaysCount: daysRows.filter((r) => r.status === 'PARTIAL').length,
    holidayDaysCount: daysRows.filter((r) => r.status === 'HOLIDAY').length,
    leaveDaysCount: daysRows.filter((r) => r.status === 'APPROVED LEAVE').length,
    annualLeaveCount: daysRows.filter((r) => r.status === 'APPROVED LEAVE' && r.leaveType === 'ANNUAL').length,
    sickLeaveCount: daysRows.filter((r) => r.status === 'APPROVED LEAVE' && r.leaveType === 'SICK').length,
    dutyLeaveCount: daysRows.filter((r) => r.status === 'APPROVED LEAVE' && r.leaveType === 'DUTY').length,
    otherLeaveCount: daysRows.filter((r) => r.status === 'APPROVED LEAVE' && r.leaveType === 'OTHER').length,
    absentDaysCount: daysRows.filter((r) => r.status === 'ABSENT').length,
    normalEntriesCount: daysRows.filter((r) => r.source === 'NORMAL').length,
    manualEntriesCount: daysRows.filter((r) => r.source === 'MANUAL').length,
    adjustedEntriesCount: daysRows.filter((r) => r.source === 'ADJUSTED').length,
  };

  return {
    staff: {
      id: staffProfile.id,
      staffId: staffProfile.staffId,
      name: staffProfile.name,
      phone: staffProfile.phone || '',
      accountStatus: staffProfile.user.status,
      defaultBranch: staffProfile.branchAssignments[0]?.branch.name || 'Unassigned',
    },
    monthlyMetrics,
    daysRows,
  };
}

/**
 * 3. Reports Dashboard Landing Summary (Section 5)
 */
export async function getReportsDashboardSummary(organizationId: string) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;

  const todayReport = await getDailyAttendanceReport({
    organizationId,
    date: todayStr,
  });

  const [activeBranchesCount, totalStaffCount] = await Promise.all([
    prisma.branch.count({ where: { organizationId, status: 'ACTIVE' } }),
    prisma.staffProfile.count({ where: { organizationId } }),
  ]);

  return {
    todayDate: todayStr,
    activeBranchesCount,
    totalStaffCount,
    todayMetrics: todayReport.metrics,
    currentYear: year,
    currentMonth: month,
  };
}

/**
 * 4. Calculate Custom Date-Range Attendance Report
 */
export async function getDateRangeAttendanceReport(params: DateRangeReportFilterParams) {
  const startUtc = parseIsoDateString(params.startDate);
  const endUtc = parseIsoDateString(params.endDate);

  if (startUtc.getTime() > endUtc.getTime()) {
    throw new Error('Start date cannot be after end date.');
  }

  // Cap at 90 days max for custom range performance
  const diffDays = Math.ceil((endUtc.getTime() - startUtc.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  if (diffDays > 90) {
    throw new Error('Custom date range cannot exceed 90 days. Please select a shorter date range.');
  }

  const overallRows: AttendanceReportRow[] = [];
  const combinedMetrics: ReportMetricsSummary = {
    totalCount: 0,
    presentCount: 0,
    partialCount: 0,
    holidayCount: 0,
    leaveCount: 0,
    annualLeaveCount: 0,
    sickLeaveCount: 0,
    dutyLeaveCount: 0,
    otherLeaveCount: 0,
    absentCount: 0,
    notYetClockedInCount: 0,
    inProgressCount: 0,
    sourceMetrics: {
      normalCount: 0,
      manualCount: 0,
      adjustedCount: 0,
    },
  };

  // Loop day-by-day across the date range
  for (let i = 0; i < diffDays; i++) {
    const currDateObj = new Date(startUtc.getTime() + i * 24 * 60 * 60 * 1000);
    const currDateStr = currDateObj.toISOString().slice(0, 10);

    const dailyResult = await getDailyAttendanceReport({
      organizationId: params.organizationId,
      date: currDateStr,
      branchId: params.branchId,
      staffId: params.staffId,
      status: params.status,
      source: params.source,
      search: params.search,
    });

    overallRows.push(...dailyResult.rows);

    combinedMetrics.totalCount += dailyResult.metrics.totalCount;
    combinedMetrics.presentCount += dailyResult.metrics.presentCount;
    combinedMetrics.partialCount += dailyResult.metrics.partialCount;
    combinedMetrics.holidayCount += dailyResult.metrics.holidayCount;
    combinedMetrics.leaveCount += dailyResult.metrics.leaveCount;
    combinedMetrics.annualLeaveCount += dailyResult.metrics.annualLeaveCount;
    combinedMetrics.sickLeaveCount += dailyResult.metrics.sickLeaveCount;
    combinedMetrics.dutyLeaveCount += dailyResult.metrics.dutyLeaveCount;
    combinedMetrics.otherLeaveCount += dailyResult.metrics.otherLeaveCount;
    combinedMetrics.absentCount += dailyResult.metrics.absentCount;
    combinedMetrics.notYetClockedInCount += dailyResult.metrics.notYetClockedInCount;
    combinedMetrics.inProgressCount += dailyResult.metrics.inProgressCount;
    combinedMetrics.sourceMetrics.normalCount += dailyResult.metrics.sourceMetrics.normalCount;
    combinedMetrics.sourceMetrics.manualCount += dailyResult.metrics.sourceMetrics.manualCount;
    combinedMetrics.sourceMetrics.adjustedCount += dailyResult.metrics.sourceMetrics.adjustedCount;
  }

  return {
    startDate: params.startDate,
    endDate: params.endDate,
    totalDays: diffDays,
    metrics: combinedMetrics,
    rows: overallRows,
  };
}
