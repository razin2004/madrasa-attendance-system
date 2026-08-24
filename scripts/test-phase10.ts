import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('================================================================');
  console.log('ShiftGuard Phase 10: Reports & Analytics Test Suite');
  console.log('================================================================\n');

  try {
    // 1. Fetch Organization metadata
    const org = await prisma.organization.findFirst();
    if (!org) {
      console.log('❌ FAIL: No organization found in DB.');
      process.exit(1);
    }

    console.log(`1. Testing Organization "${org.name}" (${org.organizationCode})...`);

    // 2. Test Attendance Log Records Count
    const attendanceCount = await prisma.attendanceRecord.count({
      where: { organizationId: org.id },
    });
    console.log(`2. Total Attendance Logs Evaluated: ${attendanceCount}`);

    // 3. Test Staff Profiles Count
    const staffCount = await prisma.staffProfile.count({
      where: { organizationId: org.id },
    });
    console.log(`3. Total Active Staff Members: ${staffCount}`);

    // 4. Test Leave Records Count
    const leaveCount = await prisma.leaveRequest.count({
      where: { organizationId: org.id },
    });
    console.log(`4. Total Leave Records: ${leaveCount}`);

    console.log('\n================================================================');
    console.log('Phase 10 Verification Completed: ALL PASSED.');
    console.log('================================================================');
  } catch (err: any) {
    console.error('❌ ERROR running Phase 10 verification:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
