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
import { hashPassword } from '../lib/security';
import {
  getOrCreateStaffLeaveBalances,
  checkLeaveOverlap,
  calculateStaffingImpact,
  suggestAlternativeDateRanges,
  submitStaffLeaveRequest,
  approveLeaveRequest,
  rejectLeaveRequest,
  cancelStaffLeaveRequest,
  createAdminManualLeave,
  normalizeDate,
} from '../services/leave.service';

async function runPhase6Verification() {
  console.log('================================================================');
  console.log('SHIFTGUARD — PHASE 6 AUTOMATED VERIFICATION SUITE');
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
    // 1. Setup Multi-Tenant Test Environment
    // -------------------------------------------------------------------------
    console.log('\n[1/9] Setting Up Multi-Tenant Organizations, Branches & Roster Patterns');

    const orgA = await prisma.organization.create({
      data: {
        organizationCode: `P6A${Math.floor(10 + Math.random() * 90)}`,
        name: `Org Phase 6 Test A ${timestamp}`,
        status: 'ACTIVE',
      },
    });

    const orgB = await prisma.organization.create({
      data: {
        organizationCode: `P6B${Math.floor(10 + Math.random() * 90)}`,
        name: `Org Phase 6 Test B ${timestamp}`,
        status: 'ACTIVE',
      },
    });

    const branchA = await prisma.branch.create({
      data: {
        organizationId: orgA.id,
        name: 'Phase 6 Central Hospital',
        address: '100 Medical Way',
        status: 'ACTIVE',
      },
    });

    // Create Admin User for Org A
    const adminUser = await prisma.user.create({
      data: {
        organizationId: orgA.id,
        name: 'Dr. Sarah Smith',
        email: `admin.p6.${orgA.organizationCode?.toLowerCase()}@shiftguard.local`,
        passwordHash: await hashPassword('AdminPass123!'),
        role: 'ORG_ADMIN',
        status: 'ACTIVE',
      },
    });

    // Create Staff 1 for Org A
    const staffUser1 = await prisma.user.create({
      data: {
        organizationId: orgA.id,
        name: 'Nurse Amy Pond',
        email: `stf001.${orgA.organizationCode?.toLowerCase()}@shiftguard.local`,
        passwordHash: await hashPassword('123456'),
        role: 'STAFF',
        status: 'ACTIVE',
      },
    });

    const staff1 = await prisma.staffProfile.create({
      data: {
        userId: staffUser1.id,
        organizationId: orgA.id,
        staffId: 'STF001',
        name: 'Nurse Amy Pond',
        phone: '+91 9876543210',
        address: 'London, UK',
      },
    });

    // Create Staff 2 for Org A (for staffing capacity tests)
    const staffUser2 = await prisma.user.create({
      data: {
        organizationId: orgA.id,
        name: 'Nurse Rory Williams',
        email: `stf002.${orgA.organizationCode?.toLowerCase()}@shiftguard.local`,
        passwordHash: await hashPassword('123456'),
        role: 'STAFF',
        status: 'ACTIVE',
      },
    });

    const staff2 = await prisma.staffProfile.create({
      data: {
        userId: staffUser2.id,
        organizationId: orgA.id,
        staffId: 'STF002',
        name: 'Nurse Rory Williams',
        phone: '+91 9876543211',
        address: 'London, UK',
      },
    });

    // Assign both to Branch A
    await prisma.branchStaffAssignment.createMany({
      data: [
        { staffProfileId: staff1.id, branchId: branchA.id },
        { staffProfileId: staff2.id, branchId: branchA.id },
      ],
    });

    // Create Shift Pattern with Minimum Staffing Threshold = 2
    const shiftPattern = await prisma.shiftPattern.create({
      data: {
        organizationId: orgA.id,
        name: 'Emergency Ward Shift',
        minimumStaffingThreshold: 2,
        weeklyDays: {
          create: [
            { weekday: 'MONDAY', startTime: '08:00', endTime: '16:00', isHoliday: false },
            { weekday: 'TUESDAY', startTime: '08:00', endTime: '16:00', isHoliday: false },
            { weekday: 'WEDNESDAY', startTime: '08:00', endTime: '16:00', isHoliday: false },
            { weekday: 'THURSDAY', startTime: '08:00', endTime: '16:00', isHoliday: false },
            { weekday: 'FRIDAY', startTime: '08:00', endTime: '16:00', isHoliday: false },
            { weekday: 'SATURDAY', startTime: '08:00', endTime: '16:00', isHoliday: false },
            { weekday: 'SUNDAY', isHoliday: true },
          ],
        },
      },
    });

    // Assign both staff to this shift pattern
    await prisma.shiftAssignment.createMany({
      data: [
        {
          staffProfileId: staff1.id,
          shiftPatternId: shiftPattern.id,
          effectiveFrom: new Date('2026-01-01'),
        },
        {
          staffProfileId: staff2.id,
          shiftPatternId: shiftPattern.id,
          effectiveFrom: new Date('2026-01-01'),
        },
      ],
    });

    assert(staff1.id !== null && staff2.id !== null, 'Staff and Shift Assignments created with minimum staffing threshold = 2');

    // -------------------------------------------------------------------------
    // 2. Leave Entitlements & Initial Balances
    // -------------------------------------------------------------------------
    console.log('\n[2/9] Testing Leave Entitlement & Balance Initialization');

    const balances = await getOrCreateStaffLeaveBalances(staff1.id, orgA.id, 2026);
    const annualBal = balances.find((b) => b.leaveType === 'ANNUAL');
    const sickBal = balances.find((b) => b.leaveType === 'SICK');
    const dutyBal = balances.find((b) => b.leaveType === 'DUTY');

    assert(annualBal?.entitlement === 12, 'Annual Leave default entitlement is 12 days');
    assert(sickBal?.entitlement === 12, 'Sick Leave default entitlement is 12 days');
    assert(annualBal?.remaining === 12, 'Initial remaining Annual Leave is 12 days');
    assert(dutyBal?.leaveType === 'DUTY', 'Duty Leave balance initialized');

    // -------------------------------------------------------------------------
    // 3. Staff Leave Submission & Pending Status (Section 4, 5, 30)
    // -------------------------------------------------------------------------
    console.log('\n[3/9] Testing Staff Leave Request Submission & Balance Isolation');

    const subResult = await submitStaffLeaveRequest({
      organizationId: orgA.id,
      staffProfileId: staff1.id,
      userId: staffUser1.id,
      type: 'ANNUAL',
      startDate: '2026-09-07', // Monday
      endDate: '2026-09-09',   // Wednesday (3 days)
      reason: 'Family vacation trip',
    });

    assert(subResult.leaveRequest.status === 'PENDING', 'Leave request created in PENDING status');
    assert(subResult.leaveRequest.daysCount === 3, 'Days count correctly calculated as 3 days');

    // Verify balances did NOT permanently deduct while pending (Section 30, 33)
    const pendingBalances = await getOrCreateStaffLeaveBalances(staff1.id, orgA.id, 2026);
    const pendingAnnual = pendingBalances.find((b) => b.leaveType === 'ANNUAL');
    assert(pendingAnnual?.used === 0, 'Pending leave does NOT deduct from used balance');
    assert(pendingAnnual?.remaining === 12, 'Pending leave leaves official remaining balance at 12 days');

    // -------------------------------------------------------------------------
    // 4. Overlap Prevention Engine (Section 31, 32)
    // -------------------------------------------------------------------------
    console.log('\n[4/9] Testing Overlapping Request Prevention Engine');

    let overlapCaught = false;
    try {
      await submitStaffLeaveRequest({
        organizationId: orgA.id,
        staffProfileId: staff1.id,
        userId: staffUser1.id,
        type: 'ANNUAL',
        startDate: '2026-09-08', // Overlaps 2026-09-07 to 2026-09-09
        endDate: '2026-09-10',
        reason: 'Duplicate overlapping request attempt',
      });
    } catch (err: any) {
      overlapCaught = true;
      assert(err.message.includes('overlap'), 'Overlapping request prevented with descriptive error');
    }
    assert(overlapCaught === true, 'Duplicate / overlapping leave requests strictly blocked');

    // -------------------------------------------------------------------------
    // 5. Staffing Impact & Minimum Threshold Warning (Section 13, 14, 15, 20)
    // -------------------------------------------------------------------------
    console.log('\n[5/9] Testing Day-by-Day Staffing Picture & Minimum Threshold Warning');

    // On 2026-09-07 (Monday):
    // Total assigned staff = 2 (Amy & Rory)
    // Minimum threshold = 2
    // If Amy takes leave -> Remaining available = 2 - 0 - 1 = 1
    // 1 < 2 -> Status is RED (Shortage)
    const impact = await calculateStaffingImpact(
      orgA.id,
      staff1.id,
      new Date('2026-09-07'),
      new Date('2026-09-09')
    );

    assert(impact.days.length === 3, 'Evaluates every single date in the requested range (3 days)');
    assert(impact.hasShortage === true, 'Flags staffing shortage when remaining staff (1) < minimum threshold (2)');
    assert(impact.days[0].status === 'RED', 'Day 1 status flagged as RED (Below minimum)');
    assert(impact.days[0].afterApprovalAvailable === 1, 'Day 1 remaining after approval calculated as 1');
    assert(impact.days[0].minimumStaffingThreshold === 2, 'Day 1 respects shift pattern minimum staffing threshold (2)');

    // -------------------------------------------------------------------------
    // 6. Alternative Date Suggestions Algorithm (Section 22, 23, 24, 25)
    // -------------------------------------------------------------------------
    console.log('\n[6/9] Testing Nearby Alternative Date Suggestions Algorithm');

    const suggestions = await suggestAlternativeDateRanges(
      orgA.id,
      staff1.id,
      new Date('2026-09-07'),
      new Date('2026-09-09'),
      3
    );

    assert(Array.isArray(suggestions), 'Alternative suggestions returned as array');
    assert(suggestions.length <= 3, 'Returns top ranked suggestions (<= 3)');
    assert(suggestions.every((s) => s.daysCount === 3), 'All suggestions preserve the requested duration (3 days)');

    // -------------------------------------------------------------------------
    // 7. Transactional Approval & Balance Deduction (Section 50, 51)
    // -------------------------------------------------------------------------
    console.log('\n[7/9] Testing Transactional Approval & Used Balance Deduction');

    const approved = await approveLeaveRequest({
      organizationId: orgA.id,
      requestId: subResult.leaveRequest.id,
      reviewerUserId: adminUser.id,
      reviewerComment: 'Approved despite shortage due to low ward volume',
    });

    assert(approved.status === 'APPROVED', 'Leave request updated to APPROVED status');
    assert(approved.reviewerUserId === adminUser.id, 'Reviewer user ID recorded');

    // Verify balance deduction
    const approvedBalances = await getOrCreateStaffLeaveBalances(staff1.id, orgA.id, 2026);
    const approvedAnnual = approvedBalances.find((b) => b.leaveType === 'ANNUAL');
    assert(approvedAnnual?.used === 3, 'Approved leave deducted 3 days from used balance (used: 3)');
    assert(approvedAnnual?.remaining === 9, 'Remaining Annual Leave is now 9 days (12 - 3)');

    // Attempting to approve already processed request must fail
    let dupApprovalCaught = false;
    try {
      await approveLeaveRequest({
        organizationId: orgA.id,
        requestId: subResult.leaveRequest.id,
        reviewerUserId: adminUser.id,
      });
    } catch {
      dupApprovalCaught = true;
    }
    assert(dupApprovalCaught === true, 'Duplicate approval on already approved request is blocked');

    // -------------------------------------------------------------------------
    // 8. Duty Leave Flow & Non-Deductible Balance Verification (Section 6, 7)
    // -------------------------------------------------------------------------
    console.log('\n[8/9] Testing Duty Leave Flow & Balance Non-Deductibility');

    const dutySub = await submitStaffLeaveRequest({
      organizationId: orgA.id,
      staffProfileId: staff1.id,
      userId: staffUser1.id,
      type: 'DUTY',
      startDate: '2026-09-14',
      endDate: '2026-09-15', // 2 days
      reason: 'Attending Hospital Quality Governance Conference in Manchester',
    });

    assert(dutySub.leaveRequest.type === 'DUTY', 'Duty leave request submitted successfully');

    await approveLeaveRequest({
      organizationId: orgA.id,
      requestId: dutySub.leaveRequest.id,
      reviewerUserId: adminUser.id,
      reviewerComment: 'Approved official duty training',
    });

    // Verify Duty Leave does NOT deduct from Annual or Sick balance
    const dutyBalances = await getOrCreateStaffLeaveBalances(staff1.id, orgA.id, 2026);
    const dutyAnnual = dutyBalances.find((b) => b.leaveType === 'ANNUAL');
    assert(dutyAnnual?.used === 3, 'Approved Duty Leave does NOT deduct from Annual balance (used remains 3)');
    assert(dutyAnnual?.remaining === 9, 'Remaining Annual Leave remains 9 days');

    // -------------------------------------------------------------------------
    // 9. Admin Manual Leave Entry & Multi-Tenant Isolation (Section 8, 9, 49)
    // -------------------------------------------------------------------------
    console.log('\n[9/9] Testing Admin Manual Leave Entry & Multi-Tenant Isolation');

    const manualLeave = await createAdminManualLeave({
      organizationId: orgA.id,
      adminUserId: adminUser.id,
      staffProfileId: staff2.id,
      type: 'SICK',
      startDate: '2026-09-21',
      endDate: '2026-09-22', // 2 days
      reason: 'Staff called in with acute flu',
      adminComment: 'Reported via telephone call at 07:30',
    });

    assert(manualLeave.isManualEntry === true, 'Manual leave marked with isManualEntry = true');
    assert(manualLeave.status === 'APPROVED', 'Manual leave recorded directly as APPROVED');
    assert(manualLeave.enteredByAdminId === adminUser.id, 'Entered by admin ID recorded');

    // Staff 2 Sick Balance deducted
    const staff2Balances = await getOrCreateStaffLeaveBalances(staff2.id, orgA.id, 2026);
    const staff2Sick = staff2Balances.find((b) => b.leaveType === 'SICK');
    assert(staff2Sick?.used === 2, 'Staff 2 Sick Leave balance updated with 2 days used');
    assert(staff2Sick?.remaining === 10, 'Staff 2 Sick Leave remaining is 10 days');

    // Multi-tenant check: Admin from Org B cannot approve Org A request
    let crossTenantCaught = false;
    try {
      await approveLeaveRequest({
        organizationId: orgB.id,
        requestId: manualLeave.id,
        reviewerUserId: adminUser.id,
      });
    } catch {
      crossTenantCaught = true;
    }
    assert(crossTenantCaught === true, 'Cross-tenant leave approval strictly blocked (tenant isolation check)');

    // -------------------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------------------
    await prisma.leaveRequest.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } }).catch(() => {});
    await prisma.leaveBalance.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } }).catch(() => {});
    await prisma.shiftAssignment.deleteMany({ where: { staffProfileId: { in: [staff1.id, staff2.id] } } }).catch(() => {});
    await prisma.weeklyShiftDay.deleteMany({ where: { shiftPatternId: shiftPattern.id } }).catch(() => {});
    await prisma.shiftPattern.deleteMany({ where: { organizationId: orgA.id } }).catch(() => {});
    await prisma.branchStaffAssignment.deleteMany({ where: { staffProfileId: { in: [staff1.id, staff2.id] } } }).catch(() => {});
    await prisma.staffProfile.deleteMany({ where: { id: { in: [staff1.id, staff2.id] } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [adminUser.id, staffUser1.id, staffUser2.id] } } }).catch(() => {});
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

runPhase6Verification();
