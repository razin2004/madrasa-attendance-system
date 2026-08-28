import { prisma } from '../lib/prisma';
import fs from 'fs';
import path from 'path';

export async function restoreFullDatabaseBackup(backupData: any) {
  console.log('🔄 Restoring full database backup...');

  if (!backupData || !backupData.tables) {
    throw new Error('Invalid backup file format.');
  }

  const { tables } = backupData;

  await prisma.$transaction(async (tx) => {
    // Delete existing records in reverse dependency order
    await tx.emailLog.deleteMany();
    await tx.auditLog.deleteMany();
    await tx.attendanceAdjustmentAudit.deleteMany();
    await tx.attendanceCorrectionRequest.deleteMany();
    await tx.attendanceRecord.deleteMany();
    await tx.leaveRequest.deleteMany();
    await tx.leaveBalance.deleteMany();
    await tx.staffShiftOverride.deleteMany();
    await tx.shiftAssignment.deleteMany();
    await tx.weeklyShiftDay.deleteMany();
    await tx.shiftPattern.deleteMany();
    await tx.staffDevice.deleteMany();
    await tx.branchStaffAssignment.deleteMany();
    await tx.staffProfile.deleteMany();
    await tx.user.deleteMany();
    await tx.branchNetworkIdentity.deleteMany();
    await tx.branch.deleteMany();
    await tx.organization.deleteMany();

    // Re-insert records in dependency order
    if (tables.organizations?.length) {
      await tx.organization.createMany({ data: tables.organizations });
    }
    if (tables.branches?.length) {
      await tx.branch.createMany({ data: tables.branches });
    }
    if (tables.branchNetworkIdentities?.length) {
      await tx.branchNetworkIdentity.createMany({ data: tables.branchNetworkIdentities });
    }
    if (tables.users?.length) {
      await tx.user.createMany({ data: tables.users });
    }
    if (tables.staffProfiles?.length) {
      await tx.staffProfile.createMany({ data: tables.staffProfiles });
    }
    if (tables.branchStaffAssignments?.length) {
      await tx.branchStaffAssignment.createMany({ data: tables.branchStaffAssignments });
    }
    if (tables.staffDevices?.length) {
      await tx.staffDevice.createMany({ data: tables.staffDevices });
    }
    if (tables.shiftPatterns?.length) {
      await tx.shiftPattern.createMany({ data: tables.shiftPatterns });
    }
    if (tables.weeklyShiftDays?.length) {
      await tx.weeklyShiftDay.createMany({ data: tables.weeklyShiftDays });
    }
    if (tables.shiftAssignments?.length) {
      await tx.shiftAssignment.createMany({ data: tables.shiftAssignments });
    }
    if (tables.staffShiftOverrides?.length) {
      await tx.staffShiftOverride.createMany({ data: tables.staffShiftOverrides });
    }
    if (tables.leaveBalances?.length) {
      await tx.leaveBalance.createMany({ data: tables.leaveBalances });
    }
    if (tables.leaveRequests?.length) {
      await tx.leaveRequest.createMany({ data: tables.leaveRequests });
    }
    if (tables.attendanceRecords?.length) {
      await tx.attendanceRecord.createMany({ data: tables.attendanceRecords });
    }
    if (tables.attendanceCorrectionRequests?.length) {
      await tx.attendanceCorrectionRequest.createMany({ data: tables.attendanceCorrectionRequests });
    }
    if (tables.attendanceAdjustmentAudits?.length) {
      await tx.attendanceAdjustmentAudit.createMany({ data: tables.attendanceAdjustmentAudits });
    }
    if (tables.auditLogs?.length) {
      await tx.auditLog.createMany({ data: tables.auditLogs });
    }
    if (tables.emailLogs?.length) {
      await tx.emailLog.createMany({ data: tables.emailLogs });
    }
  });

  console.log('✅ Database restore completed successfully.');
}

async function main() {
  try {
    const backupFilePath = process.argv[2];
    if (!backupFilePath) {
      console.error('❌ Please specify backup file path. Example: npx ts-node scripts/restore-db.ts backups/shiftguard_backup_2026-08-28.json');
      process.exit(1);
    }

    const absolutePath = path.resolve(backupFilePath);
    if (!fs.existsSync(absolutePath)) {
      console.error(`❌ Backup file not found at ${absolutePath}`);
      process.exit(1);
    }

    const fileContent = fs.readFileSync(absolutePath, 'utf-8');
    const backupData = JSON.parse(fileContent);

    await restoreFullDatabaseBackup(backupData);
  } catch (error) {
    console.error('❌ Database restore failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}
