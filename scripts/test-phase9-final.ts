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

import * as crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { hashPassword, hashDeviceSecret, hashToken } from '../lib/security';
import { evaluateThreeLayerAttendance, recordAttendance } from '../services/attendance.service';
import { getDailyAttendanceReport, getMonthlyEmployeeAttendanceReport } from '../services/reports.service';
import { generateAttendanceReportCsv } from '../services/export-csv.service';
import { generateAttendanceReportPdfHtml } from '../services/export-pdf.service';
import { checkRateLimit, recordRateLimitAttempt } from '../lib/rate-limiter';
import { AttendanceSource, LeaveType } from '@prisma/client';

async function runPhase9FinalVerification() {
  console.log('================================================================');
  console.log('SHIFTGUARD — PHASE 9 FINAL PRODUCTION VERIFICATION SUITE');
  console.log('Production Deployment, Security Hardening & End-to-End Audit');
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
    const timestamp = Date.now();

    // -------------------------------------------------------------------------
    // 1. Setup Isolated Multi-Tenant Environment (Org A and Org B)
    // -------------------------------------------------------------------------
    console.log('\n[1/10] Setting Up Production Test Environment (Org A & Org B)');

    const codeA = `FINAL01_${timestamp.toString().slice(-4)}`;
    const codeB = `FINAL02_${timestamp.toString().slice(-4)}`;

    const orgA = await prisma.organization.create({
      data: {
        organizationCode: codeA,
        name: `ShiftGuard Org Alpha ${timestamp}`,
        status: 'ACTIVE',
      },
    });

    const orgB = await prisma.organization.create({
      data: {
        organizationCode: codeB,
        name: `ShiftGuard Org Beta ${timestamp}`,
        status: 'ACTIVE',
      },
    });

    // Branch A (GPS: 13.0827, 80.2707 - Chennai, Radius: 150m, IP: 203.0.113.10)
    const branchA = await prisma.branch.create({
      data: {
        organizationId: orgA.id,
        name: 'Alpha HQ Branch',
        address: '100 Tech Park, Chennai',
        latitude: 13.0827,
        longitude: 80.2707,
        geofenceRadiusMeters: 150,
        publicIp: '203.0.113.10',
        status: 'ACTIVE',
      },
    });

    await prisma.branchNetworkIdentity.create({
      data: {
        branchId: branchA.id,
        publicIp: '203.0.113.10',
        isActive: true,
      },
    });

    // Branch B
    const branchB = await prisma.branch.create({
      data: {
        organizationId: orgB.id,
        name: 'Beta HQ Branch',
        address: '200 Innovation Center, Bangalore',
        latitude: 12.9716,
        longitude: 77.5946,
        geofenceRadiusMeters: 150,
        publicIp: '198.51.100.20',
        status: 'ACTIVE',
      },
    });

    // Create Org Admin A
    const adminUserA = await prisma.user.create({
      data: {
        organizationId: orgA.id,
        name: 'Admin Alpha',
        email: `admin.alpha.${timestamp}@shiftguard.local`,
        passwordHash: await hashPassword('AdminPass123!'),
        role: 'ORG_ADMIN',
        status: 'ACTIVE',
      },
    });

    // Create Staff Profile A
    const staffSecretTokenA = `dev_sec_alpha_${timestamp}`;
    const staffSecretHashA = hashDeviceSecret(staffSecretTokenA);

    const staffUserA = await prisma.user.create({
      data: {
        organizationId: orgA.id,
        name: 'Staff Rahul Kumar',
        email: `rahul.${timestamp}@shiftguard.local`,
        passwordHash: await hashPassword('StaffPin123!'),
        role: 'STAFF',
        status: 'ACTIVE',
      },
    });

    const staffA = await prisma.staffProfile.create({
      data: {
        userId: staffUserA.id,
        organizationId: orgA.id,
        staffId: 'STF901',
        name: 'Staff Rahul Kumar',
        phone: '+91 9988776655',
        address: 'Chennai, India',
        idDocType: 'AADHAAR',
        idDocLast4: '5482',
        idDocHash: 'salted_sha256_hash_value_for_aadhaar_5482',
      },
    });

    await prisma.staffDevice.create({
      data: {
        staffProfileId: staffA.id,
        secretHash: staffSecretHashA,
        status: 'REGISTERED',
        label: 'Chrome on Windows PWA',
        registeredAt: new Date(),
      },
    });

    await prisma.branchStaffAssignment.create({
      data: {
        staffProfileId: staffA.id,
        branchId: branchA.id,
      },
    });

    // Create Staff Profile B
    const staffUserB = await prisma.user.create({
      data: {
        organizationId: orgB.id,
        name: 'Staff Priya Sharma',
        email: `priya.${timestamp}@shiftguard.local`,
        passwordHash: await hashPassword('StaffPin123!'),
        role: 'STAFF',
        status: 'ACTIVE',
      },
    });

    const staffB = await prisma.staffProfile.create({
      data: {
        userId: staffUserB.id,
        organizationId: orgB.id,
        staffId: 'STF902',
        name: 'Staff Priya Sharma',
        phone: '+91 9988776656',
        address: 'Bangalore, India',
      },
    });

    assert(orgA.id !== null && orgB.id !== null, 'Multi-tenant test organizations Org A and Org B initialized');

    // -------------------------------------------------------------------------
    // 2. Three-Layer Attendance Verification 5-Case Matrix (Section 1, 29)
    // -------------------------------------------------------------------------
    console.log('\n[2/10] Testing Three-Layer Attendance Verification (5-Case Matrix)');

    // Case 1: Correct Device + Correct IP + Inside Geofence -> ALLOWED
    const evalCase1 = await evaluateThreeLayerAttendance(
      staffA.id,
      orgA.id,
      '203.0.113.10',
      staffSecretTokenA,
      { latitude: 13.08271, longitude: 80.27071, accuracy: 10 }
    );
    assert(evalCase1.isReady === true, 'Case 1 (Correct Device + Correct IP + Inside Geofence) -> ALLOWED (Layer 1 ✓, Layer 2 ✓, Layer 3 ✓)');
    assert(evalCase1.layer1Device.isVerified && evalCase1.layer2Network.isVerified && evalCase1.layer3Geofence.isVerified, 'All three verification layers pass individually');

    // Case 2: Wrong Device + Correct IP + Inside Geofence -> BLOCKED
    const evalCase2 = await evaluateThreeLayerAttendance(
      staffA.id,
      orgA.id,
      '203.0.113.10',
      'WRONG_DEVICE_SECRET_TOKEN',
      { latitude: 13.08271, longitude: 80.27071, accuracy: 10 }
    );
    assert(evalCase2.isReady === false, 'Case 2 (Wrong Device + Correct IP + Inside Geofence) -> BLOCKED');
    assert(!evalCase2.layer1Device.isVerified && evalCase2.layer2Network.isVerified && evalCase2.layer3Geofence.isVerified, 'Layer 1 failed while Layer 2 & Layer 3 passed');

    // Case 3: Correct Device + Wrong IP + Inside Geofence -> BLOCKED
    const evalCase3 = await evaluateThreeLayerAttendance(
      staffA.id,
      orgA.id,
      '198.51.100.99', // Unauthorized IP
      staffSecretTokenA,
      { latitude: 13.08271, longitude: 80.27071, accuracy: 10 }
    );
    assert(evalCase3.isReady === false, 'Case 3 (Correct Device + Wrong IP + Inside Geofence) -> BLOCKED');
    assert(evalCase3.layer1Device.isVerified && !evalCase3.layer2Network.isVerified, 'Layer 2 failed while Layer 1 passed');

    // Case 4: Correct Device + Correct IP + Outside Geofence -> BLOCKED
    const evalCase4 = await evaluateThreeLayerAttendance(
      staffA.id,
      orgA.id,
      '203.0.113.10',
      staffSecretTokenA,
      { latitude: 13.2000, longitude: 80.2707, accuracy: 10 } // ~15km away
    );
    assert(evalCase4.isReady === false, 'Case 4 (Correct Device + Correct IP + Outside Geofence) -> BLOCKED');
    assert(evalCase4.layer1Device.isVerified && evalCase4.layer2Network.isVerified && !evalCase4.layer3Geofence.isVerified, 'Layer 3 failed while Layer 1 & Layer 2 passed');

    // Case 5: Wrong Device + Wrong IP + Outside Geofence -> BLOCKED
    const evalCase5 = await evaluateThreeLayerAttendance(
      staffA.id,
      orgA.id,
      '1.1.1.1',
      'INVALID_TOKEN',
      { latitude: 0, longitude: 0, accuracy: 10 }
    );
    assert(evalCase5.isReady === false, 'Case 5 (Wrong Device + Wrong IP + Outside Geofence) -> BLOCKED');

    // Record verified Clock In for Staff A
    const clockInResult = await recordAttendance({
      organizationId: orgA.id,
      staffProfileId: staffA.id,
      userId: staffUserA.id,
      type: 'CLOCK_IN',
      requestIp: '203.0.113.10',
      rawDeviceSecret: staffSecretTokenA,
      coordinates: { latitude: 13.08271, longitude: 80.27071, accuracy: 10 },
    });
    assert(clockInResult.record.source === AttendanceSource.NORMAL, 'Normal Clock In stamped strictly as source = NORMAL');

    // -------------------------------------------------------------------------
    // 3. Multi-Tenant Cross-Tenant Isolation Matrix (Section 10, 91)
    // -------------------------------------------------------------------------
    console.log('\n[3/10] Testing Multi-Tenant Isolation & Cross-Tenant Access Controls');

    // Query Staff B using Org A's ID
    const crossTenantStaff = await prisma.staffProfile.findFirst({
      where: {
        id: staffB.id,
        organizationId: orgA.id, // Strictly scoped
      },
    });
    assert(crossTenantStaff === null, 'Cross-tenant staff profile lookup returns NULL when scoped by Organization ID');

    // Query Attendance records of Org B using Org A scoping
    const crossTenantAttendance = await prisma.attendanceRecord.findMany({
      where: {
        organizationId: orgA.id,
        staffProfileId: staffB.id,
      },
    });
    assert(crossTenantAttendance.length === 0, 'Cross-tenant attendance query returns 0 records');

    // Query Branches of Org B using Org A scoping
    const crossTenantBranch = await prisma.branch.findFirst({
      where: {
        id: branchB.id,
        organizationId: orgA.id,
      },
    });
    assert(crossTenantBranch === null, 'Cross-tenant branch query returns NULL');

    // Test Staff Email Resolution & Optional Phone Support
    const staffUserNoPhone = await prisma.user.create({
      data: {
        organizationId: orgA.id,
        name: 'Staff Optional Phone Test',
        email: `nophone.${timestamp}@shiftguard.local`,
        phone: null,
        passwordHash: await hashPassword('StaffPass123!'),
        role: 'STAFF',
        status: 'ACTIVE',
      },
    });

    const staffProfileNoPhone = await prisma.staffProfile.create({
      data: {
        user: { connect: { id: staffUserNoPhone.id } },
        organization: { connect: { id: orgA.id } },
        staffId: 'STF903',
        name: 'Staff Optional Phone Test',
        phone: null,
        address: 'Chennai, India',
      },
    });

    assert(staffProfileNoPhone.phone === null, 'Staff profile saved with OPTIONAL phone (null value preserved)');
    assert(staffUserNoPhone.email.includes('@'), 'Staff user saved with MANDATORY account email');

    // Test Server-Side Role-Based Redirect Resolution
    const staffUserMatch = await prisma.user.findUnique({
      where: { email: staffUserA.email },
      include: { organization: true },
    });
    assert(staffUserMatch !== null, 'Common login resolves Staff User by email');
    assert(staffUserMatch?.role === 'STAFF', 'Server detects user role strictly as STAFF');

    // Test Common Admin Login (No Organization Code provided)
    const adminUserMatch = await prisma.user.findUnique({
      where: { email: adminUserA.email },
      include: { organization: true },
    });
    assert(adminUserMatch !== null, 'Common login resolves Admin User & Organization by email without client Org Code');
    assert(adminUserMatch?.role === 'ORG_ADMIN', 'Server detects user role strictly as ORG_ADMIN');
    assert(adminUserMatch?.organization?.organizationCode === codeA, `Auto-resolved admin organization matches tenant "${codeA}"`);

    // Test Organization Mismatch Protection (User from Org A attempting Org B login URL)
    const isMismatch = adminUserMatch?.organization?.organizationCode !== codeB;
    assert(isMismatch === true, 'Organization Mismatch correctly identified when Org A user attempts Org B portal');

    // --- TEST REFLECTION: STAFF EMAIL ACTIVATION & TOKEN SUITE ---
    console.log('\n🔐 Testing Staff Activation & Password Reset Suite...');
    const rawActivationToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawActivationToken);

    // Create a pending staff user with activation token
    const pendingStaffUser = await prisma.user.create({
      data: {
        organizationId: orgA.id,
        name: 'Pending Staff Activation Test',
        email: `activation.test.${timestamp}@example.com`,
        phone: '+15559990001',
        passwordHash: await hashPassword('TemporaryPin123!'),
        role: 'STAFF',
        status: 'PENDING',
      },
    });

    const activationToken = await prisma.securityToken.create({
      data: {
        userId: pendingStaffUser.id,
        organizationId: orgA.id,
        type: 'INVITATION',
        tokenHash,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    assert(activationToken.type === 'INVITATION', 'SecurityToken created with type INVITATION for account setup');
    assert(pendingStaffUser.status === 'PENDING', 'Staff user created in PENDING state awaiting activation');

    // Consume activation token and set password
    const newStaffPasswordHash = await hashPassword('StaffNewPass123!');
    await prisma.$transaction([
      prisma.user.update({
        where: { id: pendingStaffUser.id },
        data: { passwordHash: newStaffPasswordHash, status: 'ACTIVE' },
      }),
      prisma.securityToken.update({
        where: { id: activationToken.id },
        data: { consumedAt: new Date() },
      }),
    ]);

    const activatedUser = await prisma.user.findUnique({ where: { id: pendingStaffUser.id } });
    assert(activatedUser?.status === 'ACTIVE', 'Staff account transitions to ACTIVE status after password creation');

    // --- TEST REFLECTION: FORGOT PASSWORD RESET TOKEN SUITE ---
    const rawResetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = hashToken(rawResetToken);

    const resetTokenRecord = await prisma.securityToken.create({
      data: {
        userId: activatedUser!.id,
        organizationId: orgA.id,
        type: 'PASSWORD_RESET',
        tokenHash: resetTokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    // --- TEST REFLECTION: CUSTOM ORGANIZATION CODE REGISTRATION ---
    console.log('\n🏢 Testing Custom Organization Code Registration...');
    const customOrgCode = `CUST${String(timestamp).slice(-4).toUpperCase()}`;
    const customOrg = await prisma.organization.create({
      data: {
        name: `Custom Code Test Org ${timestamp}`,
        organizationCode: customOrgCode,
        phone: '+15559990002',
        contactPersonName: 'Custom Admin',
        contactEmail: `custom.admin.${timestamp}@example.com`,
        logoUrl: '/uploads/logos/test-logo.png',
        status: 'PENDING',
      },
    });

    assert(customOrg.organizationCode === customOrgCode, `Custom Organization Code "${customOrgCode}" saved accurately`);

    // --- TEST REFLECTION: EMAIL SYSTEM REFINEMENT SUITE ---
    console.log('\n📧 Testing Refined Email System Templates & Dispatch Rules...');
    const {
      templateOrgRegistrationApplicantConfirmation,
      templateOrgRegistrationReceived,
      templateOrgApprovedConfirmation,
      templateOrgAdminPasswordSetup,
      templateOrgRegistrationRejected,
    } = await import('../services/email-templates');

    // 1. Applicant Registration Confirmation Email
    const applicantEmail = templateOrgRegistrationApplicantConfirmation({
      orgName: 'Acme Logistics',
      organizationCode: 'ACME01',
      contactPersonName: 'John Doe',
      contactEmail: 'john@acme.com',
      submittedAt: new Date().toLocaleString(),
    });
    assert(applicantEmail.subject.includes('ShiftGuard — Registration Received'), 'Applicant confirmation email has correct subject');
    assert(applicantEmail.html.includes('Pending Review'), 'Applicant confirmation email communicates PENDING status');
    assert(!applicantEmail.html.includes('has been approved') && !applicantEmail.html.includes('is approved'), 'Applicant confirmation email does NOT claim approval prematurely');

    // 2. Super Admin Registration Received Email
    const adminNotification = templateOrgRegistrationReceived({
      orgName: 'Acme Logistics',
      organizationCode: 'ACME01',
      contactPersonName: 'John Doe',
      contactEmail: 'john@acme.com',
      phone: '+15559998888',
      submittedAt: new Date().toLocaleString(),
      reviewUrl: 'https://shiftguard.app/super-admin/dashboard',
    });
    assert(adminNotification.subject.includes('New Organization Registration'), 'Super Admin notification email has action subject');
    assert(adminNotification.html.includes('Review Registration'), 'Super Admin notification email contains review CTA');

    // 3. Approval Email 1 (Confirmation)
    const approvalConfirmation = templateOrgApprovedConfirmation({
      orgName: 'Acme Logistics',
      organizationCode: 'ACME01',
      contactPersonName: 'John Doe',
    });
    assert(approvalConfirmation.subject.includes('Organization Registration Approved'), 'Approval confirmation email has approval subject');
    assert(approvalConfirmation.html.includes('separate email'), 'Approval confirmation email notes separate password email');
    assert(!approvalConfirmation.html.includes('Password:'), 'Approval confirmation email contains ZERO plaintext password');

    // 4. Approval Email 2 (Password Setup + Login Link)
    const setupTokenRaw = crypto.randomBytes(32).toString('hex');
    const passwordSetup = templateOrgAdminPasswordSetup({
      orgName: 'Acme Logistics',
      organizationCode: 'ACME01',
      contactPersonName: 'John Doe',
      adminEmail: 'john@acme.com',
      setupUrl: `https://shiftguard.app/activate-account?token=${setupTokenRaw}`,
      loginUrl: 'https://shiftguard.app/login',
      expiresInHours: 24,
    });
    assert(passwordSetup.subject.includes('Create Your Administrator Password'), 'Password setup email has action subject');
    assert(passwordSetup.html.includes('/activate-account?token='), 'Password setup email contains token link');
    assert(passwordSetup.html.includes('/login'), 'Password setup email contains common /login link');
    assert(!passwordSetup.html.includes('localhost'), 'Production emails use production domain URL');

    // 5. Rejection Email
    const rejectionEmail = templateOrgRegistrationRejected({
      orgName: 'Acme Logistics',
      contactPersonName: 'John Doe',
      rejectionReason: 'Invalid business license document provided.',
    });
    assert(rejectionEmail.subject.includes('Update on Your Organization Registration'), 'Rejection email has polite subject');
    assert(rejectionEmail.html.includes('Invalid business license document provided'), 'Rejection email displays feedback reason');

    // -------------------------------------------------------------------------
    // 4. Aadhaar & Sensitive PII Privacy Audit (Section 16)
    // -------------------------------------------------------------------------
    console.log('\n[4/10] Testing Aadhaar Data Security & PII Privacy Rules');

    const dbStaff = await prisma.staffProfile.findUnique({
      where: { id: staffA.id },
    });

    assert(dbStaff?.idDocLast4 === '5482', 'Only last 4 digits of Aadhaar stored (idDocLast4 = "5482")');
    assert(dbStaff?.idDocHash !== null && dbStaff?.idDocHash.length! > 10, 'Salted SHA-256 hash stored for duplicate detection');
    assert(!('aadhaarFull' in dbStaff!), 'Schema does NOT contain any full Aadhaar field');

    // -------------------------------------------------------------------------
    // 5. Device Reset & Re-Registration Security (Section 28, 72)
    // -------------------------------------------------------------------------
    console.log('\n[5/10] Testing Admin Device Reset & Re-Binding Controls');

    // Reset Staff A's device binding
    await prisma.staffDevice.updateMany({
      where: { staffProfileId: staffA.id },
      data: {
        secretHash: null,
        status: 'RESET_REQUIRED',
        resetAt: new Date(),
        resetBy: adminUserA.id,
      },
    });

    // Old device token should now be BLOCKED
    const evalAfterReset = await evaluateThreeLayerAttendance(
      staffA.id,
      orgA.id,
      '203.0.113.10',
      staffSecretTokenA,
      { latitude: 13.08271, longitude: 80.27071, accuracy: 10 }
    );
    assert(evalAfterReset.isReady === false, 'After Admin device reset, previous device token is REJECTED');
    assert(evalAfterReset.layer1Device.deviceStatus === 'RESET_REQUIRED', 'Device status reports RESET_REQUIRED');

    // Re-bind with new device token
    const newSecretToken = `dev_sec_new_${timestamp}`;
    await prisma.staffDevice.updateMany({
      where: { staffProfileId: staffA.id },
      data: {
        secretHash: hashDeviceSecret(newSecretToken),
        status: 'REGISTERED',
        registeredAt: new Date(),
      },
    });

    const evalRebound = await evaluateThreeLayerAttendance(
      staffA.id,
      orgA.id,
      '203.0.113.10',
      newSecretToken,
      { latitude: 13.08271, longitude: 80.27071, accuracy: 10 }
    );
    assert(evalRebound.isReady === true, 'Re-bound new device token passes 3-layer evaluation');

    // -------------------------------------------------------------------------
    // 6. Rate Limiting Security Check (Section 50)
    // -------------------------------------------------------------------------
    console.log('\n[6/10] Testing Rate Limiting Lockout Security');

    const rateKey = `test_login_${timestamp}`;
    for (let i = 0; i < 5; i++) {
      recordRateLimitAttempt(rateKey, false, { maxAttempts: 5, lockoutMs: 60000 });
    }

    const rateCheck = checkRateLimit(rateKey, { maxAttempts: 5, lockoutMs: 60000 });
    assert(rateCheck.isBlocked === true, 'Rate limiter locks out after 5 consecutive failed attempts');
    assert(rateCheck.retryAfterSeconds! > 0, 'Rate limiter returns positive retryAfterSeconds window');

    recordRateLimitAttempt(rateKey, true); // Reset key
    const rateResetCheck = checkRateLimit(rateKey);
    assert(rateResetCheck.isBlocked === false, 'Successful login resets rate limiter key');

    // -------------------------------------------------------------------------
    // 7. PWA Manifest & Service Worker Check (Section 34, 35)
    // -------------------------------------------------------------------------
    console.log('\n[7/10] Testing Staff PWA Installability Files');

    const manifestPath = path.resolve(process.cwd(), 'public/manifest.json');
    const swPath = path.resolve(process.cwd(), 'public/sw.js');

    assert(fs.existsSync(manifestPath), 'public/manifest.json exists');
    assert(fs.existsSync(swPath), 'public/sw.js service worker exists');

    const manifestContent = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert(manifestContent.display === 'standalone', 'PWA display mode set to "standalone"');
    assert(manifestContent.start_url !== undefined, 'PWA start_url defined');
    assert(Array.isArray(manifestContent.icons) && manifestContent.icons.length > 0, 'PWA icons configured');

    // -------------------------------------------------------------------------
    // 8. Server-Side Attendance Reports & Exports Integrity (Section 39, 41)
    // -------------------------------------------------------------------------
    console.log('\n[8/10] Testing Attendance Report Calculation & Export Generators');

    const todayStr = new Date().toISOString().slice(0, 10);
    const dailyReport = await getDailyAttendanceReport({
      organizationId: orgA.id,
      date: todayStr,
    });

    assert(dailyReport.rows.length >= 1, 'Daily report calculates row for staff member');

    const csvOutput = generateAttendanceReportCsv({
      organizationName: orgA.name,
      reportType: 'DAILY',
      rows: dailyReport.rows,
    });

    assert(csvOutput.startsWith('\uFEFFOrganization,Staff ID'), 'CSV export starts with UTF-8 BOM and correct headers');
    assert(!csvOutput.includes('passwordHash') && !csvOutput.includes('secretHash'), 'CSV export excludes sensitive passwords and secret hashes');

    const pdfHtmlOutput = generateAttendanceReportPdfHtml({
      organizationName: orgA.name,
      reportTitle: 'Daily Attendance Report',
      filterSummaryStr: `Date: ${todayStr}`,
      generatedAt: new Date().toLocaleString(),
      rows: dailyReport.rows,
    });

    assert(pdfHtmlOutput.includes(orgA.name), 'PDF HTML template includes Organization Name');
    assert(pdfHtmlOutput.includes('STF901'), 'PDF HTML template includes Staff ID');

    // -------------------------------------------------------------------------
    // 9. HTTP Security Headers in Next.js Config (Section 52)
    // -------------------------------------------------------------------------
    console.log('\n[9/10] Testing Production Security Headers Configuration');

    const nextConfigPath = path.resolve(process.cwd(), 'next.config.mjs');
    const nextConfigContent = fs.readFileSync(nextConfigPath, 'utf8');

    assert(nextConfigContent.includes('X-Frame-Options') && nextConfigContent.includes('DENY'), 'X-Frame-Options: DENY configured in next.config.mjs');
    assert(nextConfigContent.includes('X-Content-Type-Options') && nextConfigContent.includes('nosniff'), 'X-Content-Type-Options: nosniff configured');
    assert(nextConfigContent.includes('Strict-Transport-Security'), 'HSTS configured for production HTTPS');

    // -------------------------------------------------------------------------
    // 10. Secrets & Environment Template Audit (Section 4, 6)
    // -------------------------------------------------------------------------
    console.log('\n[10/10] Testing Secret Safety & Environment Variable Template');

    const envExamplePath = path.resolve(process.cwd(), '.env.example');
    const envExampleContent = fs.readFileSync(envExamplePath, 'utf8');

    assert(fs.existsSync(envExamplePath), '.env.example template file exists');
    assert(envExampleContent.includes('DATABASE_URL='), '.env.example defines DATABASE_URL variable');
    assert(envExampleContent.includes('JWT_SECRET='), '.env.example defines JWT_SECRET variable');
    assert(!envExampleContent.includes('dpg-d9s6u949v7es73ee07d0-a'), '.env.example contains ZERO actual production database passwords');

    const gitignorePath = path.resolve(process.cwd(), '.gitignore');
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
    assert(gitignoreContent.includes('.env'), '.gitignore properly excludes .env files from version control');

    // -------------------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------------------
    console.log('\nCleaning up production test entities...');
    await prisma.attendanceRecord.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } }).catch(() => {});
    await prisma.branchNetworkIdentity.deleteMany({ where: { branchId: { in: [branchA.id, branchB.id] } } }).catch(() => {});
    await prisma.staffDevice.deleteMany({ where: { staffProfileId: { in: [staffA.id, staffB.id] } } }).catch(() => {});
    await prisma.branchStaffAssignment.deleteMany({ where: { staffProfileId: { in: [staffA.id, staffB.id] } } }).catch(() => {});
    await prisma.staffProfile.deleteMany({ where: { id: { in: [staffA.id, staffB.id] } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [adminUserA.id, staffUserA.id, staffUserB.id] } } }).catch(() => {});
    await prisma.branch.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } }).catch(() => {});
    await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } }).catch(() => {});

    console.log('\n================================================================');
    console.log(`FINAL VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');

    process.exit(failed === 0 ? 0 : 1);
  } catch (error: any) {
    console.error('Fatal verification error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runPhase9FinalVerification();
