/**
 * Time Zone Utility for ShiftGuard
 * Converts UTC Date objects into formatted strings in the target branch's IANA time zone (e.g. "Asia/Dubai", "America/New_York", "Asia/Kolkata").
 */

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
 * Format a Date object into "hh:mm A" string in the specified IANA time zone
 */
export function formatTimeInTimezone(
  date: Date | string | null | undefined,
  timezone: string = 'Asia/Kolkata'
): string {
  if (!date) return '—';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '—';

    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch (err) {
    // Fallback if invalid timezone string passed
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

/**
 * Format a Date object into "YYYY-MM-DD" string in the specified IANA time zone
 */
export function formatDateInTimezone(
  date: Date | string | null | undefined,
  timezone: string = 'Asia/Kolkata'
): string {
  if (!date) return '';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '';

    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d); // Returns YYYY-MM-DD format

    return parts;
  } catch (err) {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString().slice(0, 10);
  }
}

/**
 * Get current hour/minute in specified time zone
 */
export function getNowInTimezone(timezone: string = 'Asia/Kolkata'): { hours: number; minutes: number; dayOfWeek: number } {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
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
