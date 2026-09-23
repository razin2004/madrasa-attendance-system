import {
  PrismaClient,
  OrganizationStatus,
  UserRole,
  UserStatus,
  BranchStatus,
  Weekday,
  AttendanceType,
  AttendanceVerificationStatus,
  DeviceStatus,
  LeaveType,
  LeaveRequestStatus,
  IdDocType,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting ShiftGuard Database Seeding...');

  // ---------------------------------------------------------------------------
  // 1. PASSWORDS & DEFAULT SUPER ADMIN
  // ---------------------------------------------------------------------------
  const defaultPasswordHash = await bcrypt.hash('ShiftGuard@2026', 10);

  const superAdminEmail = (process.env.SUPER_ADMIN_EMAIL || 'doctorbooksystem@gmail.com').toLowerCase().trim();
  const superAdmin = await prisma.user.upsert({
    where: { email: superAdminEmail },
    update: { passwordHash: defaultPasswordHash },
    create: {
      name: 'ShiftGuard Super Admin',
      email: superAdminEmail,
      passwordHash: defaultPasswordHash,
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
    },
  });
  console.log(`✅ Super Admin ready: ${superAdmin.email}`);

  // ---------------------------------------------------------------------------
  // 2. ORGANIZATIONS
  // ---------------------------------------------------------------------------
  // A. Pending Organization (For Super Admin Approval View)
  const pendingOrg = await prisma.organization.upsert({
    where: { organizationCode: 'NIT' },
    update: { status: OrganizationStatus.PENDING },
    create: {
      name: 'National Institute Of Technology',
      organizationCode: 'NIT',
      contactEmail: 'admin@nit.ac.in',
      contactPersonName: 'Dr. K. V. Sharma',
      phone: '+91 98470 12345',
      status: OrganizationStatus.PENDING,
    },
  });
  console.log(`✅ Pending Org ready: ${pendingOrg.name} (${pendingOrg.organizationCode})`);

  // B. Active Approved Organization (For Org Admin & Staff Views)
  const activeOrg = await prisma.organization.upsert({
    where: { organizationCode: 'TECH' },
    update: { status: OrganizationStatus.ACTIVE },
    create: {
      name: 'TechCorp Solutions',
      organizationCode: 'TECH',
      contactEmail: 'admin@techcorp.com',
      contactPersonName: 'Sarah Jenkins',
      phone: '+91 98470 67890',
      status: OrganizationStatus.ACTIVE,
      approvedAt: new Date(),
    },
  });
  console.log(`✅ Active Org ready: ${activeOrg.name} (${activeOrg.organizationCode})`);

  // Org Admin User for TECH
  const orgAdminUser = await prisma.user.upsert({
    where: { email: 'admin@techcorp.com' },
    update: { organizationId: activeOrg.id },
    create: {
      name: 'Sarah Jenkins',
      email: 'admin@techcorp.com',
      passwordHash: defaultPasswordHash,
      role: UserRole.ORG_ADMIN,
      status: UserStatus.ACTIVE,
      organizationId: activeOrg.id,
    },
  });
  console.log(`✅ Org Admin ready: ${orgAdminUser.email}`);

  // ---------------------------------------------------------------------------
  // 3. BRANCHES & GEOFENCES
  // ---------------------------------------------------------------------------
  let calicutBranch = await prisma.branch.findFirst({
    where: { organizationId: activeOrg.id, name: 'Calicut Campus' },
  });

  if (!calicutBranch) {
    calicutBranch = await prisma.branch.create({
      data: {
        organizationId: activeOrg.id,
        name: 'Calicut Campus',
        address: 'NIT Campus P.O., Calicut, Kerala 673601',
        latitude: 11.3216,
        longitude: 75.9336,
        geofenceRadiusMeters: 150,
        publicIp: '103.21.124.5',
        status: BranchStatus.ACTIVE,
      },
    });
  }

  let mukkamBranch = await prisma.branch.findFirst({
    where: { organizationId: activeOrg.id, name: 'Mukkam Branch' },
  });

  if (!mukkamBranch) {
    mukkamBranch = await prisma.branch.create({
      data: {
        organizationId: activeOrg.id,
        name: 'Mukkam Branch',
        address: 'Main Road, Mukkam, Kozhikode, Kerala 673602',
        latitude: 11.3182,
        longitude: 75.9912,
        geofenceRadiusMeters: 200,
        publicIp: '103.21.124.10',
        status: BranchStatus.ACTIVE,
      },
    });
  }
  console.log(`✅ Branches ready: Calicut Campus & Mukkam Branch`);

  // ---------------------------------------------------------------------------
  // 4. SHIFT PATTERNS
  // ---------------------------------------------------------------------------
  let morningShift = await prisma.shiftPattern.findFirst({
    where: { organizationId: activeOrg.id, name: 'Morning Session: 08:00 AM - 01:30 PM' },
  });

  if (!morningShift) {
    morningShift = await prisma.shiftPattern.create({
      data: {
        organizationId: activeOrg.id,
        name: 'Morning Session: 08:00 AM - 01:30 PM',
        description: 'Standard Morning Duty Shift',
        minimumStaffingThreshold: 2,
        isActive: true,
        weeklyDays: {
          create: [
            Weekday.MONDAY,
            Weekday.TUESDAY,
            Weekday.WEDNESDAY,
            Weekday.THURSDAY,
            Weekday.FRIDAY,
          ].map((day) => ({
            weekday: day,
            startTime: '08:00',
            endTime: '13:30',
            isHoliday: false,
          })),
        },
      },
    });
  }

  let eveningShift = await prisma.shiftPattern.findFirst({
    where: { organizationId: activeOrg.id, name: 'Evening Session: 04:00 PM - 08:30 PM' },
  });

  if (!eveningShift) {
    eveningShift = await prisma.shiftPattern.create({
      data: {
        organizationId: activeOrg.id,
        name: 'Evening Session: 04:00 PM - 08:30 PM',
        description: 'Standard Evening Duty Shift',
        minimumStaffingThreshold: 1,
        isActive: true,
        weeklyDays: {
          create: [
            Weekday.MONDAY,
            Weekday.TUESDAY,
            Weekday.WEDNESDAY,
            Weekday.THURSDAY,
            Weekday.FRIDAY,
          ].map((day) => ({
            weekday: day,
            startTime: '16:00',
            endTime: '20:30',
            isHoliday: false,
          })),
        },
      },
    });
  }
  console.log(`✅ Shift Patterns ready: Morning Session & Evening Session`);

  // ---------------------------------------------------------------------------
  // 5. STAFF PROFILES & ASSIGNMENTS
  // ---------------------------------------------------------------------------
  const staffData = [
    {
      name: 'Mubarak Ali',
      email: 'mubarak@techcorp.com',
      staffId: 'STF001',
      branchId: calicutBranch.id,
      shiftPatternId: morningShift.id,
    },
    {
      name: 'Ali Hassan',
      email: 'ali@techcorp.com',
      staffId: 'STF002',
      branchId: calicutBranch.id,
      shiftPatternId: morningShift.id,
    },
    {
      name: 'Jerin Thomas',
      email: 'jerin@techcorp.com',
      staffId: 'STF003',
      branchId: mukkamBranch.id,
      shiftPatternId: eveningShift.id,
    },
  ];

  const createdStaffProfiles = [];

  for (const item of staffData) {
    const user = await prisma.user.upsert({
      where: { email: item.email },
      update: { organizationId: activeOrg.id },
      create: {
        name: item.name,
        email: item.email,
        passwordHash: defaultPasswordHash,
        role: UserRole.STAFF,
        status: UserStatus.ACTIVE,
        organizationId: activeOrg.id,
      },
    });

    let profile = await prisma.staffProfile.findUnique({
      where: { userId: user.id },
    });

    if (!profile) {
      profile = await prisma.staffProfile.create({
        data: {
          userId: user.id,
          organizationId: activeOrg.id,
          staffId: item.staffId,
          name: item.name,
          phone: '+91 98950 11223',
          address: 'Calicut, Kerala',
          idDocType: IdDocType.AADHAAR,
          idDocLast4: '5482',
        },
      });
    }

    // Register Staff Device if not registered
    const existingDevice = await prisma.staffDevice.findFirst({
      where: { staffProfileId: profile.id },
    });
    if (!existingDevice) {
      await prisma.staffDevice.create({
        data: {
          staffProfileId: profile.id,
          status: DeviceStatus.REGISTERED,
          label: 'Staff Primary Smartphone',
          registeredAt: new Date(),
          lastUsedAt: new Date(),
        },
      });
    }

    // Assign to Branch if not assigned
    const existingBranchAssignment = await prisma.branchStaffAssignment.findFirst({
      where: { staffProfileId: profile.id, branchId: item.branchId },
    });
    if (!existingBranchAssignment) {
      await prisma.branchStaffAssignment.create({
        data: {
          staffProfileId: profile.id,
          branchId: item.branchId,
        },
      });
    }

    // Assign Shift Pattern if not assigned
    const existingShiftAssignment = await prisma.shiftAssignment.findFirst({
      where: { staffProfileId: profile.id, shiftPatternId: item.shiftPatternId },
    });
    if (!existingShiftAssignment) {
      await prisma.shiftAssignment.create({
        data: {
          staffProfileId: profile.id,
          shiftPatternId: item.shiftPatternId,
          effectiveFrom: new Date(2026, 0, 1),
        },
      });
    }

    createdStaffProfiles.push(profile);
    console.log(`✅ Staff Onboarded: ${profile.name} (${profile.staffId})`);
  }

  const [mubarakProfile, aliProfile, jerinProfile] = createdStaffProfiles;

  // ---------------------------------------------------------------------------
  // 6. TODAY'S ATTENDANCE RECORDS
  // ---------------------------------------------------------------------------
  const today = new Date();
  
  // Mubarak Clock-In (On-Time at 07:55 AM)
  const clockInTimeMubarak = new Date(today);
  clockInTimeMubarak.setHours(7, 55, 0, 0);

  // Mubarak Clock-Out (at 01:35 PM)
  const clockOutTimeMubarak = new Date(today);
  clockOutTimeMubarak.setHours(13, 35, 0, 0);

  const existingMubarakAttendance = await prisma.attendanceRecord.findFirst({
    where: { staffProfileId: mubarakProfile.id },
  });

  if (!existingMubarakAttendance) {
    await prisma.attendanceRecord.createMany({
      data: [
        {
          organizationId: activeOrg.id,
          staffProfileId: mubarakProfile.id,
          branchId: calicutBranch.id,
          type: AttendanceType.CLOCK_IN,
          verificationStatus: AttendanceVerificationStatus.VERIFIED,
          deviceStatus: DeviceStatus.REGISTERED,
          deviceMatched: true,
          deviceLabel: 'Chrome on Mobile',
          ipAddress: '103.21.124.5',
          ipMatched: true,
          latitude: 11.3216,
          longitude: 75.9336,
          locationAccuracy: 12.5,
          distanceMeters: 14.2,
          geofenceRadiusMeters: 150,
          geofenceMatched: true,
          scheduledShiftName: 'Morning Session: 08:00 AM - 01:30 PM',
          scheduledStartTime: '08:00',
          scheduledEndTime: '13:30',
          lateMinutes: 0,
          timestamp: clockInTimeMubarak,
        },
        {
          organizationId: activeOrg.id,
          staffProfileId: mubarakProfile.id,
          branchId: calicutBranch.id,
          type: AttendanceType.CLOCK_OUT,
          verificationStatus: AttendanceVerificationStatus.VERIFIED,
          deviceStatus: DeviceStatus.REGISTERED,
          deviceMatched: true,
          deviceLabel: 'Chrome on Mobile',
          ipAddress: '103.21.124.5',
          ipMatched: true,
          latitude: 11.3216,
          longitude: 75.9336,
          locationAccuracy: 10.0,
          distanceMeters: 18.0,
          geofenceRadiusMeters: 150,
          geofenceMatched: true,
          scheduledShiftName: 'Morning Session: 08:00 AM - 01:30 PM',
          scheduledStartTime: '08:00',
          scheduledEndTime: '13:30',
          earlyDepartureMinutes: 0,
          timestamp: clockOutTimeMubarak,
        },
      ],
    });
  }

  // Ali Clock-In (Late at 08:05 AM)
  const clockInTimeAli = new Date(today);
  clockInTimeAli.setHours(8, 5, 0, 0);

  const existingAliAttendance = await prisma.attendanceRecord.findFirst({
    where: { staffProfileId: aliProfile.id },
  });

  if (!existingAliAttendance) {
    await prisma.attendanceRecord.create({
      data: {
        organizationId: activeOrg.id,
        staffProfileId: aliProfile.id,
        branchId: calicutBranch.id,
        type: AttendanceType.CLOCK_IN,
        verificationStatus: AttendanceVerificationStatus.VERIFIED,
        deviceStatus: DeviceStatus.REGISTERED,
        deviceMatched: true,
        deviceLabel: 'Android Native Browser',
        ipAddress: '103.21.124.5',
        ipMatched: true,
        latitude: 11.3217,
        longitude: 75.9337,
        locationAccuracy: 15.0,
        distanceMeters: 25.4,
        geofenceRadiusMeters: 150,
        geofenceMatched: true,
        scheduledShiftName: 'Morning Session: 08:00 AM - 01:30 PM',
        scheduledStartTime: '08:00',
        scheduledEndTime: '13:30',
        lateMinutes: 5,
        timestamp: clockInTimeAli,
      },
    });
  }
  console.log(`✅ Attendance records generated for Mubarak & Ali`);

  // ---------------------------------------------------------------------------
  // 7. PENDING LEAVE REQUEST
  // ---------------------------------------------------------------------------
  const leaveStartDate = new Date();
  leaveStartDate.setDate(today.getDate() + 2);

  const leaveEndDate = new Date();
  leaveEndDate.setDate(today.getDate() + 4);

  const existingJerinLeave = await prisma.leaveRequest.findFirst({
    where: { staffProfileId: jerinProfile.id },
  });

  if (!existingJerinLeave) {
    await prisma.leaveRequest.create({
      data: {
        organizationId: activeOrg.id,
        staffProfileId: jerinProfile.id,
        type: LeaveType.ANNUAL,
        startDate: leaveStartDate,
        endDate: leaveEndDate,
        daysCount: 3,
        reason: 'Attending family event in hometown.',
        status: LeaveRequestStatus.PENDING,
      },
    });
  }
  console.log(`✅ Pending Leave Request created for Jerin Thomas`);

  console.log('\n🎉 Seeding completed successfully!');
  console.log('----------------------------------------------------');
  console.log('🔑 CREDENTIALS FOR TESTING / SCREENSHOTS:');
  console.log(`Super Admin User : ${superAdminEmail} / ShiftGuard@2026`);
  console.log('Org Admin User   : admin@techcorp.com / ShiftGuard@2026');
  console.log('Staff Mubarak    : mubarak@techcorp.com / ShiftGuard@2026');
  console.log('Staff Ali        : ali@techcorp.com / ShiftGuard@2026');
  console.log('Staff Jerin      : jerin@techcorp.com / ShiftGuard@2026');
  console.log('----------------------------------------------------');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
