import { prisma } from '@/lib/prisma';
import { Weekday } from '@prisma/client';
import { getWeekdayFromDate, formatDateToIsoDay, parseIsoDayToDate } from '@/lib/shift-validation';

export interface ShiftConflictResult {
  hasConflict: boolean;
  message?: string;
  conflictingAssignment?: {
    id: string;
    shiftPatternName: string;
    effectiveFrom: Date;
    effectiveTo: Date | null;
  };
}

export interface ScheduledDayResult {
  date: string; // "YYYY-MM-DD"
  weekday: Weekday;
  isScheduled: boolean;
  isHoliday: boolean;
  startTime: string | null;
  endTime: string | null;
  isOvernight: boolean;
  shiftPatternId?: string;
  shiftPatternName?: string;
  minimumStaffingThreshold?: number;
  hasOverride: boolean;
  overrideId?: string;
  overrideReason?: string | null;
}

export interface StaffRosterRow {
  staffId: string;
  profileId: string;
  name: string;
  phone: string;
  status: 'ACTIVE' | 'INACTIVE';
  branches: Array<{ id: string; name: string }>;
  days: ScheduledDayResult[];
}

export interface WeeklyRosterResult {
  startDate: string;
  endDate: string;
  days: Array<{ date: string; weekday: Weekday }>;
  staffRows: StaffRosterRow[];
  summary: {
    totalStaff: number;
    scheduledCountByDay: Record<string, number>;
  };
}

/**
 * Check if a proposed shift assignment conflicts with existing assignments for a staff member (Section 14)
 */
export async function checkShiftAssignmentConflict(
  staffProfileId: string,
  effectiveFrom: Date,
  effectiveTo: Date | null,
  excludeAssignmentId?: string
): Promise<ShiftConflictResult> {
  const existingAssignments = await prisma.shiftAssignment.findMany({
    where: {
      staffProfileId,
      id: excludeAssignmentId ? { not: excludeAssignmentId } : undefined,
    },
    include: {
      shiftPattern: {
        select: {
          name: true,
        },
      },
    },
  });

  const newStart = new Date(effectiveFrom).getTime();
  const newEnd = effectiveTo ? new Date(effectiveTo).getTime() : Infinity;

  for (const existing of existingAssignments) {
    const existingStart = new Date(existing.effectiveFrom).getTime();
    const existingEnd = existing.effectiveTo ? new Date(existing.effectiveTo).getTime() : Infinity;

    // Overlap condition: startA <= endB && endA >= startB
    const overlaps = existingStart <= newEnd && existingEnd >= newStart;

    if (overlaps) {
      const fromStr = existing.effectiveFrom.toISOString().slice(0, 10);
      const toStr = existing.effectiveTo ? existing.effectiveTo.toISOString().slice(0, 10) : 'indefinite';
      return {
        hasConflict: true,
        message: `Shift assignment conflicts with an existing assignment for "${existing.shiftPattern.name}" (${fromStr} to ${toStr}).`,
        conflictingAssignment: {
          id: existing.id,
          shiftPatternName: existing.shiftPattern.name,
          effectiveFrom: existing.effectiveFrom,
          effectiveTo: existing.effectiveTo,
        },
      };
    }
  }

  return { hasConflict: false };
}

/**
 * Calculate scheduled shift for a specific staff member on a specific date (Section 15, 17)
 */
