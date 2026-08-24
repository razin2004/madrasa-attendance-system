import fs from 'fs';
import path from 'path';

// 1. Load .env FIRST before initializing PrismaClient
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

import { prisma } from '../lib/prisma';
import { hashPassword, generateNumericPin, hashDeviceSecret, verifyPassword } from '../lib/security';
import { createSession, validateSessionToken, SESSION_DURATION_DAYS } from '../lib/session';
import {
  evaluateThreeLayerAttendance,
  recordAttendance,
  getStaffTodayAttendanceStatus,
  getStaffMonthlyAttendanceSummary,
} from '../services/attendance.service';

async function runPhase5Verification() {
  console.log('================================================================');
  console.log('SHIFTGUARD — PHASE 5 AUTOMATED VERIFICATION SUITE');
  console.log('================================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, label: string) {
    if (condition) {
      console.log(`  ✓ [PASS] ${label}`);
      passed++;
    } else {
      console.error(`  ✗ [FAIL] ${label}`);
      failed++;
    }
  }

  try {
    const timestamp = Date.now();

    // -------------------------------------------------------------------------
    // TEST 1: Setup Multi-Tenant Test Environment
    // -------------------------------------------------------------------------
    console.log('\n[1/8] Setting Up Multi-Tenant Organizations & Workplace Branches');

    const orgA = await prisma.organization.create({
      data: {
        organizationCode: `P5A${Math.floor(10 + Math.random() * 90)}`,
        name: `Org Phase 5 Test A ${timestamp}`,
        status: 'ACTIVE',
      },
    });

    const orgB = await prisma.organization.create({
      data: {
        organizationCode: `P5B${Math.floor(10 + Math.random() * 90)}`,
        name: `Org Phase 5 Test B ${timestamp}`,
        status: 'ACTIVE',
      },
    });

    // Branch 1: Main City Hospital (IP: 203.0.113.10, Coordinates: 12.971598, 77.594562, Radius: 150m)
    const branch1 = await prisma.branch.create({
      data: {
        organizationId: orgA.id,
        name: 'Main City Hospital',
        address: '100 Medical Center Drive',
        publicIp: '203.0.113.10',
        latitude: 12.971598,
        longitude: 77.594562,
        geofenceRadiusMeters: 150,
        status: 'ACTIVE',
      },
    });

    // Branch 2: Northside Emergency Clinic (IP: 198.51.100.20, Coordinates: 13.035800, 77.597000, Radius: 100m)
    const branch2 = await prisma.branch.create({
      data: {
        organizationId: orgA.id,
        name: 'Northside Emergency Clinic',
        address: '45 North Road',
        publicIp: '198.51.100.20',
        latitude: 13.0358,
        longitude: 77.597,
        geofenceRadiusMeters: 100,
        status: 'ACTIVE',
      },
    });

    // Org B Branch
    const branchB = await prisma.branch.create({
      data: {
        organizationId: orgB.id,
        name: 'Org B Branch',
        address: '99 Other Way',
        publicIp: '203.0.113.10',
        latitude: 12.971598,
        longitude: 77.594562,
        geofenceRadiusMeters: 150,
        status: 'ACTIVE',
      },
    });

    assert(branch1.id !== null && branch2.id !== null, 'Branches created with distinct IPs and GPS coordinates');

    // -------------------------------------------------------------------------
    // TEST 2: Staff Creation & Persistent 30-Day Session Validation (Section 4, 5, 6)
    // -------------------------------------------------------------------------
    console.log('\n[2/8] Testing Staff Credentials, PIN Verification & 30-Day Sessions');

    const pin = '482910';
    const pinHash = await hashPassword(pin);

    const user1 = await prisma.user.create({
      data: {
        organizationId: orgA.id,
        name: 'Nurse Clara Oswald',
        email: `stf001.${orgA.organizationCode?.toLowerCase()}@shiftguard.local`,
        passwordHash: pinHash,
        role: 'STAFF',
        status: 'ACTIVE',
      },
    });

    const staff1 = await prisma.staffProfile.create({
      data: {
        userId: user1.id,
        organizationId: orgA.id,
        staffId: 'STF001',
        name: 'Nurse Clara Oswald',
        phone: '+91 9876543210',
        address: 'London, UK',
      },
    });

    // Assign Branch 1 & Branch 2 to Staff 1
    await prisma.branchStaffAssignment.createMany({
      data: [
        { staffProfileId: staff1.id, branchId: branch1.id },
        { staffProfileId: staff1.id, branchId: branch2.id },
      ],
    });

    // Verify PIN authentication
    const isPinCorrect = await verifyPassword(pin, user1.passwordHash);
    const isPinWrong = await verifyPassword('000000', user1.passwordHash);
    assert(isPinCorrect === true, 'Correct 6-digit PIN verified');
    assert(isPinWrong === false, 'Incorrect PIN rejected');

    // Test 30-Day Persistent Session
    const session = await createSession(user1.id, { ipAddress: '203.0.113.10' });
    const diffDays = Math.round((session.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    assert(diffDays === 30, `Persistent session duration is 30 days (actual: ${diffDays} days)`);

    const validSession = await validateSessionToken(session.sessionToken);
    assert(validSession !== null, 'Session successfully validated in database');
    assert(validSession?.user.organizationId === orgA.id, 'Session retains tenant isolation context');

    // -------------------------------------------------------------------------
    // TEST 3: Layer 1: Registered Device Binding & Verification (Section 13, 29)
    // -------------------------------------------------------------------------
    console.log('\n[3/8] Testing Layer 1: Registered Device Binding & Token Verification');

    const validDeviceSecret = 'a1b2c3d4e5f6789012345678abcdef01';
    const secretHash = hashDeviceSecret(validDeviceSecret);

    const device = await prisma.staffDevice.create({
      data: {
        staffProfileId: staff1.id,
        secretHash,
        status: 'REGISTERED',
        label: 'Clara Mobile (Chrome on Android)',
        registeredAt: new Date(),
      },
    });

    // Evaluation with valid secret
    const evalValidDevice = await evaluateThreeLayerAttendance(
      staff1.id,
      orgA.id,
      '203.0.113.10',
      validDeviceSecret,
      { latitude: 12.971598, longitude: 77.594562 }
    );
    assert(evalValidDevice.layer1Device.isVerified === true, 'Layer 1: Valid registered device secret accepted');

    // Evaluation with wrong secret
    const evalWrongDevice = await evaluateThreeLayerAttendance(
      staff1.id,
      orgA.id,
      '203.0.113.10',
      'invalid_device_secret_string_123',
      { latitude: 12.971598, longitude: 77.594562 }
    );
    assert(evalWrongDevice.layer1Device.isVerified === false, 'Layer 1: Unregistered device secret rejected');
    assert(evalWrongDevice.isReady === false, 'Layer 1 failure marks isReady = false');

    // -------------------------------------------------------------------------
    // TEST 4: Layer 2: Branch Network & Public IP Verification (Section 14, 15, 16)
    // -------------------------------------------------------------------------
    console.log('\n[4/8] Testing Layer 2: Branch Network & Public IP Verification');

    // Case 1: IP matches Branch 1
    const evalBranch1Ip = await evaluateThreeLayerAttendance(
      staff1.id,
      orgA.id,
      '203.0.113.10',
      validDeviceSecret,
      { latitude: 12.971598, longitude: 77.594562 }
    );
    assert(evalBranch1Ip.layer2Network.isVerified === true, 'Layer 2: Request from Branch 1 public IP accepted');
    assert(evalBranch1Ip.candidateBranch?.name === 'Main City Hospital', 'Candidate branch identified as Main City Hospital');

    // Case 2: IP matches Branch 2
    const evalBranch2Ip = await evaluateThreeLayerAttendance(
      staff1.id,
      orgA.id,
      '198.51.100.20',
      validDeviceSecret,
      { latitude: 13.0358, longitude: 77.597 }
    );
    assert(evalBranch2Ip.layer2Network.isVerified === true, 'Layer 2: Request from Branch 2 public IP accepted');
    assert(evalBranch2Ip.candidateBranch?.name === 'Northside Emergency Clinic', 'Candidate branch identified as Northside Emergency Clinic');

    // Case 3: Unauthorized external IP (e.g. coffee shop WiFi / mobile data 192.0.2.1)
    const evalExternalIp = await evaluateThreeLayerAttendance(
      staff1.id,
      orgA.id,
      '192.0.2.1',
      validDeviceSecret,
      { latitude: 12.971598, longitude: 77.594562 }
    );
    assert(evalExternalIp.layer2Network.isVerified === false, 'Layer 2: Unauthorized public IP rejected');
    assert(evalExternalIp.isReady === false, 'Layer 2 failure marks isReady = false');

    // -------------------------------------------------------------------------
    // TEST 5: Layer 3: Physical Geofence Verification (Section 17, 18, 19)
    // -------------------------------------------------------------------------
    console.log('\n[5/8] Testing Layer 3: Geofence Verification & Distance Engine');

    // Case 1: Coordinates inside Branch 1 (~30m from center, radius is 150m)
    const evalInsideGeo = await evaluateThreeLayerAttendance(
      staff1.id,
      orgA.id,
      '203.0.113.10',
      validDeviceSecret,
      { latitude: 12.9718, longitude: 77.5947, accuracy: 10 }
    );
    assert(evalInsideGeo.layer3Geofence.isVerified === true, 'Layer 3: Location within 150m radius accepted');
    assert(evalInsideGeo.isReady === true, 'All 3 layers PASS -> isReady = true');

    // Case 2: Coordinates outside Branch 1 (~500m away)
    const evalOutsideGeo = await evaluateThreeLayerAttendance(
      staff1.id,
      orgA.id,
      '203.0.113.10',
      validDeviceSecret,
      { latitude: 12.976, longitude: 77.5947, accuracy: 10 } // ~500m away
    );
    assert(evalOutsideGeo.layer3Geofence.isVerified === false, 'Layer 3: Location 500m away rejected (exceeds 150m radius)');
    assert(evalOutsideGeo.isReady === false, 'Layer 3 failure marks isReady = false');

    // -------------------------------------------------------------------------
    // TEST 6: Clock In & Clock Out State Machine (Section 25, 26)
    // -------------------------------------------------------------------------
    console.log('\n[6/8] Testing Clock In & Clock Out State Transitions & Recording');

    // 1. Clock In when all 3 layers pass
    const clockInResult = await recordAttendance({
      organizationId: orgA.id,
      staffProfileId: staff1.id,
      userId: user1.id,
      type: 'CLOCK_IN',
      requestIp: '203.0.113.10',
      rawDeviceSecret: validDeviceSecret,
      coordinates: { latitude: 12.9718, longitude: 77.5947, accuracy: 10 },
    });

    assert(clockInResult.success === true, 'Clock In accepted when all 3 layers pass');
    assert(clockInResult.record?.verificationStatus === 'VERIFIED', 'Attendance record marked VERIFIED');
    assert(clockInResult.record?.branchId === branch1.id, 'Attendance record bound to Main City Hospital');

    // Verify current state is clocked in
    const stateAfterIn = await getStaffTodayAttendanceStatus(staff1.id);
    assert(stateAfterIn.isClockedIn === true, 'Today status reflects isClockedIn = true');

    // 2. Attempt duplicate Clock In while already clocked in
    const dupClockIn = await recordAttendance({
      organizationId: orgA.id,
      staffProfileId: staff1.id,
      userId: user1.id,
      type: 'CLOCK_IN',
      requestIp: '203.0.113.10',
      rawDeviceSecret: validDeviceSecret,
      coordinates: { latitude: 12.9718, longitude: 77.5947, accuracy: 10 },
    });
    assert(dupClockIn.success === false, 'Duplicate Clock In while already clocked in is blocked');

    // 3. Clock Out when all 3 layers pass
    const clockOutResult = await recordAttendance({
      organizationId: orgA.id,
      staffProfileId: staff1.id,
      userId: user1.id,
      type: 'CLOCK_OUT',
      requestIp: '203.0.113.10',
      rawDeviceSecret: validDeviceSecret,
      coordinates: { latitude: 12.9718, longitude: 77.5947, accuracy: 10 },
    });

    assert(clockOutResult.success === true, 'Clock Out accepted when all 3 layers pass');
    assert(clockOutResult.record?.verificationStatus === 'VERIFIED', 'Clock Out record marked VERIFIED');

    // Verify current state is clocked out
    const stateAfterOut = await getStaffTodayAttendanceStatus(staff1.id);
    assert(stateAfterOut.isClockedIn === false, 'Today status reflects isClockedIn = false');

    // 4. Attempt Clock Out when already clocked out
    const dupClockOut = await recordAttendance({
      organizationId: orgA.id,
      staffProfileId: staff1.id,
      userId: user1.id,
      type: 'CLOCK_OUT',
      requestIp: '203.0.113.10',
      rawDeviceSecret: validDeviceSecret,
      coordinates: { latitude: 12.9718, longitude: 77.5947, accuracy: 10 },
    });
    assert(dupClockOut.success === false, 'Clock Out when not clocked in is blocked');

    // -------------------------------------------------------------------------
    // TEST 7: Zero-Bypass Enforcements & Rejected Audit Logs
    // -------------------------------------------------------------------------
    console.log('\n[7/8] Testing Zero-Bypass Enforcements & Rejected Records');

    // Attempt Clock In with bad device -> must fail & record REJECTED
    const badDeviceClockIn = await recordAttendance({
      organizationId: orgA.id,
      staffProfileId: staff1.id,
      userId: user1.id,
      type: 'CLOCK_IN',
      requestIp: '203.0.113.10',
      rawDeviceSecret: 'invalid_secret_xyz',
      coordinates: { latitude: 12.9718, longitude: 77.5947, accuracy: 10 },
    });
    assert(badDeviceClockIn.success === false, 'Clock In with invalid device secret REJECTED');
    assert(badDeviceClockIn.record?.verificationStatus === 'REJECTED', 'Failed attempt logged as REJECTED record');

    // Attempt Clock In from wrong IP (coffee shop) -> must fail & record REJECTED
    const badIpClockIn = await recordAttendance({
      organizationId: orgA.id,
      staffProfileId: staff1.id,
      userId: user1.id,
      type: 'CLOCK_IN',
      requestIp: '192.0.2.55',
      rawDeviceSecret: validDeviceSecret,
      coordinates: { latitude: 12.9718, longitude: 77.5947, accuracy: 10 },
    });
    assert(badIpClockIn.success === false, 'Clock In with unauthorized IP REJECTED');

    // Attempt Clock In outside geofence -> must fail & record REJECTED
    const badGeoClockIn = await recordAttendance({
      organizationId: orgA.id,
      staffProfileId: staff1.id,
      userId: user1.id,
      type: 'CLOCK_IN',
      requestIp: '203.0.113.10',
      rawDeviceSecret: validDeviceSecret,
      coordinates: { latitude: 12.990, longitude: 77.5947, accuracy: 10 }, // 2km away
    });
    assert(badGeoClockIn.success === false, 'Clock In outside geofence REJECTED');

    // -------------------------------------------------------------------------
    // TEST 8: Monthly Attendance Summary & Multi-Tenant Isolation
    // -------------------------------------------------------------------------
    console.log('\n[8/8] Testing Monthly Attendance Summary & Multi-Tenant Isolation');

    const now = new Date();
    const monthlySummary = await getStaffMonthlyAttendanceSummary(
      staff1.id,
      now.getFullYear(),
      now.getMonth() + 1
    );
    assert(monthlySummary.totalRecords >= 2, 'Monthly summary returns attendance records');
    assert(monthlySummary.presentDaysCount === 1, 'Present days count is 1 for today');

    // Cross-tenant verification check
    const orgBCheck = await evaluateThreeLayerAttendance(
      staff1.id,
      orgB.id,
      '203.0.113.10',
      validDeviceSecret,
      { latitude: 12.9718, longitude: 77.5947, accuracy: 10 }
    );
    assert(orgBCheck.layer2Network.isVerified === false, 'Staff from Org A cannot verify against Org B (multi-tenant isolation check)');

    // -------------------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------------------
    await prisma.attendanceRecord.deleteMany({ where: { staffProfileId: staff1.id } }).catch(() => {});
    await prisma.staffDevice.deleteMany({ where: { staffProfileId: staff1.id } }).catch(() => {});
    await prisma.branchStaffAssignment.deleteMany({ where: { staffProfileId: staff1.id } }).catch(() => {});
    await prisma.staffProfile.deleteMany({ where: { id: staff1.id } }).catch(() => {});
    await prisma.session.deleteMany({ where: { userId: user1.id } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: user1.id } }).catch(() => {});
    await prisma.branch.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } }).catch(() => {});
    await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } }).catch(() => {});

    console.log('\n================================================================');
    console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');

    process.exit(failed === 0 ? 0 : 1);
  } catch (error: any) {
    console.error('Fatal verification error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runPhase5Verification();
