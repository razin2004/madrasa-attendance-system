import { getLocalDayUtcRange } from '../services/attendance.service';
import { calculateAttendanceMetricsForPunches } from '../services/reports.service';
import { calculateStaffDaySchedule } from '../services/roster.service';

async function testAttendanceFlow() {
  console.log('=== RUNNING ATTENDANCE SYSTEM VERIFICATION TESTS ===\n');

  // Test 1: Local Day UTC Range calculation for IST (UTC+5:30)
  const rangeSept12 = getLocalDayUtcRange('2026-09-12', -330);
  console.log('Test 1: getLocalDayUtcRange("2026-09-12", -330)');
  console.log('  Start of Day UTC:', rangeSept12.startOfDay.toISOString());
  console.log('  End of Day UTC:  ', rangeSept12.endOfDay.toISOString());
  console.log('  Date String:     ', rangeSept12.dateStr);

  const punchAt1AmSept12 = new Date('2026-09-11T19:30:00.000Z'); // 1:00 AM IST Sept 12
  const matchesSept12 = punchAt1AmSept12 >= rangeSept12.startOfDay && punchAt1AmSept12 <= rangeSept12.endOfDay;
  console.log('  Punch at 1:00 AM IST Sept 12 matches Sept 12 range:', matchesSept12, '(Expected: true)\n');

  if (!matchesSept12) throw new Error('Test 1 Failed: Punch at 1:00 AM IST Sept 12 did not match Sept 12 range!');

  // Test 2: User's Exact Multi-Punch Scenario
  // Shift: 01:00 AM to 05:00 AM (4 hours = 240 mins)
  // Punches: 02:00 AM (In), 02:10 AM (Out), 02:20 AM (In), 04:00 AM (Out)
  console.log('Test 2: User Exact Multi-Punch Scenario (Shift: 01:00 AM - 05:00 AM)');

  const punch1In  = new Date('2026-09-11T20:30:00.000Z'); // 02:00 AM IST
  const punch2Out = new Date('2026-09-11T20:40:00.000Z'); // 02:10 AM IST (10m break start)
  const punch3In  = new Date('2026-09-11T20:50:00.000Z'); // 02:20 AM IST (10m break end)
  const punch4Out = new Date('2026-09-11T22:30:00.000Z'); // 04:00 AM IST

  const userMetrics = calculateAttendanceMetricsForPunches({
    records: [
      { type: 'CLOCK_IN', timestamp: punch1In },
      { type: 'CLOCK_OUT', timestamp: punch2Out },
      { type: 'CLOCK_IN', timestamp: punch3In },
      { type: 'CLOCK_OUT', timestamp: punch4Out },
    ],
    scheduledStart: '01:00',
    scheduledEnd: '05:00',
    timezone: 'Asia/Kolkata',
  });

  console.log('  Clock In:         ', userMetrics.displayClockInTime, '(Expected: 02:00 am)');
  console.log('  Clock Out:        ', userMetrics.displayClockOutTime, '(Expected: 04:00 am)');
  console.log('  Late In:          ', userMetrics.lateInMinutes, 'mins (' + userMetrics.lateInFormatted + ') (Expected: 60 mins / 1h)');
  console.log('  Early Out:        ', userMetrics.earlyOutMinutes, 'mins (' + userMetrics.earlyOutFormatted + ') (Expected: 60 mins / 1h)');
  console.log('  Break Time:       ', userMetrics.totalBreakMinutes, 'mins (' + userMetrics.totalBreakFormatted + ') (Expected: 10 mins / 10m)');
  console.log('  Break Details:    ', JSON.stringify(userMetrics.breakDetails));
  console.log('  Total Working:    ', userMetrics.totalWorkingHoursMinutes, 'mins (' + userMetrics.totalWorkingHoursFormatted + ') (Expected: 110 mins / 1h 50m)\n');

  if (userMetrics.displayClockInTime !== '02:00 am') throw new Error(`Test 2 Failed: Clock In expected "02:00 am", got "${userMetrics.displayClockInTime}"`);
  if (userMetrics.displayClockOutTime !== '04:00 am') throw new Error(`Test 2 Failed: Clock Out expected "04:00 am", got "${userMetrics.displayClockOutTime}"`);
  if (userMetrics.lateInMinutes !== 60) throw new Error(`Test 2 Failed: Late In expected 60 mins, got ${userMetrics.lateInMinutes}`);
  if (userMetrics.earlyOutMinutes !== 60) throw new Error(`Test 2 Failed: Early Out expected 60 mins, got ${userMetrics.earlyOutMinutes}`);
  if (userMetrics.totalBreakMinutes !== 10) throw new Error(`Test 2 Failed: Break time expected 10 mins, got ${userMetrics.totalBreakMinutes}`);
  if (userMetrics.totalWorkingHoursMinutes !== 110) throw new Error(`Test 2 Failed: Total Working Hours expected 110 mins, got ${userMetrics.totalWorkingHoursMinutes}`);

  console.log('=== ALL ATTENDANCE VERIFICATION TESTS PASSED SUCCESSFULLY! ===');
}

testAttendanceFlow().catch((e) => {
  console.error('Test script failed:', e);
  process.exit(1);
});
