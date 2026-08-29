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

    // 2. Count existing registered devices & check for authorized pending slot
    const allStaffDevices = await prisma.staffDevice.findMany({
      where: { staffProfileId },
      orderBy: { createdAt: 'asc' },
    });

    const registeredDevices = allStaffDevices.filter((d) => d.status === 'REGISTERED');
    const pendingSlot = allStaffDevices.find((d) => d.status === 'NOT_REGISTERED');

    // Reject registration if staff already has a registered device AND no pending authorized slot
    if (registeredDevices.length >= 1 && !pendingSlot) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Device registration limit reached. Please contact your organization administrator to authorize an additional device slot.',
        },
        { status: 403 }
      );
    }

    let registeredDevice;
    if (pendingSlot) {
      // Bind incoming device to the pending authorized slot (Secondary Device)
      registeredDevice = await prisma.staffDevice.update({
        where: { id: pendingSlot.id },
        data: {
          secretHash,
          status: 'REGISTERED',
          label,
          registeredAt: new Date(),
          lastUsedAt: new Date(),
        },
      });
    } else {
      // First device registration (Primary Device)
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
        slotType: pendingSlot ? 'SECONDARY_DEVICE' : 'PRIMARY_DEVICE',
      },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({
      success: true,
      message: pendingSlot ? 'Secondary device registered successfully.' : 'Primary device registered successfully.',
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
