/**
 * ShiftGuard Phase 12: Critical Attendance Verification & Logic Corrections Audit Suite
 *
 * Tests compliance with all 40 specification requirements:
 * 1. Three-Layer Security (Device + IP + Geofence required for BOTH Clock In & Clock Out)
 * 2. No Schedule = No Attendance (Clock In & Clock Out blocked)
 * 3. Daily Attendance Cycle Accounting & Limits (MAX_DAILY_ATTENDANCE_CYCLES=5 testing limit)
 * 4. Failed attempts non-counting
 * 5. Double Verification on Clock Out
 */

import { prisma } from '../lib/prisma';
import { recordAttendance, getStaffTodayAttendanceStatus } from '../services/attendance.service';
import { hashDeviceSecret } from '../lib/security';
import { assignOrUpdateStaffShift } from '../services/roster.service';

async function runPhase12Tests() {
  console.log('================================================================');
  console.log('ShiftGuard Phase 12: Attendance Logic Corrections Audit Suite');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${testName}`);
      if (detail) console.error(`    Detail: ${detail}`);
      failed++;
    }
  }

  // 1. Setup Test Tenant, Branch, Staff, and Shift
  const timestamp = Date.now();
  const orgCode = `P12_${timestamp}`;
  const org = await prisma.organization.create({
    data: {
      name: 'Phase 12 Audit Org',
      organizationCode: orgCode,
      status: 'ACTIVE',
    },
  });

  const branch = await prisma.branch.create({
    data: {
      organizationId: org.id,
      name: 'P12 Main Branch',
      address: '123 Tech Park',
      latitude: 10.00000,
      longitude: 76.00000,
      geofenceRadiusMeters: 150,
      publicIp: '203.0.113.50',
      status: 'ACTIVE',
    },
  });

  const user = await prisma.user.create({
    data: {
      name: 'Phase 12 Tester',
      email: `p12_staff_${timestamp}@test.com`,
      passwordHash: 'hashed_pw',
      role: 'STAFF',
    },
  });

  const staff = await prisma.staffProfile.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      staffId: `STF_${timestamp}`,
      name: 'Phase 12 Tester',
      address: '123 Test Street',
      branchAssignments: {
        create: {
          branchId: branch.id,
        },
      },
    },
  });

  const shiftPattern = await prisma.shiftPattern.create({
    data: {
      organizationId: org.id,
      name: 'Regular Day Shift',
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

  // Register Device for Staff
  const deviceSecret = `DEV_SECRET_${timestamp}`;
  await prisma.staffDevice.create({
    data: {
      staffProfileId: staff.id,
      secretHash: hashDeviceSecret(deviceSecret),
      status: 'REGISTERED',
      label: 'Test Browser Chrome',
    },
  });

  console.log('1. Testing No Schedule = No Attendance Rule (Sections 14, 15, 29)...');
  // Attempt attendance BEFORE shift assignment
  const noSchedClockIn = await recordAttendance({
    organizationId: org.id,
    staffProfileId: staff.id,
    userId: user.id,
    type: 'CLOCK_IN',
    requestIp: '203.0.113.50',
    rawDeviceSecret: deviceSecret,
    coordinates: { latitude: 10.00000, longitude: 76.00000, accuracy: 10 },
  });

  assert(
    Boolean(
      noSchedClockIn.success === false &&
        noSchedClockIn.error?.includes('no schedule is assigned for today')
    ),
    'Clock In blocked when no schedule is assigned',
    noSchedClockIn.error
  );

  // Now assign shift starting today
  await assignOrUpdateStaffShift({
    staffProfileId: staff.id,
    shiftPatternId: shiftPattern.id,
    effectiveFrom: new Date(),
    assignedBy: 'System Admin',
  });

  console.log('\n2. Testing Three-Layer Security Verification Cases (Sections 1, 25-28)...');

  // CASE 2: Unregistered Device
  const wrongDevRes = await recordAttendance({
    organizationId: org.id,
    staffProfileId: staff.id,
    userId: user.id,
    type: 'CLOCK_IN',
    requestIp: '203.0.113.50',
    rawDeviceSecret: 'UNREGISTERED_DEVICE_SECRET',
    coordinates: { latitude: 10.00000, longitude: 76.00000, accuracy: 10 },
  });
  assert(
    Boolean(
      wrongDevRes.success === false &&
        wrongDevRes.error?.includes('This device is not registered for your account')
    ),
    'Clock In blocked on unregistered device',
    wrongDevRes.error
  );

  // CASE 3: Unapproved Branch IP
  const wrongIpRes = await recordAttendance({
    organizationId: org.id,
    staffProfileId: staff.id,
    userId: user.id,
    type: 'CLOCK_IN',
    requestIp: '198.51.100.99', // Wrong IP
    rawDeviceSecret: deviceSecret,
    coordinates: { latitude: 10.00000, longitude: 76.00000, accuracy: 10 },
  });
  assert(
    Boolean(
      wrongIpRes.success === false &&
        (wrongIpRes.error?.includes('not an approved branch network') ||
          wrongIpRes.error?.includes('not the registered branch network'))
    ),
    'Clock In blocked on unapproved IP',
    wrongIpRes.error
  );

  // CASE 4: Outside Branch Geofence
  const wrongGeoRes = await recordAttendance({
    organizationId: org.id,
    staffProfileId: staff.id,
    userId: user.id,
    type: 'CLOCK_IN',
    requestIp: '203.0.113.50',
    rawDeviceSecret: deviceSecret,
    coordinates: { latitude: 10.05000, longitude: 76.05000, accuracy: 10 }, // ~7.8 km away
  });
  assert(
    Boolean(
      wrongGeoRes.success === false &&
        wrongGeoRes.error?.includes('Outside branch geofence')
    ),
    'Clock In blocked outside branch geofence',
    wrongGeoRes.error
  );

  console.log('\n3. Testing Successful Clock In & Open Cycle Rules (Sections 17, 21)...');
  const validClockIn = await recordAttendance({
    organizationId: org.id,
    staffProfileId: staff.id,
    userId: user.id,
    type: 'CLOCK_IN',
    requestIp: '203.0.113.50',
    rawDeviceSecret: deviceSecret,
    coordinates: { latitude: 10.00000, longitude: 76.00000, accuracy: 10 },
  });
  assert(
    validClockIn.success === true,
    'Clock In allowed when all 3 layers + schedule pass',
    validClockIn.error
  );

  // Attempting second Clock In while cycle is open
  const doubleClockIn = await recordAttendance({
    organizationId: org.id,
    staffProfileId: staff.id,
    userId: user.id,
    type: 'CLOCK_IN',
    requestIp: '203.0.113.50',
    rawDeviceSecret: deviceSecret,
    coordinates: { latitude: 10.00000, longitude: 76.00000, accuracy: 10 },
  });
  assert(
    doubleClockIn.success === false && doubleClockIn.error === 'Already clocked in.',
    'Second Clock In blocked when cycle is open',
    doubleClockIn.error
  );

  console.log('\n4. Testing Double Verification on Clock Out (Section 16)...');
  // Attempt Clock Out from outside geofence
  const wrongGeoClockOut = await recordAttendance({
    organizationId: org.id,
    staffProfileId: staff.id,
    userId: user.id,
    type: 'CLOCK_OUT',
    requestIp: '203.0.113.50',
    rawDeviceSecret: deviceSecret,
    coordinates: { latitude: 10.05000, longitude: 76.05000, accuracy: 10 },
  });
  assert(
    Boolean(
      wrongGeoClockOut.success === false &&
        wrongGeoClockOut.error?.includes('Outside branch geofence')
    ),
    'Clock Out blocked when staff leaves branch geofence',
    wrongGeoClockOut.error
  );

  // Valid Clock Out
  const validClockOut = await recordAttendance({
    organizationId: org.id,
    staffProfileId: staff.id,
    userId: user.id,
    type: 'CLOCK_OUT',
    requestIp: '203.0.113.50',
    rawDeviceSecret: deviceSecret,
    coordinates: { latitude: 10.00000, longitude: 76.00000, accuracy: 10 },
  });
  assert(
    validClockOut.success === true,
    'Clock Out allowed when all 3 layers pass again',
    validClockOut.error
  );

  console.log('\n5. Testing Multi-Cycle Attendance & Limits (Sections 18, 19, 20)...');
  // Complete 4 more cycles (total 5 cycles for testing limit)
  for (let c = 2; c <= 5; c++) {
    const inRes = await recordAttendance({
      organizationId: org.id,
      staffProfileId: staff.id,
      userId: user.id,
      type: 'CLOCK_IN',
      requestIp: '203.0.113.50',
      rawDeviceSecret: deviceSecret,
      coordinates: { latitude: 10.00000, longitude: 76.00000, accuracy: 10 },
    });
    const outRes = await recordAttendance({
      organizationId: org.id,
      staffProfileId: staff.id,
      userId: user.id,
      type: 'CLOCK_OUT',
      requestIp: '203.0.113.50',
      rawDeviceSecret: deviceSecret,
      coordinates: { latitude: 10.00000, longitude: 76.00000, accuracy: 10 },
    });
    assert(
      inRes.success && outRes.success,
      `Completed attendance cycle ${c} / 5`
    );
  }

  // Check 6th Clock In attempt
  const sixthClockIn = await recordAttendance({
    organizationId: org.id,
    staffProfileId: staff.id,
    userId: user.id,
    type: 'CLOCK_IN',
    requestIp: '203.0.113.50',
    rawDeviceSecret: deviceSecret,
    coordinates: { latitude: 10.00000, longitude: 76.00000, accuracy: 10 },
  });

  assert(
    Boolean(
      sixthClockIn.success === false &&
        sixthClockIn.error?.includes("Today's maximum attendance cycles have been reached")
    ),
    '6th Clock In blocked after reaching MAX_DAILY_ATTENDANCE_CYCLES (5)',
    sixthClockIn.error
  );

  // Check status API payload
  const status = await getStaffTodayAttendanceStatus(staff.id);
  assert(
    Boolean(status.completedCycles === 5 && status.isDailyLimitReached === true),
    'Today status accurately reports 5 completed cycles and isDailyLimitReached = true'
  );

  console.log('\n================================================================');
  console.log(`Phase 12 Test Suite Completed: ${passed} PASSED, ${failed} FAILED.`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase12Tests().catch((err) => {
  console.error('Fatal error running Phase 12 test suite:', err);
  process.exit(1);
});
