import { prisma } from '../lib/prisma';

async function main() {
  console.log('Cleaning up orphaned records in DB...');
  // Find valid staff profile IDs
  const validStaff = await prisma.staffProfile.findMany({ select: { id: true } });
  const validStaffIds = new Set(validStaff.map((s) => s.id));

  const branchStaff = await prisma.branchStaffAssignment.findMany();
  for (const bsa of branchStaff) {
    if (!validStaffIds.has(bsa.staffProfileId)) {
      console.log('Deleting orphaned branch staff assignment:', bsa.id);
      await prisma.branchStaffAssignment.delete({ where: { id: bsa.id } });
    }
  }

  const leaveRequests = await prisma.leaveRequest.findMany();
  for (const lr of leaveRequests) {
    if (!validStaffIds.has(lr.staffProfileId)) {
      console.log('Deleting orphaned leave request:', lr.id);
      await prisma.leaveRequest.delete({ where: { id: lr.id } });
    }
  }

  const leaveBalances = await prisma.leaveBalance.findMany();
  for (const lb of leaveBalances) {
    if (!validStaffIds.has(lb.staffProfileId)) {
      console.log('Deleting orphaned leave balance:', lb.id);
      await prisma.leaveBalance.delete({ where: { id: lb.id } });
    }
  }

  const attendanceRecords = await prisma.attendanceRecord.findMany();
  for (const ar of attendanceRecords) {
    if (!validStaffIds.has(ar.staffProfileId)) {
      console.log('Deleting orphaned attendance record:', ar.id);
      await prisma.attendanceRecord.delete({ where: { id: ar.id } });
    }
  }

  const staffDevices = await prisma.staffDevice.findMany();
  for (const sd of staffDevices) {
    if (!validStaffIds.has(sd.staffProfileId)) {
      console.log('Deleting orphaned staff device:', sd.id);
      await prisma.staffDevice.delete({ where: { id: sd.id } });
    }
  }

  console.log('Orphan cleanup complete.');
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
