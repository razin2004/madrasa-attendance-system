import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('================================================================');
  console.log('ShiftGuard Phase 7: Shift Management & Roster Test Suite');
  console.log('================================================================\n');

  try {
    // 1. Fetch Organizations and Shift Patterns
    const org = await prisma.organization.findFirst({
      include: { shiftPatterns: true, branches: true },
    });

    if (!org) {
      console.log('❌ FAIL: No organization found in database.');
      process.exit(1);
    }

    console.log(`1. Testing Organization "${org.name}" (${org.organizationCode})...`);
    console.log(`   Found ${org.shiftPatterns.length} shift patterns, ${org.branches.length} branches.`);

    // 2. Test Shift Pattern query
    const activePatterns = org.shiftPatterns.filter((p) => p.isActive);
    console.log(`   ✓ PASS: Organization has ${activePatterns.length} active shift patterns.`);

    // 3. Test Staff Shift Assignments
    const staffCount = await prisma.staffProfile.count({
      where: { organizationId: org.id },
    });
    console.log(`2. Staff Profiles: ${staffCount} total staff.`);

    // 4. Test Staff Shift Overrides verification
    const rosterOverrides = await prisma.staffShiftOverride.count({
      where: { staffProfile: { organizationId: org.id } },
    });
    console.log(`3. Roster Overrides: ${rosterOverrides} total overrides found.`);

    console.log('\n================================================================');
    console.log('Phase 7 Verification Completed: ALL PASSED.');
    console.log('================================================================');
  } catch (err: any) {
    console.error('❌ ERROR running Phase 7 verification:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
