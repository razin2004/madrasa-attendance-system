import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaff } from '@/lib/tenant-auth';
import { hashDeviceSecret } from '@/lib/security';
import { recordAuditLog } from '@/services/audit.service';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { organizationCode: string } }
) {
  try {
    const auth = await requireStaff(params.organizationCode);
    if (!auth.authorized || !auth.organization || !auth.staffProfile || !auth.session) {
      return NextResponse.json(
        { success: false, error: auth.errorMessage },
        { status: auth.errorStatus || 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { deviceSecret, deviceLabel } = body;

    if (!deviceSecret || typeof deviceSecret !== 'string' || deviceSecret.trim().length < 16) {
      return NextResponse.json(
        { success: false, error: 'Valid cryptographic device secret is required.' },
        { status: 400 }
      );
    }

    const staffProfileId = auth.staffProfile.id;
    const secretHash = hashDeviceSecret(deviceSecret.trim());
    const label = deviceLabel || request.headers.get('user-agent')?.slice(0, 80) || 'Staff Browser';

    // 1. Check if this exact device secret is already registered for this staff member
    const existingDevice = await prisma.staffDevice.findFirst({
      where: {
        staffProfileId,
        secretHash,
        status: 'REGISTERED',
      },
    });

    if (existingDevice) {
      return NextResponse.json({
        success: true,
        message: 'Device is already registered to staff account.',
        device: {
          id: existingDevice.id,
          status: existingDevice.status,
          label: existingDevice.label,
          registeredAt: existingDevice.registeredAt,
        },
      });
    }

    // 2. Query existing staff devices & enforce 1 device limit
    const allStaffDevices = await prisma.staffDevice.findMany({
      where: { staffProfileId },
      orderBy: { createdAt: 'asc' },
    });

    const registeredDevices = allStaffDevices.filter((d) => d.status === 'REGISTERED');

    // Strictly enforce max 1 registered device per staff member
    if (registeredDevices.length >= 1) {
      return NextResponse.json(
        {
          success: false,
          error:
            'A device is already registered to your staff account. Only one authorized device is allowed per staff member. Please contact your organization administrator to reset your registered device if you changed phones.',
        },
        { status: 403 }
      );
    }

    let registeredDevice;
    if (allStaffDevices.length > 0) {
      // Update existing device slot to REGISTERED
      registeredDevice = await prisma.staffDevice.update({
        where: { id: allStaffDevices[0].id },
        data: {
          secretHash,
          status: 'REGISTERED',
          label,
          registeredAt: new Date(),
          lastUsedAt: new Date(),
        },
      });
    } else {
      // Create first device registration
      registeredDevice = await prisma.staffDevice.create({
        data: {
          staffProfileId,
          secretHash,
          status: 'REGISTERED',
          label,
          registeredAt: new Date(),
          lastUsedAt: new Date(),
        },
      });
    }

    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    await recordAuditLog({
      organizationId: auth.organization.id,
      actorUserId: auth.session.user.id,
      action: 'STAFF_DEVICE_REGISTERED',
      entityType: 'StaffDevice',
      entityId: registeredDevice.id,
      metadata: {
        staffId: auth.staffProfile.staffId,
        label,
        slotType: 'PRIMARY_DEVICE',
      },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({
      success: true,
      message: 'Device registered successfully.',
      device: {
        id: registeredDevice.id,
        status: registeredDevice.status,
        label: registeredDevice.label,
        registeredAt: registeredDevice.registeredAt,
      },
    });
  } catch (error: any) {
    console.error('Staff device registration error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to register device credential.' },
      { status: 500 }
    );
  }
}
