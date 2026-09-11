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
  activeShift?: {
    id?: string;
    name?: string;
    startTime: string | null;
    endTime: string | null;
    isHoliday?: boolean;
    isOvernight?: boolean;
  } | null;
  allShifts?: Array<{
    id?: string;
    name?: string;
    startTime: string | null;
    endTime: string | null;
    isHoliday?: boolean;
    isOvernight?: boolean;
  }>;
  shifts?: Array<{
    id?: string;
    name?: string;
    startTime: string | null;
    endTime: string | null;
    isHoliday: boolean;
    isOvernight?: boolean;
  }>;
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

export function parseHHMMToMinutes(timeStr: string | null | undefined): number | null {
  if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) return null;
  const [h, m] = timeStr.split(':').map((v) => parseInt(v, 10));
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

export interface DayTimeInterval {
  weekday: Weekday;
  startMin: number;
  endMin: number;
  shiftPatternName: string;
  shiftPatternId: string;
}

export function getPatternTimeIntervals(pattern: {
  id: string;
  name: string;
  weeklyDays: Array<{
    weekday: Weekday;
    isHoliday: boolean;
    startTime: string | null;
    endTime: string | null;
    isOvernight: boolean;
  }>;
}): DayTimeInterval[] {
  const WEEKDAYS_ORDER: Weekday[] = [
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
    'SATURDAY',
    'SUNDAY',
  ];

  const intervals: DayTimeInterval[] = [];

  for (let i = 0; i < WEEKDAYS_ORDER.length; i++) {
    const weekday = WEEKDAYS_ORDER[i];
    const nextWeekday = WEEKDAYS_ORDER[(i + 1) % WEEKDAYS_ORDER.length];

    const dayConfig = pattern.weeklyDays.find((d) => d.weekday === weekday);
    if (!dayConfig || dayConfig.isHoliday) continue;

    const startMin = parseHHMMToMinutes(dayConfig.startTime);
    const endMin = parseHHMMToMinutes(dayConfig.endTime);

    if (startMin === null || endMin === null) continue;

    if (dayConfig.isOvernight || endMin <= startMin) {
      intervals.push({
        weekday,
        startMin,
        endMin: 1440,
        shiftPatternName: pattern.name,
        shiftPatternId: pattern.id,
      });

      if (endMin > 0) {
        intervals.push({
          weekday: nextWeekday,
          startMin: 0,
          endMin,
          shiftPatternName: pattern.name,
          shiftPatternId: pattern.id,
        });
      }
    } else {
      intervals.push({
        weekday,
        startMin,
        endMin,
        shiftPatternName: pattern.name,
        shiftPatternId: pattern.id,
      });
    }
  }

  return intervals;
}

/**
 * Check if a proposed shift assignment conflicts in working hours with existing assignments for a staff member
 */
