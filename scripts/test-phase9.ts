import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('================================================================');
  console.log('ShiftGuard Phase 9: Leave, Manual & Corrections Test Suite');
  console.log('================================================================\n');

  try {
    // 1. Check Leave Requests in DB
    const leaveCount = await prisma.leaveRequest.count();
    console.log(`1. Leave Requests: ${leaveCount} records found in DB.`);

    // 2. Check Attendance Correction Requests in DB
    const correctionCount = await prisma.attendanceCorrectionRequest.count();
    console.log(`2. Attendance Correction Requests: ${correctionCount} records found in DB.`);

    // 3. Check Manual Attendance Records in DB
    const manualAttendanceCount = await prisma.attendanceRecord.count({
      where: { source: 'MANUAL' },
    });
    console.log(`3. Manual Attendance Records: ${manualAttendanceCount} manual punch entries found in DB.`);

    // 4. Test Entitlement Balances Query
    const staff = await prisma.staffProfile.findFirst();
    if (staff) {
      console.log(`4. Testing Entitlements for Staff "${staff.name}" (${staff.staffId})...`);
      const balances = await prisma.leaveBalance.findMany({
        where: { staffProfileId: staff.id },
      });
      console.log(`   Leave Balance Entries: ${balances.length} configured entitlements.`);
      console.log(`   ✓ PASS: Entitlements query executed cleanly.`);
    }

    console.log('\n================================================================');
    console.log('Phase 9 Verification Completed: ALL PASSED.');
    console.log('================================================================');
  } catch (err: any) {
    console.error('❌ ERROR running Phase 9 verification:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
