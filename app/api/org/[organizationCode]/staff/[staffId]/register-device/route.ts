import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateDeviceSecret, hashDeviceSecret } from '@/lib/security';
import { recordAuditLog } from '@/services/audit.service';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { organizationCode: string; staffId: string } }
) {
  try {
    const orgCode = params.organizationCode?.toUpperCase();
    const organization = await prisma.organization.findFirst({
      where: { organizationCode: { equals: orgCode, mode: 'insensitive' }, status: 'ACTIVE' },
    });

    if (!organization) {
      return NextResponse.json(
        { success: false, error: 'Organization not found or inactive.' },
        { status: 404 }
      );
    }

    const staffProfile = await prisma.staffProfile.findFirst({
      where: {
        id: params.staffId,
        organizationId: organization.id,
      },
      include: { devices: true, user: true },
    });

    if (!staffProfile) {
      return NextResponse.json(
        { success: false, error: 'Staff profile not found.' },
        { status: 404 }
      );
    }

    if (staffProfile.user.status !== 'ACTIVE') {
      return NextResponse.json(
        { success: false, error: 'Staff account is currently inactive.' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { label = 'Staff Web Device' } = body;

    // Generate 64-character cryptographically secure random device secret (Section 29, 30)
    const rawSecret = generateDeviceSecret();
    const secretHash = hashDeviceSecret(rawSecret);

    const updatedDevice = await prisma.staffDevice.create({
      data: {
        staffProfileId: staffProfile.id,
        secretHash,
        status: 'REGISTERED',
        label: (label as string)?.slice(0, 100) || 'Staff Web Device',
        registeredAt: new Date(),
        lastUsedAt: new Date(),
      },
    });

    // Record Audit Log
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    await recordAuditLog({
      organizationId: organization.id,
      actorUserId: staffProfile.userId,
      action: 'STAFF_DEVICE_REGISTERED',
      entityType: 'StaffDevice',
      entityId: updatedDevice.id,
      metadata: {
        staffId: staffProfile.staffId,
        deviceLabel: updatedDevice.label,
        status: 'REGISTERED',
      },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({
      success: true,
      message: 'Staff device registered successfully.',
      deviceSecret: rawSecret, // Delivered to client storage (Section 30, 31)
      device: {
        id: updatedDevice.id,
        status: updatedDevice.status,
        label: updatedDevice.label,
        registeredAt: updatedDevice.registeredAt,
      },
    });
  } catch (error: any) {
    console.error('Register staff device error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to register staff device.' },
      { status: 500 }
    );
  }
}
