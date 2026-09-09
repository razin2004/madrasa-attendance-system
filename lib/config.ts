/**
 * ShiftGuard System Configuration
 */

// Daily Attendance Cycle Limit Configuration (Default: 5 complete cycles per scheduled workday)
// Allows override via MAX_DAILY_ATTENDANCE_CYCLES environment variable.
export const MAX_DAILY_ATTENDANCE_CYCLES = process.env.MAX_DAILY_ATTENDANCE_CYCLES
  ? parseInt(process.env.MAX_DAILY_ATTENDANCE_CYCLES, 10)
  : 5;
