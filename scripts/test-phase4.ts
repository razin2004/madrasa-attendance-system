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
import { Weekday } from '@prisma/client';
import {
  isValidTimeString,
  isOvernightShift,
  validateWeeklyShiftSchedule,
  getWeekdayFromDate,
  formatDateToIsoDay,
  parseIsoDayToDate,
  WeeklyDayInput,
} from '../lib/shift-validation';
import {
  checkShiftAssignmentConflict,
  calculateStaffDaySchedule,
  calculateWeeklyRoster,
  calculateRosterDayDetail,
} from '../services/roster.service';
import { hashPassword, generateNumericPin, generateStaffId } from '../lib/security';
import { recordAuditLog } from '../services/audit.service';

async function runPhase4Verification() {
  console.log('================================================================');
  console.log('SHIFTGUARD — PHASE 4 AUTOMATED VERIFICATION SUITE');
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
    // TEST 1: Time Validation & Overnight Shift Detection (Section 6)
    // -------------------------------------------------------------------------
    console.log('\n[1/8] Testing Time Validation & Overnight Shift Detection');

    assert(isValidTimeString('07:00') === true, 'Valid time format (07:00) accepted');
    assert(isValidTimeString('23:59') === true, 'Valid time format (23:59) accepted');
    assert(isValidTimeString('24:00') === false, 'Invalid hour 24:00 rejected');
    assert(isValidTimeString('08:65') === false, 'Invalid minute 08:65 rejected');
    assert(isValidTimeString('invalid') === false, 'Malformed text rejected');

    // Overnight calculation
    assert(isOvernightShift('07:00', '17:00') === false, 'Daytime shift (07:00–17:00) is NOT overnight');
    assert(isOvernightShift('22:00', '06:00') === true, 'Night shift (22:00–06:00) correctly detected as OVERNIGHT');
    assert(isOvernightShift('18:00', '02:30') === true, 'Evening-to-morning (18:00–02:30) detected as OVERNIGHT');

    // 7-day schedule validator
    const validSchedule: WeeklyDayInput[] = [
      { weekday: 'MONDAY', isHoliday: false, startTime: '07:00', endTime: '17:00' },
      { weekday: 'TUESDAY', isHoliday: false, startTime: '07:00', endTime: '17:00' },
      { weekday: 'WEDNESDAY', isHoliday: false, startTime: '07:00', endTime: '17:00' },
      { weekday: 'THURSDAY', isHoliday: false, startTime: '07:00', endTime: '17:00' },
      { weekday: 'FRIDAY', isHoliday: false, startTime: '07:00', endTime: '13:00' },
      { weekday: 'SATURDAY', isHoliday: true },
      { weekday: 'SUNDAY', isHoliday: true },
    ];
    const validResult = validateWeeklyShiftSchedule(validSchedule);
    assert(validResult.isValid === true, 'Valid 7-day schedule with holidays accepted');
    assert(validResult.validatedDays?.length === 7, '7 validated weekly days returned');

    // Missing weekday test
    const missingSchedule = validSchedule.slice(0, 6);
    const missingResult = validateWeeklyShiftSchedule(missingSchedule);
    assert(missingResult.isValid === false, 'Incomplete schedule (< 7 days) rejected');

    // Working day missing time test
    const invalidWorking: WeeklyDayInput[] = [
      ...validSchedule.slice(0, 6),
      { weekday: 'SUNDAY', isHoliday: false, startTime: '' },
    ];
    const invalidWorkingResult = validateWeeklyShiftSchedule(invalidWorking);
    assert(invalidWorkingResult.isValid === false, 'Working day missing start/end times rejected');

    // -------------------------------------------------------------------------
    // TEST 2: Multi-Tenant Shift Pattern Creation & Persistence
    // -------------------------------------------------------------------------
    console.log('\n[2/8] Testing Shift Pattern Creation & Database Persistence');

    const timestamp = Date.now();
    const orgA = await prisma.organization.create({
      data: {
        organizationCode: `P4A${Math.floor(10 + Math.random() * 90)}`,
        name: `Org Phase 4 Test A ${timestamp}`,
        status: 'ACTIVE',
      },
    });

    const orgB = await prisma.organization.create({
      data: {
        organizationCode: `P4B${Math.floor(10 + Math.random() * 90)}`,
        name: `Org Phase 4 Test B ${timestamp}`,
        status: 'ACTIVE',
      },
    });

    const branchA1 = await prisma.branch.create({
      data: {
        organizationId: orgA.id,
        name: 'Main General Hospital',
        address: '100 Medical Center Way',
        status: 'ACTIVE',
      },
    });

    // Create Shift Pattern in Org A
    const shiftPattern1 = await prisma.shiftPattern.create({
      data: {
        organizationId: orgA.id,
        name: 'General Staff Morning',
        description: 'Standard morning clinical rotation',
        minimumStaffingThreshold: 2,
        isActive: true,
        weeklyDays: {
          create: validResult.validatedDays!.map((d) => ({
            weekday: d.weekday,
            isHoliday: d.isHoliday,
            startTime: d.startTime,
            endTime: d.endTime,
            isOvernight: d.isOvernight,
          })),
        },
      },
      include: { weeklyDays: true },
    });

    assert(shiftPattern1.organizationId === orgA.id, 'ShiftPattern created and bound to Org A');
    assert(shiftPattern1.minimumStaffingThreshold === 2, 'Minimum staffing threshold set to 2');
    assert(shiftPattern1.weeklyDays.length === 7, 'All 7 weekly days saved in database');

    // Create Overnight Shift Pattern in Org A
    const nightSchedule: WeeklyDayInput[] = [
      { weekday: 'MONDAY', isHoliday: false, startTime: '22:00', endTime: '06:00' },
      { weekday: 'TUESDAY', isHoliday: false, startTime: '22:00', endTime: '06:00' },
      { weekday: 'WEDNESDAY', isHoliday: false, startTime: '22:00', endTime: '06:00' },
      { weekday: 'THURSDAY', isHoliday: false, startTime: '22:00', endTime: '06:00' },
      { weekday: 'FRIDAY', isHoliday: false, startTime: '22:00', endTime: '06:00' },
      { weekday: 'SATURDAY', isHoliday: true },
      { weekday: 'SUNDAY', isHoliday: true },
    ];
    const nightValidation = validateWeeklyShiftSchedule(nightSchedule);

    const shiftPatternNight = await prisma.shiftPattern.create({
      data: {
        organizationId: orgA.id,
        name: 'Night Duty Emergency',
        description: 'Overnight emergency rotation',
        minimumStaffingThreshold: 1,
        isActive: true,
        weeklyDays: {
          create: nightValidation.validatedDays!.map((d) => ({
            weekday: d.weekday,
            isHoliday: d.isHoliday,
            startTime: d.startTime,
            endTime: d.endTime,
            isOvernight: d.isOvernight,
          })),
        },
      },
      include: { weeklyDays: true },
    });

    const mondayNight = shiftPatternNight.weeklyDays.find((d) => d.weekday === 'MONDAY');
    assert(mondayNight?.isOvernight === true, 'Database correctly persists isOvernight = true for 22:00–06:00');

    // -------------------------------------------------------------------------
    // TEST 3: Multi-Tenant Pattern Isolation
    // -------------------------------------------------------------------------
    console.log('\n[3/8] Verifying Multi-Tenant Shift Pattern Isolation');

    const orgBPatterns = await prisma.shiftPattern.findMany({
      where: { organizationId: orgB.id },
    });
    assert(orgBPatterns.length === 0, 'Org B cannot view Org A shift patterns (tenant isolation check)');

    // -------------------------------------------------------------------------
    // TEST 4: Staff Creation & Shift Assignment
    // -------------------------------------------------------------------------
    console.log('\n[4/8] Testing Staff Creation & Shift Pattern Assignment');

    const pin = generateNumericPin(6);
    const pinHash = await hashPassword(pin);

    // Create Staff 1 in Org A
    const user1 = await prisma.user.create({
      data: {
        organizationId: orgA.id,
        name: 'Dr. John Watson',
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
        name: 'Dr. John Watson',
        phone: '+91 9876543210',
        address: '221B Baker Street, London',
      },
    });

    // Create Staff 2 in Org A
    const user2 = await prisma.user.create({
      data: {
        organizationId: orgA.id,
        name: 'Dr. Mary Morstan',
        email: `stf002.${orgA.organizationCode?.toLowerCase()}@shiftguard.local`,
        passwordHash: pinHash,
        role: 'STAFF',
        status: 'ACTIVE',
      },
    });

    const staff2 = await prisma.staffProfile.create({
      data: {
        userId: user2.id,
        organizationId: orgA.id,
        staffId: 'STF002',
        name: 'Dr. Mary Morstan',
        phone: '+91 9876543211',
        address: 'London, UK',
      },
    });

    // Assign Branch A1 to Staff 1 & Staff 2
    await prisma.branchStaffAssignment.createMany({
      data: [
        { staffProfileId: staff1.id, branchId: branchA1.id },
        { staffProfileId: staff2.id, branchId: branchA1.id },
      ],
    });

    // Assign Staff 1 & Staff 2 to "General Staff Morning" (Sept 1 to Sept 30, 2026)
    const assignmentSept1 = await prisma.shiftAssignment.create({
      data: {
        staffProfileId: staff1.id,
        shiftPatternId: shiftPattern1.id,
        effectiveFrom: parseIsoDayToDate('2026-09-01'),
        effectiveTo: parseIsoDayToDate('2026-09-30'),
        assignedBy: 'Admin Test',
      },
    });

    const assignmentSept2 = await prisma.shiftAssignment.create({
      data: {
        staffProfileId: staff2.id,
        shiftPatternId: shiftPattern1.id,
        effectiveFrom: parseIsoDayToDate('2026-09-01'),
        effectiveTo: parseIsoDayToDate('2026-09-30'),
        assignedBy: 'Admin Test',
      },
    });

    assert(assignmentSept1.id !== null && assignmentSept2.id !== null, 'Staff 1 & 2 assigned to Morning Shift for September 2026');

    // -------------------------------------------------------------------------
    // TEST 5: Conflict Prevention Engine (Section 14, 24)
    // -------------------------------------------------------------------------
    console.log('\n[5/8] Testing Shift Assignment Conflict Prevention Engine');

    // Attempt overlapping assignment: Sept 15 to Oct 15 (overlaps Sept 1–30)
    const overlapConflict = await checkShiftAssignmentConflict(
      staff1.id,
      parseIsoDayToDate('2026-09-15'),
      parseIsoDayToDate('2026-10-15')
    );
    assert(overlapConflict.hasConflict === true, 'Overlapping assignment (Sept 15–Oct 15) correctly DETECTED & BLOCKED');
    assert(overlapConflict.conflictingAssignment?.shiftPatternName === 'General Staff Morning', 'Conflict identifies existing pattern name');

    // Attempt non-overlapping assignment: Oct 1 onward (starts after Sept 30) -> MUST PASS
    const nonOverlapCheck = await checkShiftAssignmentConflict(
      staff1.id,
      parseIsoDayToDate('2026-10-01'),
      null // Ongoing
    );
    assert(nonOverlapCheck.hasConflict === false, 'Non-overlapping sequential assignment (Oct 1 onward) ALLOWED');

    // Create the sequential assignment
    const assignmentOct1 = await prisma.shiftAssignment.create({
      data: {
        staffProfileId: staff1.id,
        shiftPatternId: shiftPatternNight.id,
        effectiveFrom: parseIsoDayToDate('2026-10-01'),
        effectiveTo: null,
      },
    });
    assert(assignmentOct1.id !== null, 'Sequential Night Shift assignment successfully created');

    // -------------------------------------------------------------------------
    // TEST 6: Historical Roster Preservation (Section 11, 15, 16)
    // -------------------------------------------------------------------------
    console.log('\n[6/8] Testing Historical Roster Preservation Across Assignment Boundaries');

    // Query roster on Sept 10, 2026 (Thursday) -> Must reflect Morning Shift (07:00–17:00)
    const septRoster = await calculateRosterDayDetail(orgA.id, '2026-09-10');
    const staff1Sept = septRoster.workingStaff.find((s) => s.staffId === 'STF001');
    assert(staff1Sept !== undefined, 'Staff 1 found in September roster');
    assert(staff1Sept?.schedule.shiftPatternName === 'General Staff Morning', 'Historical schedule preserves Morning Shift for September');
    assert(staff1Sept?.schedule.startTime === '07:00' && staff1Sept?.schedule.endTime === '17:00', 'Historical hours (07:00–17:00) preserved accurately');

    // Query roster on Oct 08, 2026 (Thursday) -> Must reflect Night Shift (22:00–06:00, Overnight)
    const octRoster = await calculateRosterDayDetail(orgA.id, '2026-10-08');
    const staff1Oct = octRoster.workingStaff.find((s) => s.staffId === 'STF001');
    assert(staff1Oct !== undefined, 'Staff 1 found in October roster');
    assert(staff1Oct?.schedule.shiftPatternName === 'Night Duty Emergency', 'Future schedule resolves to Night Duty for October');
    assert(staff1Oct?.schedule.startTime === '22:00' && staff1Oct?.schedule.endTime === '06:00', 'Night hours (22:00–06:00) resolved');
    assert(staff1Oct?.schedule.isOvernight === true, 'Overnight flag resolved');

    // -------------------------------------------------------------------------
    // TEST 7: Staff-Specific Day Overrides (Section 17)
    // -------------------------------------------------------------------------
    console.log('\n[7/8] Testing Staff-Specific Day Overrides & Independence');

    // Friday Sept 04, 2026: Base schedule is 07:00–13:00
    // Apply override for Staff 1: 07:00–11:00 (Early Departure Approved)
    const override1 = await prisma.staffShiftOverride.create({
      data: {
        staffProfileId: staff1.id,
        date: parseIsoDayToDate('2026-09-04'),
        isHoliday: false,
        startTime: '07:00',
        endTime: '11:00',
        isOvernight: false,
        reason: 'Early Departure Approved',
        createdBy: 'Admin Test',
      },
    });

    const dayDetailSept04 = await calculateRosterDayDetail(orgA.id, '2026-09-04');
    const staff1OverrideDay = dayDetailSept04.workingStaff.find((s) => s.staffId === 'STF001');
    const staff2NormalDay = dayDetailSept04.workingStaff.find((s) => s.staffId === 'STF002');

    assert(staff1OverrideDay?.schedule.hasOverride === true, 'Staff 1 has hasOverride = true');
    assert(staff1OverrideDay?.schedule.endTime === '11:00', 'Staff 1 schedule overridden to 07:00–11:00');
    assert(staff1OverrideDay?.schedule.overrideReason === 'Early Departure Approved', 'Override reason preserved');

    // Verify Staff 2 still has standard base pattern (07:00–13:00)
    assert(staff2NormalDay?.schedule.hasOverride === false, 'Staff 2 unaffected by Staff 1 override');
    assert(staff2NormalDay?.schedule.endTime === '13:00', 'Staff 2 retains standard Friday schedule (07:00–13:00)');

    // Delete override -> restores base pattern
    await prisma.staffShiftOverride.delete({ where: { id: override1.id } });
    const restoredDay = await calculateRosterDayDetail(orgA.id, '2026-09-04');
    const staff1Restored = restoredDay.workingStaff.find((s) => s.staffId === 'STF001');
    assert(staff1Restored?.schedule.hasOverride === false, 'Deleting override restores base pattern (hasOverride = false)');
    assert(staff1Restored?.schedule.endTime === '13:00', 'Staff 1 restored to standard 07:00–13:00');

    // -------------------------------------------------------------------------
    // TEST 8: Weekly Roster Matrix & Audit Trail (Section 19, 31)
    // -------------------------------------------------------------------------
    console.log('\n[8/8] Testing Weekly Roster Matrix Calculation & Audit Logs');

    // Weekly Roster: Monday Sept 07, 2026 to Sunday Sept 13, 2026
    const weeklyRoster = await calculateWeeklyRoster(orgA.id, '2026-09-07', '2026-09-13');
    assert(weeklyRoster.days.length === 7, 'Weekly roster spans exactly 7 days');
    assert(weeklyRoster.staffRows.length === 2, 'Weekly roster includes both active staff members');

    const monCount = weeklyRoster.summary.scheduledCountByDay['2026-09-07'];
    const satCount = weeklyRoster.summary.scheduledCountByDay['2026-09-12'];
    assert(monCount === 2, 'Monday staffing count is 2 on duty');
    assert(satCount === 0, 'Saturday staffing count is 0 (scheduled weekend holiday)');

    // Audit Log Check
    await recordAuditLog({
      organizationId: orgA.id,
      actorUserId: user1.id,
      action: 'SHIFT_PATTERN_CREATED',
      entityType: 'ShiftPattern',
      entityId: shiftPattern1.id,
      metadata: { name: shiftPattern1.name },
    });

    const auditCheck = await prisma.auditLog.findFirst({
      where: { action: 'SHIFT_PATTERN_CREATED', organizationId: orgA.id },
    });
    assert(auditCheck !== null, 'Shift pattern creation recorded in AuditLog');

    // -------------------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------------------
    await prisma.staffShiftOverride.deleteMany({ where: { staffProfileId: { in: [staff1.id, staff2.id] } } }).catch(() => {});
    await prisma.shiftAssignment.deleteMany({ where: { staffProfileId: { in: [staff1.id, staff2.id] } } }).catch(() => {});
    await prisma.weeklyShiftDay.deleteMany({ where: { shiftPatternId: { in: [shiftPattern1.id, shiftPatternNight.id] } } }).catch(() => {});
    await prisma.shiftPattern.deleteMany({ where: { organizationId: orgA.id } }).catch(() => {});
    await prisma.branchStaffAssignment.deleteMany({ where: { staffProfileId: { in: [staff1.id, staff2.id] } } }).catch(() => {});
    await prisma.staffProfile.deleteMany({ where: { id: { in: [staff1.id, staff2.id] } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [user1.id, user2.id] } } }).catch(() => {});
    await prisma.branch.deleteMany({ where: { organizationId: orgA.id } }).catch(() => {});
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

runPhase4Verification();
