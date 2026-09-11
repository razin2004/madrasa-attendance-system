import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Deleting all attendance history from database...');

  const deletedAudits = await prisma.attendanceAdjustmentAudit.deleteMany({});
  const deletedCorrections = await prisma.attendanceCorrectionRequest.deleteMany({});
  const deletedRecords = await prisma.attendanceRecord.deleteMany({});

  console.log(`Deleted ${deletedAudits.count} attendance adjustment audits.`);
  console.log(`Deleted ${deletedCorrections.count} attendance correction requests.`);
  console.log(`Deleted ${deletedRecords.count} attendance records.`);

  const remainingAudits = await prisma.attendanceAdjustmentAudit.count();
  const remainingCorrections = await prisma.attendanceCorrectionRequest.count();
  const remainingRecords = await prisma.attendanceRecord.count();

  console.log('Database verification status:');
  console.log(`- AttendanceRecord count: ${remainingRecords}`);
  console.log(`- AttendanceCorrectionRequest count: ${remainingCorrections}`);
  console.log(`- AttendanceAdjustmentAudit count: ${remainingAudits}`);
}

main()
  .catch((err) => {
    console.error('Error clearing attendance history:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
