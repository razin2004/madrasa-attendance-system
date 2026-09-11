import { getLocalDayUtcRange, normalizeDate } from '../services/attendance.service';
import { calculateAttendanceMetricsForPunches } from '../services/reports.service';

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

  // Test 2: Multi-Punch Break Calculation
  console.log('Test 2: Multi-Punch Break & Working Time Calculation');
  const session1In = new Date('2026-09-12T02:30:00.000Z');  // 8:00 AM IST
  const session1Out = new Date('2026-09-12T06:30:00.000Z'); // 12:00 PM IST (4 hours)
  const session2In = new Date('2026-09-12T07:30:00.000Z');  // 1:00 PM IST (1 hour break)
  const session2Out = new Date('2026-09-12T11:30:00.000Z'); // 5:00 PM IST (4 hours)

  const records = [
    { type: 'CLOCK_IN', timestamp: session1In },
    { type: 'CLOCK_OUT', timestamp: session1Out },
    { type: 'CLOCK_IN', timestamp: session2In },
    { type: 'CLOCK_OUT', timestamp: session2Out },
  ];

  const metrics = calculateAttendanceMetricsForPunches({
    records,
    scheduledStart: '08:00',
    scheduledEnd: '17:00',
    timezone: 'Asia/Kolkata',
  });

  console.log('  Display Clock In: ', metrics.displayClockInTime);
  console.log('  Display Clock Out:', metrics.displayClockOutTime);
  console.log('  Total Break Mins: ', metrics.totalBreakMinutes, 'mins (' + metrics.totalBreakFormatted + ')');
  console.log('  Break Details:    ', JSON.stringify(metrics.breakDetails));
  console.log('  Total Work Mins:  ', metrics.totalWorkingHoursMinutes, 'mins (' + metrics.totalWorkingHoursFormatted + ')\n');

  if (metrics.totalBreakMinutes !== 60) throw new Error('Test 2 Failed: Break time should be exactly 60 minutes!');

  console.log('=== ALL ATTENDANCE VERIFICATION TESTS PASSED SUCCESSFULLY! ===');
}

testAttendanceFlow().catch((e) => {
  console.error('Test script failed:', e);
  process.exit(1);
});
