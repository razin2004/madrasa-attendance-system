import { prisma } from '../lib/prisma';
import {
  calculateAttendanceTimeMetrics,
} from '../services/attendance.service';
import {
  assignOrUpdateStaffShift,
  getStaffShiftAssignmentHistory,
  calculateStaffDaySchedule,
} from '../services/roster.service';
import { calculateStaffingImpact } from '../services/leave.service';
import { getDailyAttendanceReport, getMonthlyEmployeeAttendanceReport } from '../services/reports.service';

async function runAuditTestSuite() {
  console.log('================================================================');
  console.log('ShiftGuard Phase 11: Admin Shift & Cross-System Audit Suite');
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
    // 0. Cleanup previous audit test entities if existing
    const existingOrg = await prisma.organization.findUnique({
      where: { organizationCode: 'AUDITTEST' },
      include: { staffProfiles: { select: { userId: true } } },
    });

    if (existingOrg) {
      const userIds = existingOrg.staffProfiles.map((s) => s.userId).filter(Boolean);
      await prisma.attendanceRecord.deleteMany({ where: { organizationId: existingOrg.id } });
      await prisma.leaveRequest.deleteMany({ where: { organizationId: existingOrg.id } });
      await prisma.shiftAssignment.deleteMany({ where: { staffProfile: { organizationId: existingOrg.id } } });
      await prisma.organization.delete({ where: { id: existingOrg.id } });
      if (userIds.length > 0) {
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      }
    }

    // 1. Setup Test Tenant (AUDITTEST)
    console.log('1. Setting up Audit Tenant, Branch, Staff John, and Shift Patterns...');
    const org = await prisma.organization.create({
      data: {
        organizationCode: 'AUDITTEST',
        name: 'Shift Audit Test Organization',
      },
    });

    const branch = await prisma.branch.create({
      data: {
        organizationId: org.id,
        name: 'Audit HQ Branch',
        address: '100 Audit Plaza',
        publicIp: '127.0.0.1',
        latitude: 3.139,
        longitude: 101.6869,
        geofenceRadiusMeters: 500,
      },
    });

    // Shift Pattern A: Morning Shift (08:00 - 17:00), Min Staffing: 5
    const shiftPatternA = await prisma.shiftPattern.create({
      data: {
        organizationId: org.id,
        name: 'Morning Shift (08:00-17:00)',
        minimumStaffingThreshold: 5,
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

    // Shift Pattern B: Late Shift (09:00 - 18:00), Min Staffing: 3
    const shiftPatternB = await prisma.shiftPattern.create({
      data: {
        organizationId: org.id,
        name: 'Late Shift (09:00-18:00)',
        minimumStaffingThreshold: 3,
        weeklyDays: {
          create: [
            { weekday: 'MONDAY', startTime: '09:00', endTime: '18:00' },
            { weekday: 'TUESDAY', startTime: '09:00', endTime: '18:00' },
            { weekday: 'WEDNESDAY', startTime: '09:00', endTime: '18:00' },
            { weekday: 'THURSDAY', startTime: '09:00', endTime: '18:00' },
            { weekday: 'FRIDAY', startTime: '09:00', endTime: '18:00' },
            { weekday: 'SATURDAY', startTime: '09:00', endTime: '18:00' },
            { weekday: 'SUNDAY', startTime: '09:00', endTime: '18:00' },
          ],
        },
      },
    });

    // Create Staff User John
    const userJohn = await prisma.user.create({
      data: {
        email: `john_audit_${Date.now()}@shiftguard.com`,
        name: 'John Audit Staff',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuu',
        role: 'STAFF',
        status: 'ACTIVE',
      },
    });

    const johnProfile = await prisma.staffProfile.create({
      data: {
        organizationId: org.id,
        userId: userJohn.id,
        staffId: 'STF_JOHN_001',
        name: 'John Audit Staff',
        phone: '+15550188',
        address: '100 Audit Plaza',
        idDocType: 'PASSPORT',
      },
    });

    await prisma.branchStaffAssignment.create({
      data: {
        staffProfileId: johnProfile.id,
        branchId: branch.id,
        assignedBy: 'System Admin',
      },
    });

    console.log('   Test Organization, Staff John, and Shift Patterns initialized.\n');

    // 2. Initial Shift Assignment (Week 1: 08:00 - 17:00 starting Jan 1, 2026)
    console.log('2. Assigning Initial Shift A (08:00-17:00) Effective Jan 1, 2026...');
    const jan1 = new Date('2026-01-01T00:00:00.000Z');
    await assignOrUpdateStaffShift({
      staffProfileId: johnProfile.id,
      shiftPatternId: shiftPatternA.id,
      effectiveFrom: jan1,
      assignedBy: 'Org Admin',
    });

    const currentScheduleWeek1 = calculateStaffDaySchedule(
      new Date('2026-01-10T00:00:00.000Z'),
      await prisma.shiftAssignment.findMany({ where: { staffProfileId: johnProfile.id }, include: { shiftPattern: { include: { weeklyDays: true } } } }),
      []
    );

    assert(
      currentScheduleWeek1.startTime === '08:00' && currentScheduleWeek1.endTime === '17:00',
      'John assigned 08:00-17:00 shift for Week 1'
    );

    // 3. Testing Clock-In & Clock-Out Rules for John
    console.log('\n3. Testing Attendance Time Logic Scenarios for John...');

    // Scenario A: John Clock-In at 07:55 AM
    const punch0755 = new Date(2026, 0, 10, 7, 55, 0);
    const metrics0755 = calculateAttendanceTimeMetrics({
      type: 'CLOCK_IN',
      punchTime: punch0755,
      scheduledStartTimeStr: currentScheduleWeek1.startTime!,
      scheduledEndTimeStr: currentScheduleWeek1.endTime!,
      shiftName: currentScheduleWeek1.shiftPatternName!,
    });

    assert(
      metrics0755.lateMinutes === 0 && metrics0755.attendanceStartTime.getHours() === 8,
      'John 07:55 AM Clock-In: lateMinutes = 0, Attendance Start normalized to 08:00 AM (On Time)'
    );

    // Record verified Clock In for Jan 10
    const clockInJan10 = await prisma.attendanceRecord.create({
      data: {
        organizationId: org.id,
        staffProfileId: johnProfile.id,
        branchId: branch.id,
        type: 'CLOCK_IN',
        timestamp: punch0755,
        verificationStatus: 'VERIFIED',
        deviceStatus: 'REGISTERED',
        deviceMatched: true,
        ipAddress: '127.0.0.1',
        ipMatched: true,
        latitude: 3.139,
        longitude: 101.6869,
        geofenceMatched: true,
        source: 'NORMAL',
        scheduledShiftName: currentScheduleWeek1.shiftPatternName,
        scheduledStartTime: currentScheduleWeek1.startTime,
        scheduledEndTime: currentScheduleWeek1.endTime,
        attendanceStartTime: metrics0755.attendanceStartTime,
        lateMinutes: metrics0755.lateMinutes,
      },
    });

    // Scenario B: John Clock-Out at 16:30 PM (30 Minutes Early)
    const punch1630 = new Date(2026, 0, 10, 16, 30, 0);
    const metrics1630 = calculateAttendanceTimeMetrics({
      type: 'CLOCK_OUT',
      punchTime: punch1630,
      scheduledStartTimeStr: currentScheduleWeek1.startTime!,
      scheduledEndTimeStr: currentScheduleWeek1.endTime!,
      shiftName: currentScheduleWeek1.shiftPatternName!,
    });

    assert(
      metrics1630.earlyDepartureMinutes === 30,
      'John 16:30 PM Clock-Out: earlyDepartureMinutes = 30 (30 min early departure)'
    );

    // Record verified Clock Out for Jan 10
    await prisma.attendanceRecord.create({
      data: {
        organizationId: org.id,
        staffProfileId: johnProfile.id,
        branchId: branch.id,
        type: 'CLOCK_OUT',
        timestamp: punch1630,
        verificationStatus: 'VERIFIED',
        deviceStatus: 'REGISTERED',
        deviceMatched: true,
        ipAddress: '127.0.0.1',
        ipMatched: true,
        latitude: 3.139,
        longitude: 101.6869,
        geofenceMatched: true,
        source: 'NORMAL',
        scheduledShiftName: currentScheduleWeek1.shiftPatternName,
        scheduledStartTime: currentScheduleWeek1.startTime,
        scheduledEndTime: currentScheduleWeek1.endTime,
        earlyDepartureMinutes: metrics1630.earlyDepartureMinutes,
      },
    });

    // Scenario C: John Clock-In Next Day (Jan 11) at 08:05 AM (5 Minutes Late)
    const punch0805 = new Date(2026, 0, 11, 8, 5, 0);
    const metrics0805 = calculateAttendanceTimeMetrics({
      type: 'CLOCK_IN',
      punchTime: punch0805,
      scheduledStartTimeStr: currentScheduleWeek1.startTime!,
      scheduledEndTimeStr: currentScheduleWeek1.endTime!,
      shiftName: currentScheduleWeek1.shiftPatternName!,
    });

    assert(
      metrics0805.lateMinutes === 5,
      'John 08:05 AM Clock-In next day: lateMinutes = 5 (5 min late)'
    );

    await prisma.attendanceRecord.create({
      data: {
        organizationId: org.id,
        staffProfileId: johnProfile.id,
        branchId: branch.id,
        type: 'CLOCK_IN',
        timestamp: punch0805,
        verificationStatus: 'VERIFIED',
        deviceStatus: 'REGISTERED',
        deviceMatched: true,
        ipAddress: '127.0.0.1',
        ipMatched: true,
        latitude: 3.139,
        longitude: 101.6869,
        geofenceMatched: true,
        source: 'NORMAL',
        scheduledShiftName: currentScheduleWeek1.shiftPatternName,
        scheduledStartTime: currentScheduleWeek1.startTime,
        scheduledEndTime: currentScheduleWeek1.endTime,
        attendanceStartTime: metrics0805.attendanceStartTime,
        lateMinutes: metrics0805.lateMinutes,
      },
    });

    // 4. Admin Changes John's Shift Effective Next Month (Feb 1, 2026: 09:00 - 18:00)
    console.log('\n4. Admin Changes John\'s Shift Effective Feb 1, 2026 (09:00-18:00)...');
    const feb1 = new Date('2026-02-01T00:00:00.000Z');
    await assignOrUpdateStaffShift({
      staffProfileId: johnProfile.id,
      shiftPatternId: shiftPatternB.id,
      effectiveFrom: feb1,
      assignedBy: 'Org Admin',
    });

    const shiftHistory = await getStaffShiftAssignmentHistory(johnProfile.id);
    assert(
      shiftHistory.length === 2,
      'Shift assignment history retains both 08:00-17:00 and 09:00-18:00 shift assignments'
    );

    // Verify Schedule Resolution per Date Context
    const janSchedule = calculateStaffDaySchedule(
      new Date('2026-01-15T00:00:00.000Z'),
      shiftHistory,
      []
    );

    const febSchedule = calculateStaffDaySchedule(
      new Date('2026-02-15T00:00:00.000Z'),
      shiftHistory,
      []
    );

    assert(
      janSchedule.startTime === '08:00' && febSchedule.startTime === '09:00',
      'Historical schedule resolution preserves 08:00-17:00 for Jan and 09:00-18:00 for Feb'
    );

    // 5. Leave Integration & Staffing Impact Check
    console.log('\n5. Testing Leave Management Integration & Staffing Impact...');
    const impactJan = await calculateStaffingImpact(
      org.id,
      johnProfile.id,
      new Date('2026-01-15T00:00:00.000Z'),
      new Date('2026-01-16T00:00:00.000Z')
    );

    const impactFeb = await calculateStaffingImpact(
      org.id,
      johnProfile.id,
      new Date('2026-02-15T00:00:00.000Z'),
      new Date('2026-02-16T00:00:00.000Z')
    );

    assert(
      impactJan.days[0].shiftName === 'Morning Shift (08:00-17:00)' &&
        impactFeb.days[0].shiftName === 'Late Shift (09:00-18:00)',
      'Leave staffing impact resolves exact shift applicable on each requested date'
    );

    assert(
      impactJan.days[0].minimumStaffingThreshold === 5 && impactFeb.days[0].minimumStaffingThreshold === 3,
      'Leave staffing impact enforces shift-specific minimum staffing thresholds (5 for Morning, 3 for Late)'
    );

    // 6. Reports & Historical Context Audit
    console.log('\n6. Testing Reporting Integration & Historical Preservation...');
    const monthlyJan = await getMonthlyEmployeeAttendanceReport({
      organizationId: org.id,
      year: 2026,
      month: 1,
      staffId: johnProfile.id,
    });

    const jan10Row = monthlyJan.daysRows.find((r) => r.date === '2026-01-10');
    assert(
      jan10Row?.shiftPatternName === 'Morning Shift (08:00-17:00)' &&
        jan10Row?.clockInIso !== null &&
        jan10Row?.clockOutIso !== null,
      'Monthly report preserves exact historical shift and punch times for Jan 10'
    );

    // Cleanup Audit Tenant
    await prisma.attendanceRecord.deleteMany({ where: { organizationId: org.id } });
    await prisma.shiftAssignment.deleteMany({ where: { staffProfile: { organizationId: org.id } } });
    await prisma.organization.delete({ where: { id: org.id } });
    await prisma.user.delete({ where: { id: userJohn.id } });

    console.log('\n================================================================');
    console.log(`Audit Suite Completed: ${passed} PASSED, ${failed} FAILED.`);
    console.log('================================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Audit execution failed with error:', error);
    process.exit(1);
  }
}

runAuditTestSuite();
