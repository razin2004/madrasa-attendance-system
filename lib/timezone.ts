export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

export const SUPPORTED_TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'India (IST - UTC+5:30)' },
  { value: 'Asia/Dubai', label: 'Dubai / UAE (GST - UTC+4:00)' },
  { value: 'Asia/Riyadh', label: 'Riyadh / Saudi Arabia (AST - UTC+3:00)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT - UTC+8:00)' },
  { value: 'Europe/London', label: 'London / UK (GMT/BST - UTC+0/+1)' },
  { value: 'Europe/Paris', label: 'Paris / Europe (CET - UTC+1/+2)' },
  { value: 'America/New_York', label: 'New York / US Eastern (EST - UTC-5/-4)' },
  { value: 'America/Chicago', label: 'Chicago / US Central (CST - UTC-6/-5)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles / US Pacific (PST - UTC-8/-7)' },
  { value: 'UTC', label: 'Coordinated Universal Time (UTC)' },
];

/**
 * Format a Date object into "hh:mm A" string in the specified IANA time zone (defaults to Asia/Kolkata - IST)
 */
export function formatTimeInTimezone(
  date: Date | string | null | undefined,
  timezone: string = DEFAULT_TIMEZONE
): string {
  if (!date) return '—';
  const tz = timezone || DEFAULT_TIMEZONE;
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '—';

    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch (err) {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '—';
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: DEFAULT_TIMEZONE,
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(d);
    } catch {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  }
}

/**
 * Format a Date object into "YYYY-MM-DD" string in the specified IANA time zone (defaults to Asia/Kolkata - IST)
 */
export function formatDateInTimezone(
  date: Date | string | null | undefined,
  timezone: string = DEFAULT_TIMEZONE
): string {
  if (!date) return '';
  const tz = timezone || DEFAULT_TIMEZONE;
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '';

    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch (err) {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '';
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: DEFAULT_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d);
    } catch {
      return d.toISOString().slice(0, 10);
    }
  }
}

/**
 * Format a Date object into "MMM DD, YYYY, hh:mm A" string in the specified IANA time zone (defaults to Asia/Kolkata - IST)
 */
export function formatDateTimeInTimezone(
  date: Date | string | null | undefined,
  timezone: string = DEFAULT_TIMEZONE
): string {
  if (!date) return '—';
  const tz = timezone || DEFAULT_TIMEZONE;
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '—';

    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch (err) {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString();
  }
}

/**
 * Dedicated IST Date Formatter
 */
export function formatDateIST(
  date: Date | string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return '—';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '—';
    const opts: Intl.DateTimeFormatOptions = options || {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    };
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: DEFAULT_TIMEZONE,
      ...opts,
    }).format(d);
  } catch {
    return '—';
  }
}

/**
 * Dedicated IST Time Formatter
 */
export function formatTimeIST(
  date: Date | string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return '—';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '—';
    const opts: Intl.DateTimeFormatOptions = options || {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    };
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: DEFAULT_TIMEZONE,
      ...opts,
    }).format(d);
  } catch {
    return '—';
  }
}

/**
 * Dedicated IST DateTime Formatter
 */
export function formatDateTimeIST(
  date: Date | string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return '—';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '—';
    const opts: Intl.DateTimeFormatOptions = options || {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    };
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: DEFAULT_TIMEZONE,
      ...opts,
    }).format(d);
  } catch {
    return '—';
  }
}

/**
 * Format a Date object into 24-hour "HH:MM" format in the specified time zone (defaults to Asia/Kolkata - IST)
 */
export function formatTimeToHHMM(
  date: Date | string | null | undefined,
  timezone: string = DEFAULT_TIMEZONE
): string {
  if (!date) return '';
  const tz = timezone || DEFAULT_TIMEZONE;
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '';

    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(d);

    let hours = '00';
    let minutes = '00';
    for (const part of parts) {
      if (part.type === 'hour') hours = part.value.padStart(2, '0');
      if (part.type === 'minute') minutes = part.value.padStart(2, '0');
    }
    if (hours === '24') hours = '00';
    return `${hours}:${minutes}`;
  } catch {
    return '';
  }
}

/**
 * Get current date string (YYYY-MM-DD) in specified time zone (defaults to Asia/Kolkata - IST)
 */
export function getTodayInTimezone(timezone: string = DEFAULT_TIMEZONE): string {
  return formatDateInTimezone(new Date(), timezone || DEFAULT_TIMEZONE);
}

/**
 * Get current hour/minute in specified time zone (defaults to Asia/Kolkata - IST)
 */
export function getNowInTimezone(timezone: string = DEFAULT_TIMEZONE): { hours: number; minutes: number; dayOfWeek: number } {
  const tz = timezone || DEFAULT_TIMEZONE;
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      minute: 'numeric',
      weekday: 'narrow',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);

    let hours = 0;
    let minutes = 0;

    for (const part of parts) {
      if (part.type === 'hour') hours = parseInt(part.value, 10);
      if (part.type === 'minute') minutes = parseInt(part.value, 10);
    }

    return { hours, minutes, dayOfWeek: now.getUTCDay() };
  } catch {
    const now = new Date();
    return { hours: now.getHours(), minutes: now.getMinutes(), dayOfWeek: now.getDay() };
  }
}