export function calculateStaffDaySchedule(
  date: Date,
  assignments: Array<{
    shiftPatternId: string;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    shiftPattern: {
      id: string;
      name: string;
      minimumStaffingThreshold: number;
      weeklyDays: Array<{
        weekday: Weekday;
        isHoliday: boolean;
        startTime: string | null;
        endTime: string | null;
        isOvernight: boolean;
      }>;
    };
  }>,
  overrides: Array<{
    id: string;
    date: Date;
    isHoliday: boolean;
    startTime: string | null;
    endTime: string | null;
    isOvernight: boolean;
    reason: string | null;
  }>
): ScheduledDayResult {
  const dateIso = formatDateToIsoDay(date);
  const targetTime = date.getTime();
  const weekday = getWeekdayFromDate(date);

  // 1. Check for staff-specific day override first (Section 17)
  const override = overrides.find((o) => {
    const overrideIso = formatDateToIsoDay(new Date(o.date));
    return overrideIso === dateIso;
  });

  // 2. Find active shift assignment for this target date (Historical Preservation - Section 11, 15)
  const effectiveAssignment = assignments.find((a) => {
    const start = new Date(a.effectiveFrom).setHours(0, 0, 0, 0);
    const end = a.effectiveTo ? new Date(a.effectiveTo).setHours(23, 59, 59, 999) : Infinity;
    return targetTime >= start && targetTime <= end;
  });

  if (!effectiveAssignment && !override) {
    return {
      date: dateIso,
      weekday,
      isScheduled: false,
      isHoliday: false,
      startTime: null,
      endTime: null,
      isOvernight: false,
      hasOverride: false,
    };
  }

  // Base schedule from weekly pattern
  let baseHoliday = false;
  let baseStart: string | null = null;
  let baseEnd: string | null = null;
  let baseOvernight = false;

  if (effectiveAssignment) {
    const dayConfig = effectiveAssignment.shiftPattern.weeklyDays.find(
      (d) => d.weekday === weekday
    );
    if (dayConfig) {
      baseHoliday = dayConfig.isHoliday;
      baseStart = dayConfig.startTime;
      baseEnd = dayConfig.endTime;
      baseOvernight = dayConfig.isOvernight;
    }
  }

  // Apply override if present (override supersedes pattern without modifying base pattern)
  if (override) {
    return {
      date: dateIso,
      weekday,
      isScheduled: true,
      isHoliday: override.isHoliday,
      startTime: override.isHoliday ? null : override.startTime,
      endTime: override.isHoliday ? null : override.endTime,
      isOvernight: override.isOvernight,
      shiftPatternId: effectiveAssignment?.shiftPattern.id,
      shiftPatternName: effectiveAssignment?.shiftPattern.name,
      minimumStaffingThreshold: effectiveAssignment?.shiftPattern.minimumStaffingThreshold,
      hasOverride: true,
      overrideId: override.id,
      overrideReason: override.reason,
    };
  }

  return {
    date: dateIso,
    weekday,
    isScheduled: true,
    isHoliday: baseHoliday,
    startTime: baseStart,
    endTime: baseEnd,
    isOvernight: baseOvernight,
    shiftPatternId: effectiveAssignment?.shiftPattern.id,
    shiftPatternName: effectiveAssignment?.shiftPattern.name,
    minimumStaffingThreshold: effectiveAssignment?.shiftPattern.minimumStaffingThreshold,
    hasOverride: false,
  };
}

/**
 * Calculate weekly roster matrix for an organization within a date range (Section 19, 20)
 */
