import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import { recordAuditLog } from '@/services/audit.service';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: Request,
  { params }: { params: { organizationCode: string; staffId: string; deviceId: string } }
) {
  try {
    const auth = await requireOrgAdmin(params.organizationCode);
    if (!auth.authorized || !auth.organization || !auth.session) {
      return NextResponse.json(
        { success: false, error: auth.errorMessage },
        { status: auth.errorStatus || 401 }
      );
    }

    const staffProfile = await prisma.staffProfile.findFirst({
      where: {
        organizationId: auth.organization.id,
        OR: [{ id: params.staffId }, { staffId: params.staffId }],
      },
    });

    if (!staffProfile) {
      return NextResponse.json(
        { success: false, error: 'Staff member not found.' },
        { status: 404 }
      );
    }

    const device = await prisma.staffDevice.findFirst({
      where: {
        id: params.deviceId,
        staffProfileId: staffProfile.id,
      },
    });

    if (!device) {
      return NextResponse.json(
        { success: false, error: 'Device record not found for this staff member.' },
        { status: 404 }
      );
    }

    // Delete device binding immediately from database
    await prisma.staffDevice.delete({
      where: { id: device.id },
    });

    // Record audit log
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    await recordAuditLog({
      organizationId: auth.organization.id,
      actorUserId: auth.session.user.id,
      action: 'STAFF_DEVICE_RESET',
      entityType: 'StaffDevice',
      entityId: device.id,
      metadata: {
        staffProfileId: staffProfile.id,
        staffId: staffProfile.staffId,
        staffName: staffProfile.name,
        deviceLabel: device.label,
        removedAt: new Date().toISOString(),
      },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({
      success: true,
      message: 'Device removed successfully. This device will no longer be allowed to verify attendance.',
    });
  } catch (error: any) {
    console.error('Delete staff device error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to remove registered device.' },
      { status: 500 }
    );
  }
}
