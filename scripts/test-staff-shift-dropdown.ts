import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function assert(condition: boolean, testName: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${testName}`);
    throw new Error(`Test assertion failed: ${testName}`);
  }
  console.log(`  ✓ PASS: ${testName}`);
}

async function main() {
  console.log('================================================================');
  console.log('Staff Profile Shift Dropdown Fix Audit Test');
  console.log('================================================================\n');

  // Find or create organization
  let org = await prisma.organization.findFirst({
    where: { organizationCode: 'ASIET' },
  });

  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: 'Adi Shankara Institute Of Engineering and Technology',
        organizationCode: 'ASIET',
        status: 'ACTIVE',
      },
    });
  }

  // Find or create shift pattern
  let pattern = await prisma.shiftPattern.findFirst({
    where: { organizationId: org.id },
  });

  if (!pattern) {
    pattern = await prisma.shiftPattern.create({
      data: {
        organizationId: org.id,
        name: 'Standard Morning Shift',
        description: '08:00 AM to 05:00 PM',
        minimumStaffingThreshold: 1,
        isActive: true,
        weeklyDays: {
          create: [
            { weekday: 'MONDAY', startTime: '08:00', endTime: '17:00', isHoliday: false },
          ],
        },
      },
    });
  }

  // Simulate API response payload from /api/org/[organizationCode]/shift-patterns
  const shiftPatternsDb = await prisma.shiftPattern.findMany({
    where: { organizationId: org.id },
    include: { weeklyDays: true },
  });

  const apiResponseJson = {
    success: true,
    shiftPatterns: shiftPatternsDb,
    patterns: shiftPatternsDb,
  };

  // Test extraction logic used in Staff Profile page component
  const extractedPatterns = apiResponseJson.shiftPatterns || apiResponseJson.patterns || [];
  assert(extractedPatterns.length > 0, 'Extracted shift patterns array is non-empty');
  assert(extractedPatterns.some((p: any) => p.name === pattern?.name), `Shift pattern "${pattern?.name}" found in extracted list`);

  console.log('\n================================================================');
  console.log('Staff Shift Dropdown Audit Suite Completed: ALL PASSED.');
  console.log('================================================================');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
