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

    // Check if this exact device secret is already registered for this staff member
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

    // Check if there is a pending NOT_REGISTERED authorized device slot for this staff member
    const pendingSlot = await prisma.staffDevice.findFirst({
      where: {
        staffProfileId,
        status: 'NOT_REGISTERED',
      },
    });

    let registeredDevice;
    if (pendingSlot) {
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
      },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({
      success: true,
      message: 'Browser successfully registered to staff account.',
      device: {
        id: registeredDevice.id,
        status: registeredDevice.status,
        label: registeredDevice.label,
        registeredAt: registeredDevice.registeredAt,
      },
    });
  } catch (error: any) {
    console.error('Staff device self-registration error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to register attendance device.' },
      { status: 500 }
    );
  }
}
