/**
 * ShiftGuard System Configuration
 */

// Daily Attendance Cycle Limit Configuration (Section 18, 19, 37)
// Default testing mode is 5 complete cycles per day. Set MAX_DAILY_ATTENDANCE_CYCLES=1 in production env.
export const MAX_DAILY_ATTENDANCE_CYCLES = process.env.MAX_DAILY_ATTENDANCE_CYCLES
  ? parseInt(process.env.MAX_DAILY_ATTENDANCE_CYCLES, 10)
  : 5;
