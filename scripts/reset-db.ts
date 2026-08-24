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
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function resetDatabase() {
  console.log('======================================================');
  console.log('🗑️  SHIFTGUARD DATABASE RESET & PURGE SCRIPT');
  console.log('======================================================\n');

  try {
    console.log('Clearing all stored database records in cascade order...');

    // 1. Child transactional & log tables
    await prisma.attendanceCorrectionRequest.deleteMany();
    console.log('  ✓ Cleared AttendanceCorrectionRequests');

    await prisma.attendanceAdjustmentAudit.deleteMany();
    console.log('  ✓ Cleared AttendanceAdjustmentAudits');

    await prisma.attendanceRecord.deleteMany();
    console.log('  ✓ Cleared AttendanceRecords');

    await prisma.staffShiftOverride.deleteMany();
    console.log('  ✓ Cleared StaffShiftOverrides');

    await prisma.shiftAssignment.deleteMany();
    console.log('  ✓ Cleared ShiftAssignments');

    await prisma.weeklyShiftDay.deleteMany();
    console.log('  ✓ Cleared WeeklyShiftDays');

    await prisma.shiftPattern.deleteMany();
    console.log('  ✓ Cleared ShiftPatterns');

    await prisma.leaveRequest.deleteMany();
    console.log('  ✓ Cleared LeaveRequests');

    await prisma.leaveBalance.deleteMany();
    console.log('  ✓ Cleared LeaveBalances');

    await prisma.branchStaffAssignment.deleteMany();
    console.log('  ✓ Cleared BranchStaffAssignments');

    await prisma.staffDevice.deleteMany();
    console.log('  ✓ Cleared StaffDevices');

    await prisma.staffProfile.deleteMany();
    console.log('  ✓ Cleared StaffProfiles');

    await prisma.branchNetworkIdentity.deleteMany();
    console.log('  ✓ Cleared BranchNetworkIdentities');

    await prisma.branch.deleteMany();
    console.log('  ✓ Cleared Branches');

    await prisma.securityToken.deleteMany();
    console.log('  ✓ Cleared SecurityTokens');

    await prisma.auditLog.deleteMany();
    console.log('  ✓ Cleared AuditLogs');

    await prisma.emailLog.deleteMany();
    console.log('  ✓ Cleared EmailLogs');

    await prisma.session.deleteMany();
    console.log('  ✓ Cleared Sessions');

    // 2. User & Organization tables
    await prisma.user.deleteMany();
    console.log('  ✓ Cleared Users');

    await prisma.organization.deleteMany();
    console.log('  ✓ Cleared Organizations');

    console.log('\n------------------------------------------------------');
    console.log('🌱 Re-seeding default Super Admin user account...');

    const superAdminEmail = (process.env.SUPER_ADMIN_EMAIL || 'doctorbooksystem@gmail.com').toLowerCase().trim();
    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || '12345';
    const superAdminName = process.env.SUPER_ADMIN_NAME || 'Razin';

    const passwordHash = await bcrypt.hash(superAdminPassword, 10);

    const superAdmin = await prisma.user.create({
      data: {
        name: superAdminName,
        email: superAdminEmail,
        passwordHash,
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        mustChangePassword: false,
      },
    });

    console.log(`  ✓ Super Admin created: ${superAdmin.email} (Name: ${superAdmin.name})`);

    console.log('\n======================================================');
    console.log('🎉 DATABASE HAS BEEN FULLY WIPED & RESET SUCCESSFULLY!');
    console.log('======================================================');
  } catch (err) {
    console.error('❌ Database reset failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

resetDatabase();
