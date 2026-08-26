/**
 * ShiftGuard System Configuration
 */

// Daily Attendance Cycle Limit Configuration (Production Default: 1 complete cycle per scheduled workday)
// Allows override via MAX_DAILY_ATTENDANCE_CYCLES environment variable for dev/testing.
export const MAX_DAILY_ATTENDANCE_CYCLES = process.env.MAX_DAILY_ATTENDANCE_CYCLES
  ? parseInt(process.env.MAX_DAILY_ATTENDANCE_CYCLES, 10)
  : 1;
