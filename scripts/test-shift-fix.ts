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
  console.log('Shift Assignment & Staff Portal Shift Display Audit Test');
  console.log('================================================================\n');

  // 1. Seed or find test Organization
  console.log('1. Setting up test organization & staff member...');
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

  // Find or create test Shift Pattern
  let pattern = await prisma.shiftPattern.findFirst({
    where: { organizationId: org.id },
  });

  if (!pattern) {
    pattern = await prisma.shiftPattern.create({
      data: {
        organizationId: org.id,
        name: 'General Staff Morning Shift',
        description: '08:00 AM to 05:00 PM',
        minimumStaffingThreshold: 1,
        isActive: true,
        weeklyDays: {
          create: [
            { weekday: 'MONDAY', startTime: '08:00', endTime: '17:00', isHoliday: false },
            { weekday: 'TUESDAY', startTime: '08:00', endTime: '17:00', isHoliday: false },
            { weekday: 'WEDNESDAY', startTime: '08:00', endTime: '17:00', isHoliday: false },
            { weekday: 'THURSDAY', startTime: '08:00', endTime: '17:00', isHoliday: false },
            { weekday: 'FRIDAY', startTime: '08:00', endTime: '17:00', isHoliday: false },
            { weekday: 'SATURDAY', startTime: null, endTime: null, isHoliday: true },
            { weekday: 'SUNDAY', startTime: null, endTime: null, isHoliday: true },
          ],
        },
      },
    });
  }

  // Create test User and StaffProfile with user status = PENDING (simulating newly created staff)
  const testEmail = `teststaff_${Date.now()}@asiet.edu.in`;
  const user = await prisma.user.create({
    data: {
      organizationId: org.id,
      name: 'Test Student Staff',
      email: testEmail,
      passwordHash: 'dummy',
      role: 'STAFF',
      status: 'PENDING',
    },
  });

  const staff = await prisma.staffProfile.create({
    data: {
      userId: user.id,
      organizationId: org.id,
      staffId: `STF_${Date.now().toString().slice(-4)}`,
      name: 'Test Student Staff',
      address: 'Kalady, Kerala',
    },
  });

  console.log(`  Staff member created: ${staff.name} (${staff.staffId}) [User Status: ${user.status}]`);

  // 2. Verify non-inactive staff filtering logic
  console.log('\n2. Testing Staff Dropdown Filter Logic...');
  const allOrgStaff = await prisma.staffProfile.findMany({
    where: { organizationId: org.id },
    include: { user: { select: { status: true } } },
  });

  const dropdownStaff = allOrgStaff.filter((s) => s.user.status !== 'INACTIVE');
  const foundInDropdown = dropdownStaff.some((s) => s.id === staff.id);
  assert(foundInDropdown, 'Newly created staff (PENDING status) appears in Assign Shift dropdown');

  // 3. Assign Shift Pattern to Staff
  console.log('\n3. Assigning Shift Pattern to Staff Member...');
  const assignment = await prisma.shiftAssignment.create({
    data: {
      staffProfileId: staff.id,
      shiftPatternId: pattern.id,
      effectiveFrom: new Date(),
      effectiveTo: null,
      assignedBy: 'System Test',
    },
    include: {
      shiftPattern: {
        include: { weeklyDays: true },
      },
    },
  });

  assert(assignment.shiftPattern.name === pattern.name, 'Shift pattern successfully assigned to staff member');

  // 4. Test Staff Portal Shift Retrieval
  console.log('\n4. Testing Staff Portal Shift Retrieval...');
  const staffAssignments = await prisma.shiftAssignment.findMany({
    where: { staffProfileId: staff.id },
    orderBy: { effectiveFrom: 'desc' },
    include: {
      shiftPattern: {
        include: { weeklyDays: true },
      },
    },
  });

  const activeAssignment = staffAssignments.find((a) => !a.effectiveTo || new Date(a.effectiveTo) >= new Date());
  assert(activeAssignment !== undefined, 'Staff portal retrieves active shift assignment');
  assert(activeAssignment?.shiftPattern.weeklyDays.length === 7, 'Shift breakdown includes 7 weekly days');

  // Clean up test staff & assignment
  await prisma.shiftAssignment.deleteMany({ where: { staffProfileId: staff.id } });
  await prisma.staffProfile.delete({ where: { id: staff.id } });
  await prisma.user.delete({ where: { id: user.id } });

  console.log('\n================================================================');
  console.log('Shift Fix Audit Suite Completed: ALL PASSED.');
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
