import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AttendanceType, AttendanceVerificationStatus, DeviceStatus } from '@prisma/client';

export async function POST(
  req: NextRequest,
  { params }: { params: { organizationCode: string } }
) {
  try {
    const orgCode = params.organizationCode?.toUpperCase();
    if (!orgCode) {
      return NextResponse.json({ success: false, error: 'Organization code required' }, { status: 400 });
    }

    const body = await req.json();
    const { identifier, branchId } = body;

    if (!identifier) {
      return NextResponse.json({ success: false, error: 'QR Code or Staff Identifier missing' }, { status: 400 });
    }

    // 1. Fetch organization
    const org = await prisma.organization.findFirst({
      where: { organizationCode: orgCode },
    });

    if (!org) {
      return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 404 });
    }

    // Parse identifier (could be string ID or JSON payload)
    let parsedStaffCode = identifier;
    let parsedUserId = '';

    if (identifier.startsWith('{')) {
      try {
        const parsed = JSON.parse(identifier);
        parsedStaffCode = parsed.staffId || parsed.code || parsed.id || identifier;
        parsedUserId = parsed.userId || '';
      } catch {
        parsedStaffCode = identifier;
      }
    }

    // 2. Locate Staff Profile
    const staff = await prisma.staffProfile.findFirst({
      where: {
        organizationId: org.id,
        OR: [
          { staffId: parsedStaffCode },
          { id: parsedStaffCode },
          ...(parsedUserId ? [{ userId: parsedUserId }] : []),
          { user: { email: parsedStaffCode } },
        ],
      },
      include: {
        user: true,
        branchAssignments: {
          include: { branch: true },
        },
      },
    });

    if (!staff) {
      return NextResponse.json({
        success: false,
        error: `Staff member not found for badge: "${parsedStaffCode}"`,
      }, { status: 404 });
    }

    // Check if staff user account is active
    if (staff.user.status !== 'ACTIVE') {
      return NextResponse.json({
        success: false,
        error: `Staff account is ${staff.user.status}. Kiosk scan denied.`,
      }, { status: 403 });
    }

    // 3. Determine latest attendance record today
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    const lastRecordToday = await prisma.attendanceRecord.findFirst({
      where: {
        organizationId: org.id,
        staffProfileId: staff.id,
        timestamp: { gte: startOfToday },
      },
      orderBy: { timestamp: 'desc' },
    });

    // 4. Decide Action: If last was CLOCK_IN, now CLOCK_OUT. Otherwise CLOCK_IN.
    let punchType: AttendanceType = AttendanceType.CLOCK_IN;
    let actionLabel = 'PUNCH_IN';

    if (lastRecordToday && lastRecordToday.type === AttendanceType.CLOCK_IN) {
      punchType = AttendanceType.CLOCK_OUT;
      actionLabel = 'PUNCH_OUT';
    }

    // Target branch: passed branchId, or staff primary assigned branch
    const effectiveBranchId = branchId || staff.branchAssignments[0]?.branchId || null;
    const branchName = staff.branchAssignments.find(b => b.branchId === effectiveBranchId)?.branch.name || 'Main Branch';

    // 5. Create Attendance Record
    const clientIp = req.headers.get('x-forwarded-for') || '127.0.0.1';

    const newRecord = await prisma.attendanceRecord.create({
      data: {
        organizationId: org.id,
        staffProfileId: staff.id,
        branchId: effectiveBranchId,
        type: punchType,
        verificationStatus: AttendanceVerificationStatus.VERIFIED,
        source: 'NORMAL',
        deviceStatus: DeviceStatus.REGISTERED,
        deviceMatched: true,
        deviceLabel: 'Touchless Kiosk Scanner',
        ipAddress: clientIp,
        ipMatched: true,
        geofenceMatched: true,
        timestamp: now,
        lateMinutes: punchType === AttendanceType.CLOCK_IN ? 0 : 0,
      },
    });

    return NextResponse.json({
      success: true,
      action: actionLabel,
      timestamp: now.toISOString(),
      staff: {
        id: staff.id,
        staffId: staff.staffId,
        name: staff.name,
        email: staff.user.email,
        branchName,
      },
      recordId: newRecord.id,
      message: actionLabel === 'PUNCH_IN' 
        ? `Welcome, ${staff.name}! Clocked IN at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        : `Goodbye, ${staff.name}! Clocked OUT at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    });

  } catch (error: any) {
    console.error('Kiosk scan error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error processing QR scan',
    }, { status: 500 });
  }
}