export async function calculateWeeklyRoster(
  organizationId: string,
  startDateStr: string,
  endDateStr: string,
  options?: {
    branchId?: string;
    staffId?: string;
    shiftPatternId?: string;
  }
): Promise<WeeklyRosterResult> {
  const startDate = parseIsoDayToDate(startDateStr);
  const endDate = parseIsoDayToDate(endDateStr);

  // Generate date array
  const dateList: Array<{ date: string; dateObj: Date; weekday: Weekday }> = [];
  const curr = new Date(startDate);
  while (curr <= endDate) {
    dateList.push({
      date: formatDateToIsoDay(curr),
      dateObj: new Date(curr),
      weekday: getWeekdayFromDate(curr),
    });
    curr.setDate(curr.getDate() + 1);
  }

  // Query staff profiles belonging to this organization
  const staffProfiles = await prisma.staffProfile.findMany({
    where: {
      organizationId,
      id: options?.staffId ? options.staffId : undefined,
      branchAssignments: options?.branchId
        ? { some: { branchId: options.branchId } }
        : undefined,
    },
    include: {
      user: { select: { status: true } },
      branchAssignments: {
        include: {
          branch: { select: { id: true, name: true } },
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
          date: {
            gte: startDate,
            lte: new Date(endDate.getTime() + 86400000),
          },
        },
      },
    },
    orderBy: { staffId: 'asc' },
  });

  const staffRows: StaffRosterRow[] = [];
  const scheduledCountByDay: Record<string, number> = {};

  for (const day of dateList) {
    scheduledCountByDay[day.date] = 0;
  }

  for (const profile of staffProfiles) {
    const days: ScheduledDayResult[] = [];

    for (const day of dateList) {
      const schedule = calculateStaffDaySchedule(
        day.dateObj,
        profile.shiftAssignments,
        profile.shiftOverrides
      );

      // Optional shift pattern filter
      if (options?.shiftPatternId && schedule.shiftPatternId !== options.shiftPatternId) {
        // Leave as is or skip
      }

      days.push(schedule);

      if (schedule.isScheduled && !schedule.isHoliday) {
        scheduledCountByDay[day.date] = (scheduledCountByDay[day.date] || 0) + 1;
      }
    }

    staffRows.push({
      staffId: profile.staffId,
      profileId: profile.id,
      name: profile.name,
      phone: profile.phone || '',
      status: profile.user.status as 'ACTIVE' | 'INACTIVE',
      branches: profile.branchAssignments.map((b) => ({ id: b.branch.id, name: b.branch.name })),
      days,
    });
  }

  return {
    startDate: startDateStr,
    endDate: endDateStr,
    days: dateList.map((d) => ({ date: d.date, weekday: d.weekday })),
    staffRows,
    summary: {
      totalStaff: staffProfiles.length,
      scheduledCountByDay,
    },
  };
}

/**
 * Calculate single day roster detail breakdown for an organization (Section 21)
 */
export async function calculateRosterDayDetail(
  organizationId: string,
  dateStr: string,
  branchId?: string
) {
  const date = parseIsoDayToDate(dateStr);
  const weekday = getWeekdayFromDate(date);

  const staffProfiles = await prisma.staffProfile.findMany({
    where: {
      organizationId,
      branchAssignments: branchId ? { some: { branchId } } : undefined,
    },
    include: {
      user: { select: { status: true } },
      branchAssignments: {
        include: {
          branch: { select: { id: true, name: true } },
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
          date: {
            gte: new Date(date.setHours(0, 0, 0, 0)),
            lte: new Date(date.setHours(23, 59, 59, 999)),
          },
        },
      },
    },
    orderBy: { staffId: 'asc' },
  });

  const staffDetails = staffProfiles.map((p) => {
    const schedule = calculateStaffDaySchedule(date, p.shiftAssignments, p.shiftOverrides);
    return {
      profileId: p.id,
      staffId: p.staffId,
      name: p.name,
      phone: p.phone || '',
      accountStatus: p.user.status,
      branches: p.branchAssignments.map((b) => ({ id: b.branch.id, name: b.branch.name })),
      schedule,
    };
  });

  const workingStaff = staffDetails.filter((s) => s.schedule.isScheduled && !s.schedule.isHoliday);
  const holidayStaff = staffDetails.filter((s) => s.schedule.isScheduled && s.schedule.isHoliday);
  const unassignedStaff = staffDetails.filter((s) => !s.schedule.isScheduled);

  return {
    date: dateStr,
    weekday,
    counts: {
      totalStaff: staffDetails.length,
      workingStaff: workingStaff.length,
      holidayStaff: holidayStaff.length,
      unassignedStaff: unassignedStaff.length,
    },
    workingStaff,
    holidayStaff,
    unassignedStaff,
  };
}

/**
 * Assign or update a staff member's shift assignment with an effective-from date.
 * Automatically closes previous active assignments without overwriting historical data.
 */
