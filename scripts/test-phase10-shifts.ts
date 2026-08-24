import { prisma } from '../lib/prisma';
import {
  calculateAttendanceTimeMetrics,
  getStaffTodayAttendanceStatus,
} from '../services/attendance.service';
import {
  assignOrUpdateStaffShift,
  getStaffShiftAssignmentHistory,
  calculateShiftStaffingShortage,
  calculateStaffDaySchedule,
} from '../services/roster.service';
import { AttendanceType, Weekday } from '@prisma/client';

async function runShiftLogicTestSuite() {
  console.log('================================================================');
  console.log('ShiftGuard Phase 10: Shift Assignment & Attendance Time Logic Suite');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${testName}${detail ? ` - ${detail}` : ''}`);
      failed++;
    }
  }

  try {
    // Cleanup previous test organization if existing
    const existingOrg = await prisma.organization.findUnique({
      where: { organizationCode: 'SHIFTTEST' },
      include: { staffProfiles: { select: { userId: true } } },
    });
    if (existingOrg) {
      const userIds = existingOrg.staffProfiles.map((s) => s.userId).filter(Boolean);
      await prisma.shiftAssignment.deleteMany({
        where: { staffProfile: { organizationId: existingOrg.id } },
      });
      await prisma.organization.delete({ where: { id: existingOrg.id } });
      if (userIds.length > 0) {
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      }
    }

    // 1. Create Test Organization, Branch & Shift Pattern (08:00 - 17:00)
    console.log('1. Setting up test organization, branch, and shift pattern...');
    const org = await prisma.organization.create({
      data: {
        organizationCode: 'SHIFTTEST',
        name: 'Shift Logic Test Org',
      },
    });

    const branch = await prisma.branch.create({
      data: {
        organizationId: org.id,
        name: 'Main Shift Branch',
        address: '123 Main Street',
        publicIp: '127.0.0.1',
        latitude: 3.139,
        longitude: 101.6869,
        geofenceRadiusMeters: 500,
      },
    });

    const shiftPatternA = await prisma.shiftPattern.create({
      data: {
        organizationId: org.id,
        name: 'Morning Shift (08:00-17:00)',
        minimumStaffingThreshold: 2,
        weeklyDays: {
          create: [
            { weekday: 'MONDAY', startTime: '08:00', endTime: '17:00' },
            { weekday: 'TUESDAY', startTime: '08:00', endTime: '17:00' },
            { weekday: 'WEDNESDAY', startTime: '08:00', endTime: '17:00' },
            { weekday: 'THURSDAY', startTime: '08:00', endTime: '17:00' },
            { weekday: 'FRIDAY', startTime: '08:00', endTime: '17:00' },
            { weekday: 'SATURDAY', startTime: '08:00', endTime: '17:00' },
            { weekday: 'SUNDAY', startTime: '08:00', endTime: '17:00' },
          ],
        },
      },
    });

    const shiftPatternB = await prisma.shiftPattern.create({
      data: {
        organizationId: org.id,
        name: 'Late Shift (09:00-18:00)',
        minimumStaffingThreshold: 1,
        weeklyDays: {
          create: [
            { weekday: 'MONDAY', startTime: '09:00', endTime: '18:00' },
            { weekday: 'TUESDAY', startTime: '09:00', endTime: '18:00' },
            { weekday: 'WEDNESDAY', startTime: '09:00', endTime: '18:00' },
            { weekday: 'THURSDAY', startTime: '09:00', endTime: '18:00' },
            { weekday: 'FRIDAY', startTime: '09:00', endTime: '18:00' },
          ],
        },
      },
    });

    const user = await prisma.user.create({
      data: {
        email: `staff_shift_${Date.now()}@shiftguard.com`,
        name: 'Shift Test Staff',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuu',
        role: 'STAFF',
        status: 'ACTIVE',
      },
    });

    const staffProfile = await prisma.staffProfile.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        staffId: 'STF9901',
        name: 'Shift Test Staff',
        phone: '+15550199',
        address: '123 Test Street',
        idDocType: 'PASSPORT',
      },
    });

    console.log('   Organization, Branch, User, and Shift Patterns created successfully.\n');

    // 2. Test Shift Assignment & History Preservation
    console.log('2. Testing Shift Assignment with Effective Date...');
    const jan1 = new Date('2026-01-01T00:00:00.000Z');
    const assignmentJan = await assignOrUpdateStaffShift({
      staffProfileId: staffProfile.id,
      shiftPatternId: shiftPatternA.id,
      effectiveFrom: jan1,
      assignedBy: 'System Admin',
    });

    assert(
      assignmentJan.shiftPatternId === shiftPatternA.id && assignmentJan.effectiveTo === null,
      'Initial Shift Assignment created with open effectiveTo date'
    );

    // Assign Shift B effective Feb 1
    const feb1 = new Date('2026-02-01T00:00:00.000Z');
    const assignmentFeb = await assignOrUpdateStaffShift({
      staffProfileId: staffProfile.id,
      shiftPatternId: shiftPatternB.id,
      effectiveFrom: feb1,
      assignedBy: 'System Admin',
    });

    const history = await getStaffShiftAssignmentHistory(staffProfile.id);
    assert(history.length === 2, 'Shift Assignment History retains both assignments');

    const closedJan = history.find((h) => h.id === assignmentJan.id);
    assert(
      closedJan?.effectiveTo !== null,
      'Previous shift assignment automatically closed when new shift assigned'
    );

    console.log('\n3. Testing Attendance Time Metrics Engine...');

    // Test Case 1: 07:55 AM Clock-In for 08:00 AM Shift (Early Clock-In)
    const punch0755 = new Date('2026-08-20T07:55:00.000');
    const metrics0755 = calculateAttendanceTimeMetrics({
      type: 'CLOCK_IN',
      punchTime: punch0755,
      scheduledStartTimeStr: '08:00',
      scheduledEndTimeStr: '17:00',
      shiftName: 'Morning Shift',
    });

    assert(
      metrics0755.lateMinutes === 0,
      '07:55 AM Clock-In: lateMinutes is 0'
    );
    assert(
      metrics0755.attendanceStartTime.getHours() === 8 && metrics0755.attendanceStartTime.getMinutes() === 0,
      '07:55 AM Clock-In: attendanceStartTime is normalized to 08:00 AM (On Time)'
    );

    // Test Case 2: 08:00 AM Clock-In for 08:00 AM Shift (Exact Shift Start)
    const punch0800 = new Date('2026-08-20T08:00:00.000');
    const metrics0800 = calculateAttendanceTimeMetrics({
      type: 'CLOCK_IN',
      punchTime: punch0800,
      scheduledStartTimeStr: '08:00',
      scheduledEndTimeStr: '17:00',
      shiftName: 'Morning Shift',
    });

    assert(
      metrics0800.lateMinutes === 0,
      '08:00 AM Clock-In: lateMinutes is 0 (On Time)'
    );

    // Test Case 3: 08:05 AM Clock-In for 08:00 AM Shift (5 Minutes Late)
    const punch0805 = new Date('2026-08-20T08:05:00.000');
    const metrics0805 = calculateAttendanceTimeMetrics({
      type: 'CLOCK_IN',
      punchTime: punch0805,
      scheduledStartTimeStr: '08:00',
      scheduledEndTimeStr: '17:00',
      shiftName: 'Morning Shift',
    });

    assert(
      metrics0805.lateMinutes === 5,
      '08:05 AM Clock-In: lateMinutes is 5 minutes late'
    );
    assert(
      metrics0805.attendanceStartTime.getMinutes() === 5,
      '08:05 AM Clock-In: attendanceStartTime preserves 08:05 AM'
    );

    // Test Case 4: 08:30 AM Clock-In for 08:00 AM Shift (30 Minutes Late)
    const punch0830 = new Date('2026-08-20T08:30:00.000');
    const metrics0830 = calculateAttendanceTimeMetrics({
      type: 'CLOCK_IN',
      punchTime: punch0830,
      scheduledStartTimeStr: '08:00',
      scheduledEndTimeStr: '17:00',
      shiftName: 'Morning Shift',
    });

    assert(
      metrics0830.lateMinutes === 30,
      '08:30 AM Clock-In: lateMinutes is 30 minutes late'
    );

    // Test Case 5: 16:30 PM Clock-Out for 17:00 PM Shift (30 Minutes Early)
    const punch1630 = new Date('2026-08-20T16:30:00.000');
    const metrics1630 = calculateAttendanceTimeMetrics({
      type: 'CLOCK_OUT',
      punchTime: punch1630,
      scheduledStartTimeStr: '08:00',
      scheduledEndTimeStr: '17:00',
      shiftName: 'Morning Shift',
    });

    assert(
      metrics1630.earlyDepartureMinutes === 30,
      '16:30 PM Clock-Out: earlyDepartureMinutes is 30 minutes early'
    );

    // Test Case 6: 17:00 PM Clock-Out for 17:00 PM Shift (Exact Shift End)
    const punch1700 = new Date('2026-08-20T17:00:00.000');
    const metrics1700 = calculateAttendanceTimeMetrics({
      type: 'CLOCK_OUT',
      punchTime: punch1700,
      scheduledStartTimeStr: '08:00',
      scheduledEndTimeStr: '17:00',
      shiftName: 'Morning Shift',
    });

    assert(
      metrics1700.earlyDepartureMinutes === 0,
      '17:00 PM Clock-Out: earlyDepartureMinutes is 0 (Normal)'
    );

    // Test Case 7: 17:30 PM Clock-Out for 17:00 PM Shift (Overtime / Late Clock-Out)
    const punch1730 = new Date('2026-08-20T17:30:00.000');
    const metrics1730 = calculateAttendanceTimeMetrics({
      type: 'CLOCK_OUT',
      punchTime: punch1730,
      scheduledStartTimeStr: '08:00',
      scheduledEndTimeStr: '17:00',
      shiftName: 'Morning Shift',
    });

    assert(
      metrics1730.earlyDepartureMinutes === 0,
      '17:30 PM Clock-Out: earlyDepartureMinutes is 0 (Normal)'
    );

    console.log('\n4. Testing Minimum Staffing Availability Shortage Calculation...');
    const jan15 = new Date('2026-01-15T00:00:00.000Z');
    const shortage = await calculateShiftStaffingShortage(org.id, shiftPatternA.id, jan15);

    assert(
      shortage !== null && shortage.isShortage === true && shortage.shortageCount === 1,
      'Minimum staffing shortage flagged correctly (Min: 2, Available: 1, Shortage: 1)'
    );

    // Cleanup Test Org
    await prisma.shiftAssignment.deleteMany({
      where: { staffProfile: { organizationId: org.id } },
    });
    await prisma.organization.delete({ where: { id: org.id } });
    await prisma.user.delete({ where: { id: user.id } });

    console.log('\n================================================================');
    console.log(`Suite Execution Completed: ${passed} PASSED, ${failed} FAILED.`);
    console.log('================================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Test execution failed with error:', error);
    process.exit(1);
  }
}

runShiftLogicTestSuite();
