/**
 * Standard Native Date & Time Formatting Utilities
 * Handles standard local web application date and time formatting without IANA timezone overrides.
 */

export const DEFAULT_TIMEZONE = 'UTC';

export const SUPPORTED_TIMEZONES: { value: string; label: string }[] = [];

/**
 * Format a Date object or string into "hh:mm A" local time string
 */
export function formatTimeInTimezone(
  date: Date | string | null | undefined,
  _timezone?: string
): string {
  if (!date) return '—';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '—';

    return d.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '—';
  }
}

/**
 * Format a Date object into "YYYY-MM-DD" string
 */
export function formatDateInTimezone(
  date: Date | string | null | undefined,
  _timezone?: string
): string {
  if (!date) return '';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '';

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
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
  _timezone?: string
): string {
  if (!date) return '—';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '—';

    return d.toLocaleString([], {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
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
    return d.toLocaleDateString([], options || {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
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
    return d.toLocaleTimeString([], options || {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
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
    return d.toLocaleString([], options || {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
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
  _timezone?: string
): string {
  if (!date) return '';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '';

    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  } catch {
    return '';
  }
}

/**
 * Get current date string (YYYY-MM-DD)
 */
export function getTodayInTimezone(_timezone?: string): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get current hour/minute
 */
export function getNowInTimezone(_timezone?: string): { hours: number; minutes: number; dayOfWeek: number } {
  const now = new Date();
  return {
    hours: now.getHours(),
    minutes: now.getMinutes(),
    dayOfWeek: now.getDay(),
  };
}