export async function assignOrUpdateStaffShift(params: {
  staffProfileId: string;
  shiftPatternId: string;
  effectiveFrom: Date;
  assignedBy?: string | null;
}) {
  const { staffProfileId, shiftPatternId, effectiveFrom, assignedBy } = params;

  // Normalize effectiveFrom to 00:00:00.000
  const startDate = new Date(effectiveFrom);
  startDate.setHours(0, 0, 0, 0);

  // Day before effectiveFrom for closing previous active assignment
  const dayBefore = new Date(startDate);
  dayBefore.setDate(dayBefore.getDate() - 1);
  dayBefore.setHours(23, 59, 59, 999);

  return await prisma.$transaction(async (tx) => {
    // 1. Find any currently active assignment (effectiveTo is null or >= startDate)
    const existingActive = await tx.shiftAssignment.findMany({
      where: {
        staffProfileId,
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: startDate } },
        ],
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    for (const assignment of existingActive) {
      if (assignment.effectiveFrom >= startDate) {
        // Future assignment starting on or after new startDate -> replace/remove
        await tx.shiftAssignment.delete({ where: { id: assignment.id } });
      } else {
        // Active assignment starting before new startDate -> cap effectiveTo to dayBefore
        await tx.shiftAssignment.update({
          where: { id: assignment.id },
          data: { effectiveTo: dayBefore },
        });
      }
    }

    // 2. Create the new ShiftAssignment starting at effectiveFrom with no end date
    const newAssignment = await tx.shiftAssignment.create({
      data: {
        staffProfileId,
        shiftPatternId,
        effectiveFrom: startDate,
        effectiveTo: null,
        assignedBy: assignedBy || null,
      },
      include: {
        shiftPattern: {
          include: {
            weeklyDays: true,
          },
        },
      },
    });

    return newAssignment;
  });
}

/**
 * Retrieve complete shift assignment history for a staff profile
 */
export async function getStaffShiftAssignmentHistory(staffProfileId: string) {
  return await prisma.shiftAssignment.findMany({
    where: { staffProfileId },
    orderBy: { effectiveFrom: 'desc' },
    include: {
      shiftPattern: {
        include: {
          weeklyDays: true,
        },
      },
    },
  });
}

/**
 * Calculate shift staffing availability and minimum threshold shortage for a given shift pattern and date
 */
export async function calculateShiftStaffingShortage(
  organizationId: string,
  shiftPatternId: string,
  targetDate: Date
) {
  const normDate = new Date(targetDate);
  normDate.setHours(0, 0, 0, 0);

  const pattern = await prisma.shiftPattern.findFirst({
    where: { id: shiftPatternId, organizationId },
    include: { weeklyDays: true },
  });

  if (!pattern) {
    return null;
  }

  // Find all active shift assignments for this pattern on targetDate
  const assignments = await prisma.shiftAssignment.findMany({
    where: {
      shiftPatternId,
      effectiveFrom: { lte: normDate },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: normDate } }],
    },
    include: {
      staffProfile: {
        include: {
          user: { select: { status: true } },
          leaveRequests: {
            where: {
              status: 'APPROVED',
              startDate: { lte: normDate },
              endDate: { gte: normDate },
            },
          },
        },
      },
    },
  });

  const activeStaffAssignments = assignments.filter(
    (a) => a.staffProfile.user.status === 'ACTIVE'
  );

  const totalAssigned = activeStaffAssignments.length;
  const approvedLeave = activeStaffAssignments.filter(
    (a) => a.staffProfile.leaveRequests.length > 0
  ).length;

  const availableStaff = totalAssigned - approvedLeave;
  const minStaffing = pattern.minimumStaffingThreshold;
  const isShortage = availableStaff < minStaffing;

  return {
    shiftPatternId: pattern.id,
    shiftPatternName: pattern.name,
    totalAssigned,
    approvedLeave,
    availableStaff,
    minimumStaffingThreshold: minStaffing,
    isShortage,
    shortageCount: isShortage ? minStaffing - availableStaff : 0,
  };
}

