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

  // Test 2: Shift starting at 01:00 AM with Clock In at 02:05 AM (Late In = 65 mins = 1h 5m)
  console.log('Test 2: Shift starting at 01:00 AM with Clock In at 02:05 AM');
  const clockIn0205 = new Date('2026-09-11T20:35:00.000Z');  // 02:05 AM IST Sept 12
  const clockOut0206 = new Date('2026-09-11T20:36:00.000Z'); // 02:06 AM IST Sept 12

  const late1AmMetrics = calculateAttendanceMetricsForPunches({
    records: [
      { type: 'CLOCK_IN', timestamp: clockIn0205 },
      { type: 'CLOCK_OUT', timestamp: clockOut0206 },
    ],
    scheduledStart: '01:00',
    scheduledEnd: '09:00',
    timezone: 'Asia/Kolkata',
  });

  console.log('  Display Clock In: ', late1AmMetrics.displayClockInTime);
  console.log('  Display Clock Out:', late1AmMetrics.displayClockOutTime);
  console.log('  Late In Mins:     ', late1AmMetrics.lateInMinutes, 'mins (' + late1AmMetrics.lateInFormatted + ')');

  if (late1AmMetrics.lateInMinutes !== 65) {
    throw new Error(`Test 2 Failed: Late In should be 65 mins, got ${late1AmMetrics.lateInMinutes}`);
  }
  if (late1AmMetrics.lateInFormatted !== '1h 5m') {
    throw new Error(`Test 2 Failed: Late In formatted should be "1h 5m", got "${late1AmMetrics.lateInFormatted}"`);
  }

  // Test 3: Roster schedule weekday lookup for local date 2026-09-12 (Saturday)
  console.log('\nTest 3: calculateStaffDaySchedule for 2026-09-12 (Saturday)');
  const sampleAssignments: any[] = [
    {
      shiftPatternId: 'sp-1',
      effectiveFrom: new Date('2026-09-01T00:00:00.000Z'),
      effectiveTo: null,
      shiftPattern: {
        id: 'sp-1',
        name: 'Night Shift',
        minimumStaffingThreshold: 1,
        weeklyDays: [
          { weekday: 'SATURDAY', isHoliday: false, startTime: '01:00', endTime: '09:00', isOvernight: false },
        ],
      },
    },
  ];

  const sched = calculateStaffDaySchedule('2026-09-12', sampleAssignments, [], 'Asia/Kolkata');
  console.log('  Date ISO:     ', sched.date);
  console.log('  Weekday:      ', sched.weekday);
  console.log('  Scheduled:    ', sched.isScheduled);
  console.log('  Start Time:   ', sched.startTime);
  console.log('  End Time:     ', sched.endTime);

  if (sched.weekday !== 'SATURDAY') throw new Error(`Test 3 Failed: Expected SATURDAY, got ${sched.weekday}`);
  if (sched.startTime !== '01:00') throw new Error(`Test 3 Failed: Expected start time "01:00", got "${sched.startTime}"`);

  console.log('\n=== ALL ATTENDANCE VERIFICATION TESTS PASSED SUCCESSFULLY! ===');
}

testAttendanceFlow().catch((e) => {
  console.error('Test script failed:', e);
  process.exit(1);
});