export async function checkShiftAssignmentConflict(
  staffProfileId: string,
  effectiveFrom: Date,
  effectiveTo: Date | null,
  excludeAssignmentId?: string,
  proposedShiftPatternId?: string
): Promise<ShiftConflictResult> {
  const existingAssignments = await prisma.shiftAssignment.findMany({
    where: {
      staffProfileId,
      id: excludeAssignmentId ? { not: excludeAssignmentId } : undefined,
    },
    include: {
      shiftPattern: {
        include: {
          weeklyDays: true,
        },
      },
    },
  });

  const newStart = new Date(effectiveFrom).getTime();
  const newEnd = effectiveTo ? new Date(effectiveTo).getTime() : Infinity;

  const overlappingDateAssignments = existingAssignments.filter((existing) => {
    const existingStart = new Date(existing.effectiveFrom).getTime();
    const existingEnd = existing.effectiveTo ? new Date(existing.effectiveTo).getTime() : Infinity;
    return existingStart <= newEnd && existingEnd >= newStart;
  });

  if (overlappingDateAssignments.length === 0) {
    return { hasConflict: false };
  }

  if (proposedShiftPatternId) {
    const proposedPattern = await prisma.shiftPattern.findUnique({
      where: { id: proposedShiftPatternId },
      include: { weeklyDays: true },
    });

    if (!proposedPattern) {
      return { hasConflict: true, message: 'Proposed shift pattern not found.' };
    }

    const proposedIntervals = getPatternTimeIntervals(proposedPattern);

    for (const existing of overlappingDateAssignments) {
      if (existing.shiftPatternId === proposedShiftPatternId) {
        return {
          hasConflict: true,
          message: `Shift pattern "${proposedPattern.name}" is already assigned to this staff member.`,
          conflictingAssignment: {
            id: existing.id,
            shiftPatternName: existing.shiftPattern.name,
            effectiveFrom: existing.effectiveFrom,
            effectiveTo: existing.effectiveTo,
          },
        };
      }

      const existingIntervals = getPatternTimeIntervals(existing.shiftPattern);

      for (const pInt of proposedIntervals) {
        for (const eInt of existingIntervals) {
          if (pInt.weekday === eInt.weekday) {
            const timeOverlaps = pInt.startMin < eInt.endMin && pInt.endMin > eInt.startMin;
            if (timeOverlaps) {
              const formatTimeFromMin = (m: number) => {
                const h = Math.floor(m / 60) % 24;
                const min = m % 60;
                return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
              };

              const propTimeStr = `${formatTimeFromMin(pInt.startMin)}–${formatTimeFromMin(pInt.endMin)}`;
              const existTimeStr = `${formatTimeFromMin(eInt.startMin)}–${formatTimeFromMin(eInt.endMin)}`;

              return {
                hasConflict: true,
                message: `Time conflict on ${pInt.weekday}: Proposed shift "${proposedPattern.name}" (${propTimeStr}) overlaps with assigned shift "${existing.shiftPattern.name}" (${existTimeStr}).`,
                conflictingAssignment: {
                  id: existing.id,
                  shiftPatternName: existing.shiftPattern.name,
                  effectiveFrom: existing.effectiveFrom,
                  effectiveTo: existing.effectiveTo,
                },
              };
            }
          }
        }
      }
    }
  } else {
    const targetAssignment = excludeAssignmentId
      ? await prisma.shiftAssignment.findUnique({
          where: { id: excludeAssignmentId },
          include: { shiftPattern: { include: { weeklyDays: true } } },
        })
      : null;

    if (targetAssignment) {
      const targetIntervals = getPatternTimeIntervals(targetAssignment.shiftPattern);
      for (const existing of overlappingDateAssignments) {
        if (existing.id === targetAssignment.id) continue;
        const existingIntervals = getPatternTimeIntervals(existing.shiftPattern);

        for (const tInt of targetIntervals) {
          for (const eInt of existingIntervals) {
            if (tInt.weekday === eInt.weekday) {
              const timeOverlaps = tInt.startMin < eInt.endMin && tInt.endMin > tInt.startMin;
              if (timeOverlaps) {
                return {
                  hasConflict: true,
                  message: `Time conflict on ${tInt.weekday}: Shift "${targetAssignment.shiftPattern.name}" overlaps with assigned shift "${existing.shiftPattern.name}".`,
                  conflictingAssignment: {
                    id: existing.id,
                    shiftPatternName: existing.shiftPattern.name,
                    effectiveFrom: existing.effectiveFrom,
                    effectiveTo: existing.effectiveTo,
                  },
                };
              }
            }
          }
        }
      }
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

  // 2. Find ALL active shift assignments for this target date
  const effectiveAssignments = assignments.filter((a) => {
    if (a.shiftPattern && (a.shiftPattern as any).isActive === false) return false;
    const startIso = formatDateToIsoDay(new Date(a.effectiveFrom));
    const endIso = a.effectiveTo ? formatDateToIsoDay(new Date(a.effectiveTo)) : null;

    const startsOk = dateIso >= startIso;
    const endsOk = !endIso || dateIso <= endIso;

    return startsOk && endsOk;
  });

  if (effectiveAssignments.length === 0 && !override) {
    return {
      date: dateIso,
      weekday,
      isScheduled: false,
      isHoliday: false,
      startTime: null,
      endTime: null,
      isOvernight: false,
      hasOverride: false,
      shifts: [],
    };
  }

  // Apply override if present (override supersedes patterns)
  if (override) {
    return {
      date: dateIso,
      weekday,
      isScheduled: true,
      isHoliday: override.isHoliday,
      startTime: override.isHoliday ? null : override.startTime,
      endTime: override.isHoliday ? null : override.endTime,
      isOvernight: override.isOvernight,
      shiftPatternId: effectiveAssignments[0]?.shiftPattern.id,
      shiftPatternName: effectiveAssignments[0]?.shiftPattern.name,
      minimumStaffingThreshold: effectiveAssignments[0]?.shiftPattern.minimumStaffingThreshold,
      hasOverride: true,
      overrideId: override.id,
      overrideReason: override.reason,
      shifts: override.isHoliday
        ? []
        : [
            {
              id: effectiveAssignments[0]?.shiftPattern.id,
              name: override.reason || 'Override',
              startTime: override.startTime,
              endTime: override.endTime,
              isHoliday: override.isHoliday,
              isOvernight: override.isOvernight,
            },
          ],
    };
  }

  // Collect active day configs for all effective assignments
  const activeShifts: Array<{
    id?: string;
    name?: string;
    startTime: string | null;
    endTime: string | null;
    isHoliday: boolean;
    isOvernight: boolean;
  }> = [];

  for (const assign of effectiveAssignments) {
    const dayConfig = assign.shiftPattern.weeklyDays.find((d) => d.weekday === weekday);
    if (dayConfig) {
      activeShifts.push({
        id: assign.shiftPattern.id,
        name: assign.shiftPattern.name,
        startTime: dayConfig.startTime,
        endTime: dayConfig.endTime,
        isHoliday: dayConfig.isHoliday,
        isOvernight: dayConfig.isOvernight,
      });
    }
  }

  const workShifts = activeShifts.filter((s) => !s.isHoliday && s.startTime && s.endTime);
  const allHolidays = activeShifts.length > 0 && activeShifts.every((s) => s.isHoliday);

  if (workShifts.length === 0) {
    const holidayNames = activeShifts.map((a) => a.name).join(', ');
    return {
      date: dateIso,
      weekday,
      isScheduled: false,
      isHoliday: allHolidays,
      startTime: null,
      endTime: null,
      isOvernight: false,
      shiftPatternId: effectiveAssignments[0]?.shiftPattern.id,
      shiftPatternName: holidayNames || effectiveAssignments[0]?.shiftPattern.name,
      minimumStaffingThreshold: effectiveAssignments[0]?.shiftPattern.minimumStaffingThreshold,
      hasOverride: false,
      shifts: [],
    };
  }

  // Sort work shifts by startTime to determine overall range
  workShifts.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
  const earliestStart = workShifts[0].startTime;
  const latestEnd = workShifts.reduce((max, s) => {
    if (!max || (s.endTime && s.endTime.localeCompare(max) > 0)) return s.endTime;
    return max;
  }, workShifts[0].endTime);
  const isAnyOvernight = workShifts.some((s) => s.isOvernight);

  return {
    date: dateIso,
    weekday,
    isScheduled: true,
    isHoliday: false,
    startTime: earliestStart,
    endTime: latestEnd,
    isOvernight: isAnyOvernight,
    shiftPatternId: workShifts[0]?.id || effectiveAssignments[0]?.shiftPattern.id,
    shiftPatternName: workShifts.map((s) => s.name).filter(Boolean).join(', '),
    minimumStaffingThreshold: effectiveAssignments[0]?.shiftPattern.minimumStaffingThreshold,
    hasOverride: false,
    shifts: workShifts,
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
  // 1. Check time conflict with existing active shifts
  const conflictCheck = await checkShiftAssignmentConflict(
    staffProfileId,
    startDate,
    null,
    undefined,
    shiftPatternId
  );

  if (conflictCheck.hasConflict) {
    throw new Error(conflictCheck.message || 'Shift assignment time conflict detected.');
  }

  // 2. Create the new ShiftAssignment alongside existing active non-conflicting shifts
  return await prisma.shiftAssignment.create({
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

