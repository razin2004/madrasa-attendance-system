import { prisma } from '@/lib/prisma';
import { Weekday } from '@prisma/client';

export interface ShiftTimeInterval {
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
  shiftTypeLabel: string;
}

/**
 * Converts "HH:mm" to total minutes from midnight (0 - 1439)
 */
export function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map((num) => parseInt(num, 10));
  return (hours || 0) * 60 + (minutes || 0);
}

/**
 * Checks if two time intervals intersect/overlap.
 * Handles overnight shifts by adding +1440 minutes to end times when End <= Start.
 */
export function doShiftTimesIntersect(
  startAStr: string,
  endAStr: string,
  startBStr: string,
  endBStr: string
): boolean {
  let startA = timeToMinutes(startAStr);
  let endA = timeToMinutes(endAStr);
  if (endA <= startA) {
    endA += 1440; // Overnight shift
  }

  let startB = timeToMinutes(startBStr);
  let endB = timeToMinutes(endBStr);
  if (endB <= startB) {
    endB += 1440; // Overnight shift
  }

  // Two intervals [A1, A2] and [B1, B2] overlap if max(A1, B1) < min(A2, B2)
  const mainOverlap = Math.max(startA, startB) < Math.min(endA, endB);
  if (mainOverlap) return true;

  // Also check wrapping for 24-hour cycle comparison if one interval wraps midnight
  if (endA > 1440) {
    const wrappedStartA = startA - 1440;
    const wrappedEndA = endA - 1440;
    if (Math.max(wrappedStartA, startB) < Math.min(wrappedEndA, endB)) return true;
  }

  if (endB > 1440) {
    const wrappedStartB = startB - 1440;
    const wrappedEndB = endB - 1440;
    if (Math.max(startA, wrappedStartB) < Math.min(endA, wrappedEndB)) return true;
  }

  return false;
}

/**
 * Validates whether a candidate additional shift intersects with any existing regular or additional shift
 * for a specific staff member on a target date.
 */
export async function checkStaffShiftIntersection(params: {
  staffProfileId: string;
  date: Date; // Midnight-normalized UTC date
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
  excludeAdditionalShiftId?: string; // For updates
}): Promise<{ intersects: boolean; reason?: string }> {
  const { staffProfileId, date, startTime, endTime, excludeAdditionalShiftId } = params;

  // 1. Fetch Staff Profile to get Staff Name & ID
  const staff = await prisma.staffProfile.findUnique({
    where: { id: staffProfileId },
    select: { name: true, staffId: true },
  });

  const staffName = staff?.name || 'Staff Member';

  // Format date as YYYY-MM-DD
  const dateStr = date.toISOString().split('T')[0];

  // 2. Fetch existing Additional Shifts on this date
  const existingAdditionalShifts = await prisma.additionalShift.findMany({
    where: {
      staffProfileId,
      date,
      ...(excludeAdditionalShiftId ? { id: { not: excludeAdditionalShiftId } } : {}),
    },
  });

  for (const addShift of existingAdditionalShifts) {
    if (doShiftTimesIntersect(startTime, endTime, addShift.startTime, addShift.endTime)) {
      return {
        intersects: true,
        reason: `Cannot assign additional shift (${startTime}–${endTime}). The shift time for ${dateStr} intersects with existing Additional Shift (${addShift.title || 'Additional Shift'} ${addShift.startTime}–${addShift.endTime}) for ${staffName}.`,
      };
    }
  }

  // 3. Fetch Staff Shift Override on this date
  const shiftOverride = await prisma.staffShiftOverride.findUnique({
    where: {
      staffProfileId_date: {
        staffProfileId,
        date,
      },
    },
  });

  if (shiftOverride) {
    if (!shiftOverride.isHoliday && shiftOverride.startTime && shiftOverride.endTime) {
      if (doShiftTimesIntersect(startTime, endTime, shiftOverride.startTime, shiftOverride.endTime)) {
        return {
          intersects: true,
          reason: `Cannot assign additional shift (${startTime}–${endTime}). The shift time for ${dateStr} intersects with active Shift Override (${shiftOverride.startTime}–${shiftOverride.endTime}) for ${staffName}.`,
        };
      }
    }
  } else {
    // 4. Fetch Regular Assigned Shift Pattern on this weekday
    const activeAssignment = await prisma.shiftAssignment.findFirst({
      where: {
        staffProfileId,
        effectiveFrom: { lte: date },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
      },
      include: {
        shiftPattern: {
          include: {
            weeklyDays: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (activeAssignment?.shiftPattern) {
      const weekdayNames: Weekday[] = [
        'SUNDAY',
        'MONDAY',
        'TUESDAY',
        'WEDNESDAY',
        'THURSDAY',
        'FRIDAY',
        'SATURDAY',
      ];
      const targetWeekday = weekdayNames[date.getUTCDay()];

      const weeklyDay = activeAssignment.shiftPattern.weeklyDays.find(
        (wd) => wd.weekday === targetWeekday
      );

      if (weeklyDay && !weeklyDay.isHoliday && weeklyDay.startTime && weeklyDay.endTime) {
        if (doShiftTimesIntersect(startTime, endTime, weeklyDay.startTime, weeklyDay.endTime)) {
          return {
            intersects: true,
            reason: `Cannot assign additional shift (${startTime}–${endTime}). The shift time for ${dateStr} intersects with Regular Shift (${activeAssignment.shiftPattern.name} ${weeklyDay.startTime}–${weeklyDay.endTime}) for ${staffName}.`,
          };
        }
      }
    }
  }

  return { intersects: false };
}
