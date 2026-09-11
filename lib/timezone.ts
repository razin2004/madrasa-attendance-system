/**
 * Standard Native Date & Time Formatting Utilities
 * Handles standard local web application date and time formatting with IANA timezone support.
 */

export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

export const SUPPORTED_TIMEZONES: { value: string; label: string }[] = [];

/**
 * Format a Date object or string into "hh:mm A" local time string
 */
export function formatTimeInTimezone(
  date: Date | string | null | undefined,
  timezone?: string
): string {
  if (!date) return '—';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '—';

    const tz = timezone && timezone !== 'UTC' ? timezone : DEFAULT_TIMEZONE;
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: tz,
    }).toLowerCase();
  } catch {
    return '—';
  }
}

/**
 * Format a Date object into "YYYY-MM-DD" string
 */
export function formatDateInTimezone(
  date: Date | string | null | undefined,
  timezone?: string
): string {
  if (!date) return '';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '';

    const tz = timezone && timezone !== 'UTC' ? timezone : DEFAULT_TIMEZONE;
    const parts = new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: tz,
    }).formatToParts(d);

    const year = parts.find((p) => p.type === 'year')?.value;
    const month = parts.find((p) => p.type === 'month')?.value;
    const day = parts.find((p) => p.type === 'day')?.value;
    return `${year}-${month}-${day}`;
  } catch {
    return '';
  }
}

/**
 * Format a Date object into "MMM DD, YYYY, hh:mm A" string
 */
export function formatDateTimeInTimezone(
  date: Date | string | null | undefined,
  timezone?: string
): string {
  if (!date) return '—';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '—';

    const tz = timezone && timezone !== 'UTC' ? timezone : DEFAULT_TIMEZONE;
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: tz,
    });
  } catch {
    return '—';
  }
}

/**
 * Standard Date Formatter
 */
export function formatDateIST(
  date: Date | string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return '—';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', {
      timeZone: DEFAULT_TIMEZONE,
      ...(options || {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    });
  } catch {
    return '—';
  }
}

/**
 * Standard Time Formatter
 */
export function formatTimeIST(
  date: Date | string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return '—';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('en-US', {
      timeZone: DEFAULT_TIMEZONE,
      ...(options || {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }),
    }).toLowerCase();
  } catch {
    return '—';
  }
}

/**
 * Standard DateTime Formatter
 */
export function formatDateTimeIST(
  date: Date | string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return '—';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-US', {
      timeZone: DEFAULT_TIMEZONE,
      ...(options || {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }),
    });
  } catch {
    return '—';
  }
}

/**
 * Format a Date object into 24-hour "HH:MM" format
 */
export function formatTimeToHHMM(
  date: Date | string | null | undefined,
  timezone?: string
): string {
  if (!date) return '';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '';

    const tz = timezone && timezone !== 'UTC' ? timezone : DEFAULT_TIMEZONE;
    const parts = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: tz,
    }).formatToParts(d);

    const hours = parts.find((p) => p.type === 'hour')?.value || '00';
    const minutes = parts.find((p) => p.type === 'minute')?.value || '00';
    return `${hours}:${minutes}`;
  } catch {
    return '';
  }
}

/**
 * Get current date string (YYYY-MM-DD)
 */
export function getTodayInTimezone(timezone?: string): string {
  const d = new Date();
  return formatDateInTimezone(d, timezone);
}

/**
 * Get current hour/minute
 */
export function getNowInTimezone(timezone?: string): { hours: number; minutes: number; dayOfWeek: number } {
  const now = new Date();
  const hhmm = formatTimeToHHMM(now, timezone);
  const [hours, minutes] = hhmm.split(':').map(Number);

  const tz = timezone && timezone !== 'UTC' ? timezone : DEFAULT_TIMEZONE;
  const dayStr = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: tz }).format(now);
  const daysMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  return {
    hours,
    minutes,
    dayOfWeek: daysMap[dayStr] ?? now.getDay(),
  };
}
