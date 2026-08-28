import { prisma } from '../lib/prisma';
import fs from 'fs';
import path from 'path';

export async function generateFullDatabaseBackup() {
  console.log('📦 Starting full ShiftGuard database backup...');

  const [
    organizations,
    branches,
    branchNetworkIdentities,
    users,
    staffProfiles,
    branchStaffAssignments,
    staffDevices,
    shiftPatterns,
    weeklyShiftDays,
    shiftAssignments,
    staffShiftOverrides,
    attendanceRecords,
    leaveRequests,
    leaveBalances,
    attendanceCorrectionRequests,
    attendanceAdjustmentAudits,
    auditLogs,
    emailLogs,
  ] = await Promise.all([
    prisma.organization.findMany(),
    prisma.branch.findMany(),
    prisma.branchNetworkIdentity.findMany(),
    prisma.user.findMany(),
    prisma.staffProfile.findMany(),
    prisma.branchStaffAssignment.findMany(),
    prisma.staffDevice.findMany(),
    prisma.shiftPattern.findMany(),
    prisma.weeklyShiftDay.findMany(),
    prisma.shiftAssignment.findMany(),
    prisma.staffShiftOverride.findMany(),
    prisma.attendanceRecord.findMany(),
    prisma.leaveRequest.findMany(),
    prisma.leaveBalance.findMany(),
    prisma.attendanceCorrectionRequest.findMany(),
    prisma.attendanceAdjustmentAudit.findMany(),
    prisma.auditLog.findMany(),
    prisma.emailLog.findMany(),
  ]);

  const backupData = {
    metadata: {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      appName: 'ShiftGuard SaaS',
      summary: {
        organizationsCount: organizations.length,
        branchesCount: branches.length,
        branchNetworkIdentitiesCount: branchNetworkIdentities.length,
        usersCount: users.length,
        staffProfilesCount: staffProfiles.length,
        branchStaffAssignmentsCount: branchStaffAssignments.length,
        staffDevicesCount: staffDevices.length,
        shiftPatternsCount: shiftPatterns.length,
        weeklyShiftDaysCount: weeklyShiftDays.length,
        shiftAssignmentsCount: shiftAssignments.length,
        staffShiftOverridesCount: staffShiftOverrides.length,
        attendanceRecordsCount: attendanceRecords.length,
        leaveRequestsCount: leaveRequests.length,
        leaveBalancesCount: leaveBalances.length,
        attendanceCorrectionRequestsCount: attendanceCorrectionRequests.length,
        attendanceAdjustmentAuditsCount: attendanceAdjustmentAudits.length,
        auditLogsCount: auditLogs.length,
        emailLogsCount: emailLogs.length,
      },
    },
    tables: {
      organizations,
      branches,
      branchNetworkIdentities,
      users,
      staffProfiles,
      branchStaffAssignments,
      staffDevices,
      shiftPatterns,
      weeklyShiftDays,
      shiftAssignments,
      staffShiftOverrides,
      attendanceRecords,
      leaveRequests,
      leaveBalances,
      attendanceCorrectionRequests,
      attendanceAdjustmentAudits,
      auditLogs,
      emailLogs,
    },
  };

  return backupData;
}

async function main() {
  try {
    const backupData = await generateFullDatabaseBackup();
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    const backupsDir = path.join(process.cwd(), 'backups');

    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    const filename = `shiftguard_backup_${dateStr}.json`;
    const filePath = path.join(backupsDir, filename);

    fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2), 'utf-8');
    console.log(`✅ Backup successfully saved to ${filePath}`);
    console.log(`📊 Summary:\n${JSON.stringify(backupData.metadata.summary, null, 2)}`);
  } catch (error) {
    console.error('❌ Backup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}
