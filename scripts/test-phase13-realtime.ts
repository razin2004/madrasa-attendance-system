import { prisma } from '../lib/prisma';
import {
  evaluateThreeLayerAttendance,
  recordAttendance,
  getStaffTodayAttendanceStatus,
} from '../services/attendance.service';
import { assignOrUpdateStaffShift } from '../services/roster.service';

let passed = 0;
let failed = 0;

function assert(condition: any, testName: string, detail?: any) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    if (detail) console.error('    Detail:', detail);
    failed++;
  }
}

async function runRealTimeTests() {
  console.log('================================================================');
  console.log('ShiftGuard Phase 13: Real-Time Verification Refresh Suite');
  console.log('================================================================\n');

  // 1. SETUP CLEAN TENANT, BRANCH, USER, & STAFF
  const code = `REALTIME_${Date.now()}`;
  const org = await prisma.organization.create({
    data: {
      name: 'RealTime Test Org',
      organizationCode: code,
      contactEmail: `realtime_${Date.now()}@test.com`,
      status: 'ACTIVE',
    },
  });

  const branch = await prisma.branch.create({
    data: {
      organizationId: org.id,
      name: 'Central HQ Branch',
      address: '123 Tech Park',
      publicIp: '203.0.113.50',
      latitude: 10.00000,
      longitude: 76.00000,
      geofenceRadiusMeters: 150,
      status: 'ACTIVE',
    },
  });

  const user = await prisma.user.create({
    data: {
      organizationId: org.id,
      name: 'RealTime Staff User',
      email: `staff_rt_${Date.now()}@test.com`,
      passwordHash: 'hashed_pw',
      role: 'STAFF',
      status: 'ACTIVE',
    },
  });

  const deviceSecret = `DEV_SECRET_RT_${Date.now()}`;
  const crypto = require('crypto');
  const hashedSecret = crypto.createHash('sha256').update(deviceSecret).digest('hex');

  const staff = await prisma.staffProfile.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      staffId: `ST-RT-${Date.now()}`,
      name: 'Alice Realtime',
      address: '456 Staff Ave',
      branchAssignments: {
        create: {
          branchId: branch.id,
        },
      },
    },
    include: {
      devices: true,
      branchAssignments: true,
    },
  });

  await prisma.staffDevice.create({
    data: {
      staffProfileId: staff.id,
      secretHash: hashedSecret,
      status: 'REGISTERED',
      label: 'Alice Mobile Device',
    },
  });

  // Create Shift Pattern and Assign Schedule
  const shiftPattern = await prisma.shiftPattern.create({
    data: {
      organizationId: org.id,
      name: 'Standard Morning Shift',
      minimumStaffingThreshold: 1,
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

  await assignOrUpdateStaffShift({
    staffProfileId: staff.id,
    shiftPatternId: shiftPattern.id,
    effectiveFrom: new Date(Date.now() - 86400000), // Yesterday
    assignedBy: 'System Admin',
  });

  console.log('1. Testing Concurrent Admin Branch IP Change (Sections 4, 7, 19)...');
  // Step A: Verification passes on initial Branch IP (203.0.113.50)
  const initEval = await evaluateThreeLayerAttendance(
    staff.id,
    org.id,
    '203.0.113.50',
    deviceSecret,
    { latitude: 10.00000, longitude: 76.00000, accuracy: 10 }
  );
  assert(
    initEval.isReady === true && initEval.layer2Network.isVerified === true,
    'Initial precheck passes when request IP matches Branch IP'
  );

  // Step B: Admin changes Branch IP to 203.0.113.99 in DB
  await prisma.branch.update({
    where: { id: branch.id },
    data: { publicIp: '203.0.113.99' },
  });

  // Step C: Staff refreshes (without logging out) -> Precheck evaluates against new IP
  const postIpChangeEval = await evaluateThreeLayerAttendance(
    staff.id,
    org.id,
    '203.0.113.50', // Staff still on old IP
    deviceSecret,
    { latitude: 10.00000, longitude: 76.00000, accuracy: 10 }
  );
  assert(
    Boolean(
      postIpChangeEval.isReady === false &&
        postIpChangeEval.layer2Network.isVerified === false &&
        postIpChangeEval.failureReasons.some((r) => r.includes('not an approved branch network'))
    ),
    'Staff precheck immediately fails after Admin updates Branch IP in DB (without logout)',
    postIpChangeEval.failureReasons
  );

  // Step D: Clock In attempt blocked on old IP
  const clockInBlocked = await recordAttendance({
    organizationId: org.id,
    staffProfileId: staff.id,
    userId: user.id,
    type: 'CLOCK_IN',
    requestIp: '203.0.113.50',
    rawDeviceSecret: deviceSecret,
    coordinates: { latitude: 10.00000, longitude: 76.00000, accuracy: 10 },
  });
  assert(
    clockInBlocked.success === false,
    'Clock In blocked on old IP after Admin updates Branch IP in DB'
  );

  // Step E: Admin restores Branch IP to 203.0.113.50
  await prisma.branch.update({
    where: { id: branch.id },
    data: { publicIp: '203.0.113.50' },
  });
  const restoredEval = await evaluateThreeLayerAttendance(
    staff.id,
    org.id,
    '203.0.113.50',
    deviceSecret,
    { latitude: 10.00000, longitude: 76.00000, accuracy: 10 }
  );
  assert(
    restoredEval.isReady === true,
    'Precheck immediately passes when Admin restores Branch IP'
  );

  console.log('\n2. Testing Concurrent Admin Geofence Radius Change (Sections 9, 20)...');
  // Staff is at 10.0005, 76.0005 (~78 meters from branch center). Radius is 150m.
  const geoInitEval = await evaluateThreeLayerAttendance(
    staff.id,
    org.id,
    '203.0.113.50',
    deviceSecret,
    { latitude: 10.0005, longitude: 76.0005, accuracy: 5 }
  );
  assert(
    geoInitEval.layer3Geofence.isVerified === true,
    'Geofence passes when staff (78m away) is within 150m radius'
  );

  // Admin changes radius to 50m
  await prisma.branch.update({
    where: { id: branch.id },
    data: { geofenceRadiusMeters: 50 },
  });

  const geoPostChangeEval = await evaluateThreeLayerAttendance(
    staff.id,
    org.id,
    '203.0.113.50',
    deviceSecret,
    { latitude: 10.0005, longitude: 76.0005, accuracy: 5 }
  );
  assert(
    Boolean(
      geoPostChangeEval.layer3Geofence.isVerified === false &&
        geoPostChangeEval.failureReasons.some((r) => r.includes('Outside geofence'))
    ),
    'Geofence immediately fails after Admin reduces radius to 50m (without logout)',
    geoPostChangeEval.failureReasons
  );

  // Admin restores radius to 150m
  await prisma.branch.update({
    where: { id: branch.id },
    data: { geofenceRadiusMeters: 150 },
  });

  console.log('\n3. Testing Concurrent Branch Deactivation (Sections 10, 22)...');
  // Admin sets branch status to INACTIVE
  await prisma.branch.update({
    where: { id: branch.id },
    data: { status: 'INACTIVE' },
  });

  const inactEval = await evaluateThreeLayerAttendance(
    staff.id,
    org.id,
    '203.0.113.50',
    deviceSecret,
    { latitude: 10.00000, longitude: 76.00000, accuracy: 10 }
  );
  assert(
    Boolean(
      inactEval.isReady === false &&
        inactEval.failureReasons.some((r) => r.includes('This branch is currently inactive. Attendance is unavailable.'))
    ),
    'Precheck immediately reports inactive branch message when Admin deactivates Branch',
    inactEval.failureReasons
  );

  const inactClockIn = await recordAttendance({
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
      inactClockIn.success === false &&
        inactClockIn.error?.includes('This branch is currently inactive. Attendance is unavailable.')
    ),
    'Clock In blocked on inactive branch',
    inactClockIn.error
  );

  // Admin reactivates Branch
  await prisma.branch.update({
    where: { id: branch.id },
    data: { status: 'ACTIVE' },
  });

  console.log('\n4. Testing Concurrent Device Reset (Sections 11, 21)...');
  // Admin resets staff device in DB
  await prisma.staffDevice.updateMany({
    where: { staffProfileId: staff.id },
    data: { status: 'RESET_REQUIRED' },
  });

  const resetDevEval = await evaluateThreeLayerAttendance(
    staff.id,
    org.id,
    '203.0.113.50',
    deviceSecret,
    { latitude: 10.00000, longitude: 76.00000, accuracy: 10 }
  );
  assert(
    Boolean(
      resetDevEval.layer1Device.isVerified === false &&
        resetDevEval.failureReasons.some((r) => r.includes('registration was reset'))
    ),
    'Device verification immediately fails after Admin resets device in DB',
    resetDevEval.failureReasons
  );

  // Admin re-approves device
  await prisma.staffDevice.updateMany({
    where: { staffProfileId: staff.id },
    data: { status: 'REGISTERED' },
  });

  console.log('\n5. Testing Concurrent Schedule Change (Sections 12, 23)...');
  // Remove shift assignments for staff
  await prisma.shiftAssignment.deleteMany({
    where: { staffProfileId: staff.id },
  });

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
    'Clock In blocked immediately after Admin removes shift schedule',
    noSchedClockIn.error
  );

  console.log('\n================================================================');
  console.log(`Phase 13 Test Suite Completed: ${passed} PASSED, ${failed} FAILED.`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

runRealTimeTests().catch((err) => {
  console.error('Test script crashed:', err);
  process.exit(1);
});
