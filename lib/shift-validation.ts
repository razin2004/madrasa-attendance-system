import { Weekday } from '@prisma/client';
export { Weekday };

export const ALL_WEEKDAYS: Weekday[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

export interface WeeklyDayInput {
  weekday: Weekday;
  isHoliday: boolean;
  startTime?: string | null;
  endTime?: string | null;
}

export interface ValidatedWeeklyDay {
  weekday: Weekday;
  isHoliday: boolean;
  startTime: string | null;
  endTime: string | null;
  isOvernight: boolean;
}

export interface ShiftPatternValidationResult {
  isValid: boolean;
  errors: string[];
  validatedDays?: ValidatedWeeklyDay[];
}

/**
 * Validate 24-hour time string in "HH:mm" format (00:00 to 23:59)
 */
export function isValidTimeString(timeStr: string | null | undefined): boolean {
  if (!timeStr || typeof timeStr !== 'string') return false;
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(timeStr.trim());
}

/**
 * Check if a time interval crosses midnight (e.g. 22:00 -> 06:00)
 */
export function isOvernightShift(startTime: string, endTime: string): boolean {
  if (!isValidTimeString(startTime) || !isValidTimeString(endTime)) return false;
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  return endMinutes < startMinutes;
}

/**
 * Convert JavaScript Date or ISO string to Weekday enum in target timezone
 */
export function getWeekdayFromDate(date: Date | string, timezone: string = 'Asia/Kolkata'): Weekday {
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
    const [y, m, d] = date.trim().split('-').map(Number);
    const utcDate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    const dayStr = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(utcDate);
    const daysMap: Record<string, Weekday> = {
      Sun: 'SUNDAY',
      Mon: 'MONDAY',
      Tue: 'TUESDAY',
      Wed: 'WEDNESDAY',
      Thu: 'THURSDAY',
      Fri: 'FRIDAY',
      Sat: 'SATURDAY',
    };
    return daysMap[dayStr] || 'MONDAY';
  }

  const d = typeof date === 'string' ? new Date(date) : date;
  const dayStr = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: timezone }).format(d);
  const daysMap: Record<string, Weekday> = {
    Sun: 'SUNDAY',
    Mon: 'MONDAY',
    Tue: 'TUESDAY',
    Wed: 'WEDNESDAY',
    Thu: 'THURSDAY',
    Fri: 'FRIDAY',
    Sat: 'SATURDAY',
  };
  return daysMap[dayStr] || 'MONDAY';
}

/**
 * Format a Date to YYYY-MM-DD string in target timezone
 */
export function formatDateToIsoDay(date: Date | string, timezone: string = 'Asia/Kolkata'): string {
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
    return date.trim();
  }
  const d = typeof date === 'string' ? new Date(date) : date;
  const parts = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: timezone,
  }).formatToParts(d);

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

/**
 * Parse a YYYY-MM-DD string into a midnight Date object
 */
export function parseIsoDayToDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
}

/**
 * Validate full 7-day weekly schedule for a shift pattern
 */
export function validateWeeklyShiftSchedule(days: WeeklyDayInput[]): ShiftPatternValidationResult {
  const errors: string[] = [];

  if (!Array.isArray(days) || days.length !== 7) {
    return {
      isValid: false,
      errors: ['A shift pattern must specify configurations for all 7 weekdays.'],
    };
  }

  const seenDays = new Set<Weekday>();
  const validatedDays: ValidatedWeeklyDay[] = [];

  for (const day of days) {
    if (!ALL_WEEKDAYS.includes(day.weekday)) {
      errors.push(`Invalid weekday provided: "${day.weekday}".`);
      continue;
    }

    if (seenDays.has(day.weekday)) {
      errors.push(`Duplicate configuration provided for weekday: ${day.weekday}.`);
      continue;
    }
    seenDays.add(day.weekday);

    if (day.isHoliday) {
      validatedDays.push({
        weekday: day.weekday,
        isHoliday: true,
        startTime: null,
        endTime: null,
        isOvernight: false,
      });
    } else {
      // Working day
      const cleanStart = day.startTime?.trim() || '';
      const cleanEnd = day.endTime?.trim() || '';

      if (!isValidTimeString(cleanStart)) {
        errors.push(`${day.weekday} is marked as a working day, so a valid start time (HH:mm) is required.`);
      }
      if (!isValidTimeString(cleanEnd)) {
        errors.push(`${day.weekday} is marked as a working day, so a valid end time (HH:mm) is required.`);
      }

      if (cleanStart && cleanEnd && cleanStart === cleanEnd) {
        errors.push(`${day.weekday} start time and end time cannot be identical (${cleanStart}).`);
      }

      const overnight = cleanStart && cleanEnd ? isOvernightShift(cleanStart, cleanEnd) : false;

      validatedDays.push({
        weekday: day.weekday,
        isHoliday: false,
        startTime: cleanStart || null,
        endTime: cleanEnd || null,
        isOvernight: overnight,
      });
    }
  }

  // Ensure all 7 days were covered
  for (const expectedWeekday of ALL_WEEKDAYS) {
    if (!seenDays.has(expectedWeekday)) {
      errors.push(`Missing configuration for ${expectedWeekday}.`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    validatedDays: errors.length === 0 ? validatedDays : undefined,
  };
}
