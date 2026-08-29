import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import { recordAuditLog } from '@/services/audit.service';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { organizationCode: string; staffId: string } }
) {
  try {
    const auth = await requireOrgAdmin(params.organizationCode);
    if (!auth.authorized || !auth.organization || !auth.session) {
      return NextResponse.json(
        { success: false, error: auth.errorMessage || 'Unauthorized.' },
        { status: auth.errorStatus || 401 }
      );
    }

    const staffProfile = await prisma.staffProfile.findFirst({
      where: {
        id: params.staffId,
        organizationId: auth.organization.id,
      },
      include: {
        devices: true,
      },
    });

    if (!staffProfile) {
      return NextResponse.json(
        { success: false, error: 'Staff member not found or access denied.' },
        { status: 404 }
      );
    }

    // Check if an un-registered device slot is already pending
    const existingPending = staffProfile.devices.find(
      (d) => d.status === 'NOT_REGISTERED'
    );

    if (existingPending) {
      return NextResponse.json(
        {
          success: false,
          error: 'An additional device slot is already authorized and pending login for this staff member.',
        },
        { status: 400 }
      );
    }

    // Create a new NOT_REGISTERED device slot
    const newDeviceSlot = await prisma.staffDevice.create({
      data: {
        staffProfileId: staffProfile.id,
        status: 'NOT_REGISTERED',
        label: 'Secondary Authorized Device (Pending Login)',
      },
    });

    // Record Audit Log
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    await recordAuditLog({
      organizationId: auth.organization.id,
      actorUserId: auth.session.user.id,
      action: 'STAFF_DEVICE_SLOT_AUTHORIZED',
      entityType: 'StaffDevice',
      entityId: newDeviceSlot.id,
      metadata: {
        staffId: staffProfile.staffId,
        staffName: staffProfile.name,
      },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({
      success: true,
      message: `Secondary device slot authorized for ${staffProfile.name}. They can now log in on their second device.`,
      device: newDeviceSlot,
    });
  } catch (error: any) {
    console.error('Authorize additional device error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to authorize additional device slot.' },
      { status: 500 }
    );
  }
}
