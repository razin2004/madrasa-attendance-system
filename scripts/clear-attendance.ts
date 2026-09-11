import { prisma } from '../lib/prisma';

async function main() {
  console.log('Clearing all attendance records, correction requests, and adjustment audits...');

  const deletedAudits = await prisma.attendanceAdjustmentAudit.deleteMany({});
  console.log(`Deleted ${deletedAudits.count} attendance adjustment audits.`);

  const deletedRecords = await prisma.attendanceRecord.deleteMany({});
  console.log(`Deleted ${deletedRecords.count} attendance records.`);

  const deletedCorrections = await prisma.attendanceCorrectionRequest.deleteMany({});
  console.log(`Deleted ${deletedCorrections.count} attendance correction requests.`);

  console.log('Attendance history cleared successfully!');
}

main()
  .catch((e) => {
    console.error('Error clearing attendance history:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
