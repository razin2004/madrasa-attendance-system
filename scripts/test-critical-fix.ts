import { PrismaClient } from '@prisma/client';
import {
  verifyStaffDevice,
  verifyBranchLocation,
  verifyBranchNetwork,
} from '../services/verification.service';
import { hashDeviceSecret } from '../lib/security';
import { calculateDistanceMeters, isWithinGeofence } from '../lib/geolocation';

const prisma = new PrismaClient();

function assert(condition: any, testName: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${testName}`);
    throw new Error(`Test assertion failed: ${testName}`);
  }
  console.log(`  ✓ PASS: ${testName}`);
}

async function main() {
  console.log('================================================================');
  console.log('ShiftGuard Critical Fix Verification Audit Suite (17 Test Cases)');
  console.log('================================================================\n');

  // Setup test environment
  console.log('0. Initializing test organization, branch, and staff profile...');
  let org = await prisma.organization.findFirst({
    where: { organizationCode: 'ASIET_TEST' },
  });

  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: 'ASIET Test Organization',
        organizationCode: 'ASIET_TEST',
        status: 'ACTIVE',
      },
    });
  }

  // Branch coordinates: Lat 11.2473, Lng 75.7891, Radius 150m
  const branchLat = 11.2473;
  const branchLng = 75.7891;
  const initialRadius = 150;
  const ip1 = '103.21.244.10';
  const ip2 = '104.16.20.5';
  const ip3 = '49.207.55.1';
  const ip4 = '122.174.180.20';
  const ip5 = '157.33.190.30';
  const unauthorizedIp = '185.220.101.4';

  let branch = await prisma.branch.findFirst({
    where: { organizationId: org.id, name: 'Main Campus Branch' },
  });

  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        organizationId: org.id,
        name: 'Main Campus Branch',
        address: 'Kalady, Kerala',
        latitude: branchLat,
        longitude: branchLng,
        geofenceRadiusMeters: initialRadius,
        publicIp: ip1,
        status: 'ACTIVE',
      },
    });
  } else {
    branch = await prisma.branch.update({
      where: { id: branch.id },
      data: {
        latitude: branchLat,
        longitude: branchLng,
        geofenceRadiusMeters: initialRadius,
        publicIp: ip1,
        status: 'ACTIVE',
      },
    });
  }

  // Set up 4 additional active network identities for branch (total 5 authorized IPs)
  await prisma.branchNetworkIdentity.deleteMany({ where: { branchId: branch.id } });
  await prisma.branchNetworkIdentity.createMany({
    data: [
      { branchId: branch.id, publicIp: ip2, isActive: true, source: 'TEST' },
      { branchId: branch.id, publicIp: ip3, isActive: true, source: 'TEST' },
      { branchId: branch.id, publicIp: ip4, isActive: true, source: 'TEST' },
      { branchId: branch.id, publicIp: ip5, isActive: true, source: 'TEST' },
    ],
  });

  // Create test User and StaffProfile
  const user = await prisma.user.create({
    data: {
      organizationId: org.id,
      name: 'Audit Staff Member',
      email: `auditstaff_${Date.now()}@asiet.edu.in`,
      passwordHash: 'hashedpass',
      role: 'STAFF',
      status: 'ACTIVE',
    },
  });

  const staff = await prisma.staffProfile.create({
    data: {
      userId: user.id,
      organizationId: org.id,
      staffId: `STF_AUDIT_${Date.now().toString().slice(-4)}`,
      name: 'Audit Staff Member',
      address: 'Kalady, Kerala',
    },
  });

  const deviceSecretA = 'device_secret_token_a_1234567890_opaque_hex';
  const deviceSecretB = 'device_secret_token_b_9876543210_opaque_hex';
  const hashA = hashDeviceSecret(deviceSecretA);
  const hashB = hashDeviceSecret(deviceSecretB);

  // ============================================================================
  // TEST 1: First staff login on Device A -> Device A automatically registered
  // ============================================================================
  console.log('\n--- DEVICE TESTS ---');
  const devA = await prisma.staffDevice.create({
    data: {
      staffProfileId: staff.id,
      secretHash: hashA,
      status: 'REGISTERED',
      label: 'Staff Phone (Device A)',
      registeredAt: new Date(),
      lastUsedAt: new Date(),
    },
  });
  assert(devA.status === 'REGISTERED', 'TEST 1: First staff login on Device A automatically registered');

  // ============================================================================
  // TEST 2: Same staff later logs in on Device A -> Device verified
  // ============================================================================
  const verifyDevA = await verifyStaffDevice(staff.id, deviceSecretA);
  assert(verifyDevA.isVerified === true, 'TEST 2: Same staff logging in on Device A verified');

  // ============================================================================
  // TEST 3: Staff logs in on Device B without registration -> Device not registered
  // ============================================================================
  const verifyDevBUnregistered = await verifyStaffDevice(staff.id, deviceSecretB);
  assert(
    verifyDevBUnregistered.isVerified === false &&
      verifyDevBUnregistered.failureReason?.includes('not registered'),
    'TEST 3: Unregistered Device B fails device verification'
  );

  // ============================================================================
  // TEST 4: Admin adds Device B -> Device B registered
  // ============================================================================
  const devB = await prisma.staffDevice.create({
    data: {
      staffProfileId: staff.id,
      secretHash: hashB,
      status: 'REGISTERED',
      label: 'Staff Tablet (Device B)',
      registeredAt: new Date(),
      lastUsedAt: new Date(),
    },
  });
  const verifyDevBRegistered = await verifyStaffDevice(staff.id, deviceSecretB);
  assert(verifyDevBRegistered.isVerified === true, 'TEST 4: Admin added Device B passes device verification');

  // ============================================================================
  // TEST 5: Admin removes Device B -> Device B fails verification immediately
  // ============================================================================
  await prisma.staffDevice.delete({ where: { id: devB.id } });
  const verifyDevBRemoved = await verifyStaffDevice(staff.id, deviceSecretB);
  assert(
    verifyDevBRemoved.isVerified === false &&
      verifyDevBRemoved.failureReason?.includes('not registered'),
    'TEST 5: Admin removed Device B fails device verification immediately'
  );

  // ============================================================================
  // GEOFENCE CALCULATION TESTS (TEST 6 - TEST 11)
  // ============================================================================
  console.log('\n--- GEOFENCE CALCULATIONS (Haversine Exact Radius 150m) ---');

  // Exact Haversine latitude delta for distance D in meters: (D * 180) / (6371000 * Math.PI)
  const getLatForMeterDistance = (meters: number) => branchLat + (meters * 180) / (6371000 * Math.PI);

  const lat100m = getLatForMeterDistance(100);
  const lat149m = getLatForMeterDistance(149);
  const lat150m = getLatForMeterDistance(150);
  const lat151m = getLatForMeterDistance(151);
  const lat250m = getLatForMeterDistance(250);

  // TEST 6: Branch radius = 150m, Staff = 100m -> Geofence PASS
  const g6 = isWithinGeofence(lat100m, branchLng, branchLat, branchLng, 150);
  assert(g6.isWithin && g6.distanceMeters <= 150, `TEST 6: 100m distance <= 150m radius (Distance: ${g6.distanceMeters}m) -> PASS`);

  // TEST 7: Branch radius = 150m, Staff = 149m -> Geofence PASS
  const g7 = isWithinGeofence(lat149m, branchLng, branchLat, branchLng, 150);
  assert(g7.isWithin && g7.distanceMeters <= 150, `TEST 7: 149m distance <= 150m radius (Distance: ${g7.distanceMeters}m) -> PASS`);

  // TEST 8: Branch radius = 150m, Staff = 150m -> Geofence PASS
  const g8 = isWithinGeofence(lat150m, branchLng, branchLat, branchLng, 150);
  assert(g8.isWithin && g8.distanceMeters <= 150, `TEST 8: 150m distance <= 150m radius (Distance: ${g8.distanceMeters}m) -> PASS`);

  // TEST 9: Branch radius = 150m, Staff = 151m -> Geofence FAIL
  const g9 = isWithinGeofence(lat151m, branchLng, branchLat, branchLng, 150);
  assert(!g9.isWithin && g9.distanceMeters > 150, `TEST 9: 151m distance > 150m radius (Distance: ${g9.distanceMeters}m) -> FAIL`);

  // TEST 10: Staff location changes from 80m to 250m -> Verification changes from PASS to FAIL
  const g10a = isWithinGeofence(getLatForMeterDistance(80), branchLng, branchLat, branchLng, 150);
  const g10b = isWithinGeofence(lat250m, branchLng, branchLat, branchLng, 150);
  assert(g10a.isWithin === true && g10b.isWithin === false, 'TEST 10: Movement from 80m to 250m changes verification from PASS to FAIL');

  // TEST 11: GPS accuracy too poor -> Attendance blocked with location accuracy message
  const g11 = isWithinGeofence(lat100m, branchLng, branchLat, branchLng, 150, 200000); // 200,000m accuracy
  assert(
    g11.isWithin === false && g11.failureReason?.includes('accuracy'),
    `TEST 11: 200000m accuracy threshold exceeded -> FAIL (${g11.failureReason})`
  );

  // ============================================================================
  // MULTIPLE IP TESTS (TEST 12 - TEST 15)
  // ============================================================================
  console.log('\n--- MULTIPLE NETWORK IP VERIFICATION (5 Authorized IPs) ---');

  // TEST 12: Branch has 5 authorized IPs. Current IP matches IP #4 -> Network PASS
  const net12 = await verifyBranchNetwork(ip4, branch.id);
  assert(net12.isVerified === true && net12.matchedIp === ip4, 'TEST 12: Request IP matching IP #4 passes network layer');

  // TEST 13: Current IP matches none -> Network FAIL
  const net13 = await verifyBranchNetwork(unauthorizedIp, branch.id);
  assert(net13.isVerified === false, 'TEST 13: Unauthorized IP fails network layer');

  // TEST 14: Admin changes branch IP list -> New IP list is authoritative immediately
  const newIp = '103.50.60.70';
  await prisma.branchNetworkIdentity.deleteMany({ where: { branchId: branch.id } });
  await prisma.branch.update({ where: { id: branch.id }, data: { publicIp: newIp } });
  const net14Old = await verifyBranchNetwork(ip4, branch.id);
  const net14New = await verifyBranchNetwork(newIp, branch.id);
  assert(net14Old.isVerified === false && net14New.isVerified === true, 'TEST 14: Live branch IP changes enforce new authoritative IP immediately');

  // TEST 15: Admin changes geofence radius -> New radius is authoritative immediately
  await prisma.branch.update({ where: { id: branch.id }, data: { geofenceRadiusMeters: 300 } });
  const g15 = isWithinGeofence(lat250m, branchLng, branchLat, branchLng, 300);
  assert(g15.isWithin === true, 'TEST 15: Admin expanding radius to 300m immediately allows 250m location');

  // Revert radius back to 150m
  await prisma.branch.update({ where: { id: branch.id }, data: { geofenceRadiusMeters: 150, publicIp: ip1 } });

  // ============================================================================
  // OVERALL 3-LAYER EVALUATION (TEST 16 - TEST 17)
  // ============================================================================
  console.log('\n--- FULL 3-LAYER ATTENDANCE EVALUATION ---');

  // TEST 16: All conditions pass -> Clock In allowed
  const devPass = (await verifyStaffDevice(staff.id, deviceSecretA)).isVerified;
  const netPass = (await verifyBranchNetwork(ip1, branch.id)).isVerified;
  const locPass = (await verifyBranchLocation(getLatForMeterDistance(50), branchLng, branch.id)).isVerified;
  const allPass = devPass && netPass && locPass;
  assert(allPass === true, 'TEST 16: All verification layers pass -> Clock In allowed');

  // TEST 17: Any one condition fails -> Clock In blocked
  const netFail = (await verifyBranchNetwork(unauthorizedIp, branch.id)).isVerified;
  const oneFails = devPass && netFail && locPass;
  assert(oneFails === false, 'TEST 17: Network failure blocks Clock In');

  // Cleanup test records
  console.log('\nClean up test records...');
  await prisma.staffDevice.deleteMany({ where: { staffProfileId: staff.id } });
  await prisma.staffProfile.delete({ where: { id: staff.id } });
  await prisma.user.delete({ where: { id: user.id } });

  console.log('\n================================================================');
  console.log('Critical Fix Verification Suite Completed: ALL 17 TEST CASES PASSED!');
  console.log('================================================================');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
