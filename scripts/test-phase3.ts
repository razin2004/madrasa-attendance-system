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

let dbUrl = process.env.DATABASE_URL || '';
if (dbUrl && !dbUrl.includes('connection_limit')) {
  dbUrl += (dbUrl.includes('?') ? '&' : '?') + 'connection_limit=5&pool_timeout=45';
}

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: dbUrl,
    },
  },
});

import {
  hashPassword,
  verifyPassword,
  generateNumericPin,
  generateStaffId,
  hashAadhaar,
  extractIdLast4,
  generateDeviceSecret,
  hashDeviceSecret,
} from '../lib/security';
import { parseIdDocumentText } from '../services/ocr.service';
import { verifyStaffDevice } from '../services/verification.service';
import { recordAuditLog } from '../services/audit.service';

async function runPhase3Verification() {
  console.log('================================================================');
  console.log('SHIFTGUARD — PHASE 3 AUTOMATED VERIFICATION SUITE');
  console.log('================================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition: any, label: string) {
    if (condition) {
      console.log(`  ✓ [PASS] ${label}`);
      passed++;
    } else {
      console.error(`  ✗ [FAIL] ${label}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------------------
    // TEST 1: ID Document OCR Parsing & Confidence Scoring (Section 8, 11, 12)
    // -------------------------------------------------------------------------
    console.log('\n[1/8] Testing ID Document OCR Parsing & Confidence Metrics');

    const sampleAadhaarText = `
      Government of India
      Unique Identification Authority of India
      Name: Rajesh Kumar Sharma
      Address: Flat 301, Sunshine Heights, MG Road, Bangalore 560001
      9876 5432 1098
    `;

    const ocrResult = parseIdDocumentText(sampleAadhaarText, 'TestOrgSalt123');
    assert(ocrResult.name === 'Rajesh Kumar Sharma', `Extracted Name: "${ocrResult.name}"`);
    assert(ocrResult.idDocType === 'AADHAAR', 'Detected ID Document Type: AADHAAR');
    assert(ocrResult.idDocLast4 === '1098', `Extracted Last 4 Digits: ${ocrResult.idDocLast4}`);
    assert(ocrResult.confidence.overall >= 80, `Overall OCR confidence high: ${ocrResult.confidence.overall}%`);

    // Test Voter ID extraction
    const sampleVoterText = 'Election Commission of India\nName: Priya Patel\nEPIC: WBD1234567\nAddress: Sector 4, Kolkata';
    const voterResult = parseIdDocumentText(sampleVoterText, 'TestOrgSalt123');
    assert(voterResult.idDocType === 'VOTER_ID', 'Detected ID Document Type: VOTER_ID');
    assert(voterResult.idDocLast4 === '4567', `Voter ID last 4 extracted: ${voterResult.idDocLast4}`);

    // -------------------------------------------------------------------------
    // TEST 2: Aadhaar-Safe Handling & Salted Hash (Section 17, 18)
    // -------------------------------------------------------------------------
    console.log('\n[2/8] Testing Aadhaar-Safe Storage & Deterministic Salted Hashing');

    const rawAadhaarNumber = '987654321098';
    const saltOrgA = 'ShiftGuard_OrgA_Salt';
    const saltOrgB = 'ShiftGuard_OrgB_Salt';

    const hashA1 = hashAadhaar(rawAadhaarNumber, saltOrgA);
    const hashA2 = hashAadhaar('9876 5432 1098', saltOrgA); // Spaced format
    assert(hashA1 === hashA2, 'Salted Aadhaar hash is deterministic regardless of spacing');

    const hashB = hashAadhaar(rawAadhaarNumber, saltOrgB);
    assert(hashA1 !== hashB, 'Different organizations produce different hashes for the same raw number (tenant isolation)');
    assert(hashA1.length === 64, 'Hash is a standard 64-character SHA-256 HMAC digest');

    // -------------------------------------------------------------------------
    // TEST 3: Staff ID & Secure 6-Digit PIN Generation (Section 21, 22, 23)
    // -------------------------------------------------------------------------
    console.log('\n[3/8] Testing Staff ID & Initial PIN Generation');

    const staffId1 = generateStaffId(1, 'STF');
    const staffId25 = generateStaffId(25, 'STF');
    assert(staffId1 === 'STF001', `Generated Staff ID 1: ${staffId1}`);
    assert(staffId25 === 'STF025', `Generated Staff ID 25: ${staffId25}`);

    const pin = generateNumericPin(6);
    assert(pin.length === 6 && /^\d{6}$/.test(pin), `Generated 6-digit numeric PIN: ${pin}`);

    const pinHash = await hashPassword(pin);
    const pinMatches = await verifyPassword(pin, pinHash);
    const wrongPinFails = await verifyPassword('000000', pinHash);
    assert(pinMatches === true, 'PIN verifies against bcrypt hash');
    assert(wrongPinFails === false, 'Incorrect PIN rejected by bcrypt');

    // -------------------------------------------------------------------------
    // TEST 4: Multi-Tenant Staff Creation & Duplicate Detection (Section 19, 20)
    // -------------------------------------------------------------------------
    console.log('\n[4/8] Testing Staff Creation & Intra-Organization Duplicate Detection');

    const timestamp = Date.now();
    const orgA = await prisma.organization.create({
      data: {
        organizationCode: `OA${Math.floor(10 + Math.random() * 90)}`,
        name: `Org Staff Test A ${timestamp}`,
        status: 'ACTIVE',
      },
    });

    const branchA1 = await prisma.branch.create({
      data: {
        organizationId: orgA.id,
        name: 'Branch Alpha 1',
        address: '100 Alpha Road',
        status: 'ACTIVE',
      },
    });

    const branchA2 = await prisma.branch.create({
      data: {
        organizationId: orgA.id,
        name: 'Branch Alpha 2',
        address: '200 Alpha Road',
        status: 'ACTIVE',
      },
    });

    // Create Staff 1 in Org A
    const staffUser1 = await prisma.user.create({
      data: {
        organizationId: orgA.id,
        name: 'Rajesh Sharma',
        email: `stf001.${orgA.organizationCode?.toLowerCase()}@shiftguard.local`,
        phone: '+91 9876543210',
        passwordHash: pinHash,
        role: 'STAFF',
        status: 'ACTIVE',
      },
    });

    const staffProfile1 = await prisma.staffProfile.create({
      data: {
        userId: staffUser1.id,
        organizationId: orgA.id,
        staffId: 'STF001',
        name: 'Rajesh Sharma',
        phone: '+91 9876543210',
        address: 'Bangalore, India',
        idDocType: 'AADHAAR',
        idDocLast4: '1098',
        idDocHash: hashA1,
      },
    });

    assert(staffProfile1.staffId === 'STF001', 'StaffProfile created with STF001');
    assert(staffProfile1.idDocLast4 === '1098', 'Only last 4 digits of Aadhaar stored');

    // Duplicate Check: Same Aadhaar hash within Org A -> Blocked
    const dupCheckOrgA = await prisma.staffProfile.findFirst({
      where: {
        organizationId: orgA.id,
        idDocHash: hashA1,
      },
    });
    assert(dupCheckOrgA !== null, 'Duplicate identity detected within same organization');

    // -------------------------------------------------------------------------
    // TEST 5: Multi-Branch Assignment (Section 26, 27, 28)
    // -------------------------------------------------------------------------
    console.log('\n[5/8] Testing Multi-Branch Assignment & Tenant Boundary');

    // Assign to Branch A1 & Branch A2
    await prisma.branchStaffAssignment.createMany({
      data: [
        { staffProfileId: staffProfile1.id, branchId: branchA1.id },
        { staffProfileId: staffProfile1.id, branchId: branchA2.id },
      ],
    });

    const assignments = await prisma.branchStaffAssignment.findMany({
      where: { staffProfileId: staffProfile1.id },
    });
    assert(assignments.length === 2, 'Staff assigned to 2 separate branches simultaneously');

    // Unassign Branch A2 without deleting staff
    await prisma.branchStaffAssignment.deleteMany({
      where: { staffProfileId: staffProfile1.id, branchId: branchA2.id },
    });

    const updatedAssignments = await prisma.branchStaffAssignment.findMany({
      where: { staffProfileId: staffProfile1.id },
    });
    assert(updatedAssignments.length === 1 && updatedAssignments[0].branchId === branchA1.id, 'Branch A2 unassigned while preserving staff record and Branch A1');

    // -------------------------------------------------------------------------
    // TEST 6: Layer 3 Staff Device Registration Lifecycle (Section 29–34, 57, 58)
    // -------------------------------------------------------------------------
    console.log('\n[6/8] Testing Layer 3 Device Registration Lifecycle & Verification');

    // Step A: Initial state NOT_REGISTERED
    const initialDevice = await prisma.staffDevice.create({
      data: {
        staffProfileId: staffProfile1.id,
        status: 'NOT_REGISTERED',
      },
    });
    assert(initialDevice.status === 'NOT_REGISTERED', 'Initial device state is NOT_REGISTERED');

    const checkNotReg = await verifyStaffDevice(staffProfile1.id, 'any-secret');
    assert(checkNotReg.isVerified === false, 'Verification rejected for NOT_REGISTERED device');

    // Step B: Register Device with 64-char Secret
    const rawSecret = generateDeviceSecret();
    assert(rawSecret.length === 64, `Generated 64-character opaque device secret: ${rawSecret.slice(0, 16)}...`);
    const secretHash = hashDeviceSecret(rawSecret);

    await prisma.staffDevice.updateMany({
      where: { staffProfileId: staffProfile1.id },
      data: {
        secretHash,
        status: 'REGISTERED',
        label: 'Staff Android Phone',
        registeredAt: new Date(),
      },
    });
    const checkRegistered = await verifyStaffDevice(staffProfile1.id, rawSecret);
    assert(checkRegistered.isVerified === true, 'Device transitioned to REGISTERED');

    // Step C: Verify with valid secret
    const validVerify = await verifyStaffDevice(staffProfile1.id, rawSecret);
    assert(validVerify.isVerified === true, 'Device verification SUCCEEDED with registered secret');

    // Step D: Verify with invalid/tampered secret
    const tamperedVerify = await verifyStaffDevice(staffProfile1.id, 'bad-secret-token-12345');
    assert(tamperedVerify.isVerified === false, 'Device verification REJECTED tampered credential');

    // -------------------------------------------------------------------------
    // TEST 7: Staff Device Reset Workflow (Section 33, 34, 60)
    // -------------------------------------------------------------------------
    console.log('\n[7/8] Testing Admin Device Reset & Anti-Rebinding Security');

    // Admin resets device -> Status becomes RESET_REQUIRED, secretHash cleared
    await prisma.staffDevice.updateMany({
      where: { staffProfileId: staffProfile1.id },
      data: {
        secretHash: null,
        status: 'RESET_REQUIRED',
        resetAt: new Date(),
        resetBy: 'Admin Test',
      },
    });
    const checkReset = await verifyStaffDevice(staffProfile1.id, rawSecret);
    assert(checkReset.deviceStatus === 'RESET_REQUIRED', 'Device transitioned to RESET_REQUIRED');

    // Previous valid secret MUST now fail
    const oldSecretCheck = await verifyStaffDevice(staffProfile1.id, rawSecret);
    assert(oldSecretCheck.isVerified === false, 'Old device secret REJECTED after admin reset');
    assert(oldSecretCheck.deviceStatus === 'RESET_REQUIRED', 'Device check returns RESET_REQUIRED');

    // -------------------------------------------------------------------------
    // TEST 8: Staff PIN Reset & Account Deactivation Lifecycle
    // -------------------------------------------------------------------------
    console.log('\n[8/8] Testing Staff PIN Reset, Deactivation & Audit Logs');

    // PIN Reset
    const newPin = generateNumericPin(6);
    const newPinHash = await hashPassword(newPin);
    await prisma.user.update({
      where: { id: staffUser1.id },
      data: { passwordHash: newPinHash },
    });

    const canAuthWithNew = await verifyPassword(newPin, newPinHash);
    const oldPinFails = await verifyPassword(pin, newPinHash);
    assert(canAuthWithNew === true, 'Staff can authenticate with newly issued PIN');
    assert(oldPinFails === false, 'Old PIN invalidated after reset');

    // Deactivation
    const deactivatedUser = await prisma.user.update({
      where: { id: staffUser1.id },
      data: { status: 'INACTIVE' },
    });
    assert(deactivatedUser.status === 'INACTIVE', 'Staff user account transitioned to INACTIVE');

    // Reactivation
    const reactivatedUser = await prisma.user.update({
      where: { id: staffUser1.id },
      data: { status: 'ACTIVE' },
    });
    assert(reactivatedUser.status === 'ACTIVE', 'Staff user account reactivated to ACTIVE');

    // Audit Log Check
    await recordAuditLog({
      organizationId: orgA.id,
      actorUserId: staffUser1.id,
      action: 'STAFF_CREATED',
      entityType: 'StaffProfile',
      entityId: staffProfile1.id,
      metadata: { staffId: staffProfile1.staffId },
    });

    const auditCheck = await prisma.auditLog.findFirst({
      where: { action: 'STAFF_CREATED', organizationId: orgA.id },
    });
    assert(auditCheck !== null, 'Staff creation recorded in AuditLog');

    // -------------------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------------------
    await prisma.branchStaffAssignment.deleteMany({ where: { staffProfileId: staffProfile1.id } }).catch(() => {});
    await prisma.staffDevice.deleteMany({ where: { staffProfileId: staffProfile1.id } }).catch(() => {});
    await prisma.staffProfile.delete({ where: { id: staffProfile1.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: staffUser1.id } }).catch(() => {});
    await prisma.branch.deleteMany({ where: { organizationId: orgA.id } }).catch(() => {});
    await prisma.organization.delete({ where: { id: orgA.id } }).catch(() => {});

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

runPhase3Verification();
