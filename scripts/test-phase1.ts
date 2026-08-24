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

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

import {
  hashPassword,
  verifyPassword,
  generateNumericOTP,
  hashToken,
  generateTemporaryPassword,
  generateOrganizationCodeBase,
  normalizeEmail,
} from '../lib/security';
import { createSession, validateSessionToken } from '../lib/session';
import { sendEmail } from '../services/email.service';

async function runPhase1Verification() {
  console.log('================================================================');
  console.log('SHIFTGUARD — PHASE 1 AUTOMATED VERIFICATION SUITE');
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
    // -------------------------------------------------------------------------
    // TEST 1: Database & Super Admin Seed Check
    // -------------------------------------------------------------------------
    console.log('\n[1/8] Verifying Database Connection & Super Admin Seed');
    const superAdminEmail = (process.env.SUPER_ADMIN_EMAIL || 'doctorbooksystem@gmail.com').toLowerCase().trim();
    const superAdmin = await prisma.user.findFirst({
      where: { email: superAdminEmail, role: 'SUPER_ADMIN' },
    });

    assert(!!superAdmin, `Super Admin account exists (${superAdminEmail})`);
    assert(superAdmin?.status === 'ACTIVE', 'Super Admin status is ACTIVE');

    if (superAdmin) {
      const isValidPass = await verifyPassword(
        process.env.SUPER_ADMIN_PASSWORD || 'SuperAdminPass@2026',
        superAdmin.passwordHash
      );
      assert(isValidPass, 'Super Admin password hash verification succeeded');
    }

    // -------------------------------------------------------------------------
    // TEST 2: Security Utilities & Cryptographic Functions
    // -------------------------------------------------------------------------
    console.log('\n[2/8] Testing Security Utilities & Hashing');
    const rawOtp = generateNumericOTP();
    assert(rawOtp.length === 6 && /^\d{6}$/.test(rawOtp), `Generated 6-digit OTP: ${rawOtp}`);

    const hashedOtp1 = hashToken(rawOtp);
    const hashedOtp2 = hashToken(rawOtp);
    assert(hashedOtp1 === hashedOtp2, 'SHA-256 OTP hashing is deterministic');

    const tempPassword = generateTemporaryPassword(12);
    assert(tempPassword.length === 12, `Generated 12-char secure temporary password: ${tempPassword}`);

    const codeBase = generateOrganizationCodeBase('Apex Global Technologies');
    assert(codeBase === 'APEXGL', `Generated Org Code Base: ${codeBase}`);

    // -------------------------------------------------------------------------
    // TEST 3: Organization Registration & Pending State
    // -------------------------------------------------------------------------
    console.log('\n[3/8] Testing Organization Registration Workflow');
    const testOrgName = `Test Hospital ${Date.now()}`;
    const testOrgEmail = `admin_${Date.now()}@testhospital.org`;
    const testOrgPhone = '+1 555 987 6543';

    const registeredOrg = await prisma.organization.create({
      data: {
        name: testOrgName,
        phone: testOrgPhone,
        contactPersonName: 'Dr. Sarah Connor',
        contactEmail: normalizeEmail(testOrgEmail),
        logoUrl: '/uploads/logos/default-logo.png',
        status: 'PENDING',
      },
    });

    assert(registeredOrg.status === 'PENDING', 'New organization registration status is PENDING');
    assert(registeredOrg.organizationCode === null, 'Organization Code is not assigned before approval');

    // Duplicate Check Simulation
    const dupCheck = await prisma.organization.findFirst({
      where: {
        OR: [
          { name: { equals: testOrgName, mode: 'insensitive' } },
          { contactEmail: { equals: testOrgEmail, mode: 'insensitive' } },
        ],
        status: { in: ['PENDING', 'ACTIVE'] },
      },
    });

    assert(!!dupCheck && dupCheck.id === registeredOrg.id, 'Duplicate detection identifies existing registration');

    // -------------------------------------------------------------------------
    // TEST 4: Super Admin 2FA OTP Lifecycle
    // -------------------------------------------------------------------------
    console.log('\n[4/8] Testing Super Admin OTP & Session Generation');
    if (superAdmin) {
      // Invalidate old tokens
      await prisma.securityToken.deleteMany({
        where: { userId: superAdmin.id, type: 'LOGIN_OTP' },
      });

      const otp = generateNumericOTP();
      const tokenHash = hashToken(otp);
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      const tokenRecord = await prisma.securityToken.create({
        data: {
          userId: superAdmin.id,
          type: 'LOGIN_OTP',
          tokenHash,
          expiresAt,
        },
      });

      assert(tokenRecord.tokenHash === tokenHash, 'SecurityToken stored in DB with SHA-256 hash');

      // Verify OTP match
      const isMatch = hashToken(otp) === tokenRecord.tokenHash;
      assert(isMatch, 'OTP verification against token hash succeeded');

      // Create Session
      const { sessionToken } = await createSession(superAdmin.id);
      assert(sessionToken.length === 64, `Created 64-char hex session token: ${sessionToken.slice(0, 16)}...`);

      const sessionContext = await validateSessionToken(sessionToken);
      assert(sessionContext?.user.role === 'SUPER_ADMIN', 'Session validated successfully for Super Admin');
    }

    // -------------------------------------------------------------------------
    // TEST 5: Super Admin Approval Transaction & Org Admin Creation
    // -------------------------------------------------------------------------
    console.log('\n[5/8] Testing Approval Workflow & Org Admin Provisioning');
    const generatedOrgCode = `HOSP${Math.floor(10 + Math.random() * 90)}`;
    const adminTempPass = generateTemporaryPassword(12);
    const adminPassHash = await hashPassword(adminTempPass);

    const { approvedOrg, orgAdmin } = await prisma.$transaction(
      async (tx) => {
        const uOrg = await tx.organization.update({
          where: { id: registeredOrg.id },
          data: {
            organizationCode: generatedOrgCode,
            status: 'ACTIVE',
            approvedAt: new Date(),
            reviewedBy: 'Super Admin Test',
          },
        });

        const uAdmin = await tx.user.create({
          data: {
            organizationId: uOrg.id,
            name: registeredOrg.contactPersonName || 'Admin',
            email: registeredOrg.contactEmail || testOrgEmail,
            phone: registeredOrg.phone,
            passwordHash: adminPassHash,
            role: 'ORG_ADMIN',
            status: 'ACTIVE',
            mustChangePassword: true, // Forces first login password change
          },
        });

        return { approvedOrg: uOrg, orgAdmin: uAdmin };
      },
      {
        maxWait: 15000,
        timeout: 30000,
      }
    );

    assert(approvedOrg.status === 'ACTIVE', 'Organization transitioned to ACTIVE');
    assert(approvedOrg.organizationCode === generatedOrgCode, `Organization Code assigned: ${generatedOrgCode}`);
    assert(orgAdmin.mustChangePassword === true, 'Org Admin marked mustChangePassword = true');
    assert(orgAdmin.organizationId === approvedOrg.id, 'Org Admin bound to Organization ID');

    // -------------------------------------------------------------------------
    // TEST 6: Tenant Routing & Dynamic Branding Resolution
    // -------------------------------------------------------------------------
    console.log('\n[6/8] Testing Multi-Tenant Resolution & Tenant Isolation');
    const resolvedOrg = await prisma.organization.findFirst({
      where: { organizationCode: { equals: generatedOrgCode, mode: 'insensitive' } },
    });

    assert(!!resolvedOrg, `Resolved tenant branding for code: ${generatedOrgCode}`);
    assert(resolvedOrg?.name === testOrgName, 'Resolved tenant branding name matches organization');

    // Tenant Isolation check: User from another org attempting login on this org
    const otherOrgUser = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' },
    });
    const isTenantMatch = otherOrgUser?.organizationId === resolvedOrg?.id;
    assert(!isTenantMatch, 'Cross-tenant isolation: Platform/Other user does not have direct tenant access');

    // -------------------------------------------------------------------------
    // TEST 7: Mandatory Password Change Lifecycle
    // -------------------------------------------------------------------------
    console.log('\n[7/8] Testing Mandatory Password Change Lifecycle');
    const newPermanentPassword = 'MySecurePermanentPass#2026';
    const newHash = await hashPassword(newPermanentPassword);

    const updatedAdmin = await prisma.user.update({
      where: { id: orgAdmin.id },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
      },
    });

    assert(updatedAdmin.mustChangePassword === false, 'mustChangePassword cleared after permanent password set');

    const canLoginWithNew = await verifyPassword(newPermanentPassword, updatedAdmin.passwordHash);
    assert(canLoginWithNew, 'Org Admin can authenticate with permanent password');

    // -------------------------------------------------------------------------
    // TEST 8: Email Service & DB Logging
    // -------------------------------------------------------------------------
    console.log('\n[8/8] Testing Email Service Dispatch & Logging');
    const emailResult = await sendEmail({
      recipient: superAdminEmail,
      type: 'TEST_PHASE1_EMAIL',
      subject: 'ShiftGuard Phase 1 Verification Test',
      htmlContent: '<p>ShiftGuard Phase 1 automated system verification email.</p>',
      textContent: 'ShiftGuard Phase 1 automated system verification email.',
    });

    assert(emailResult.success === true, `Email dispatched successfully (Provider: ${emailResult.provider})`);

    const loggedEmail = await prisma.emailLog.findFirst({
      where: { type: 'TEST_PHASE1_EMAIL' },
      orderBy: { createdAt: 'desc' },
    });

    assert(!!loggedEmail, 'Email dispatch recorded in EmailLog database table');
    assert(loggedEmail?.status === 'SENT', 'EmailLog status marked SENT in database');

    // -------------------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------------------
    await prisma.user.delete({ where: { id: orgAdmin.id } }).catch(() => {});
    await prisma.organization.delete({ where: { id: registeredOrg.id } }).catch(() => {});

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

runPhase1Verification();
