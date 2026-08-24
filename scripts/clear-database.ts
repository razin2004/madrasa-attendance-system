import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('================================================================');
  console.log('🗑️  ShiftGuard Database Cleanup & Wipe');
  console.log('================================================================\n');

  console.log('Clearing database tables...');

  // Delete child records first to respect foreign key constraints
  await prisma.attendanceAdjustmentAudit.deleteMany();
  console.log('✓ Cleared attendance_adjustment_audits');

  await prisma.attendanceCorrectionRequest.deleteMany();
  console.log('✓ Cleared attendance_correction_requests');

  await prisma.attendanceRecord.deleteMany();
  console.log('✓ Cleared attendance_records');

  await prisma.leaveBalance.deleteMany();
  console.log('✓ Cleared leave_balances');

  await prisma.leaveRequest.deleteMany();
  console.log('✓ Cleared leave_requests');

  await prisma.staffShiftOverride.deleteMany();
  console.log('✓ Cleared staff_shift_overrides');

  await prisma.shiftAssignment.deleteMany();
  console.log('✓ Cleared shift_assignments');

  await prisma.weeklyShiftDay.deleteMany();
  console.log('✓ Cleared weekly_shift_days');

  await prisma.shiftPattern.deleteMany();
  console.log('✓ Cleared shift_patterns');

  await prisma.staffDevice.deleteMany();
  console.log('✓ Cleared staff_devices');

  await prisma.branchStaffAssignment.deleteMany();
  console.log('✓ Cleared branch_staff_assignments');

  await prisma.staffProfile.deleteMany();
  console.log('✓ Cleared staff_profiles');

  await prisma.session.deleteMany();
  console.log('✓ Cleared sessions');

  await prisma.securityToken.deleteMany();
  console.log('✓ Cleared security_tokens');

  await prisma.auditLog.deleteMany();
  console.log('✓ Cleared audit_logs');

  await prisma.emailLog.deleteMany();
  console.log('✓ Cleared email_logs');

  await prisma.branchNetworkIdentity.deleteMany();
  console.log('✓ Cleared branch_network_identities');

  await prisma.branch.deleteMany();
  console.log('✓ Cleared branches');

  await prisma.user.deleteMany();
  console.log('✓ Cleared users');

  await prisma.organization.deleteMany();
  console.log('✓ Cleared organizations');

  console.log('\n================================================================');
  console.log('🌱 Re-seeding Default Super Admin Account...');
  console.log('================================================================\n');

  const superAdminEmail = (process.env.SUPER_ADMIN_EMAIL || 'doctorbooksystem@gmail.com').toLowerCase().trim();
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdminPass@2026';
  const superAdminName = process.env.SUPER_ADMIN_NAME || 'ShiftGuard Super Admin';

  const passwordHash = await bcrypt.hash(superAdminPassword, 10);

  const admin = await prisma.user.create({
    data: {
      name: superAdminName,
      email: superAdminEmail,
      passwordHash,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      mustChangePassword: false,
    },
  });

  console.log(`✅ Default Super Admin created: ${admin.email}`);
  console.log(`🔑 Login Password: ${superAdminPassword}`);
  console.log('\n================================================================');
  console.log('🎉 Database successfully wiped clean & re-initialized!');
  console.log('================================================================');
}

main()
  .catch((e) => {
    console.error('❌ Database cleanup error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
