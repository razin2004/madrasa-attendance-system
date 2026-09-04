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
        { success: false, error: auth.errorMessage },
        { status: auth.errorStatus || 401 }
      );
    }

    const staffProfile = await prisma.staffProfile.findFirst({
      where: {
        organizationId: auth.organization.id,
        OR: [{ id: params.staffId }, { staffId: params.staffId }],
      },
      include: { devices: true },
    });

    if (!staffProfile) {
      return NextResponse.json(
        { success: false, error: 'Staff member not found or access denied.' },
        { status: 404 }
      );
    }

    const actorName = auth.session.user.name || auth.session.user.email;

    // Reset/remove all registered devices for this staff member (Section 11)
    await prisma.staffDevice.deleteMany({
      where: { staffProfileId: staffProfile.id },
    });

    // Record Audit Log
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    await recordAuditLog({
      organizationId: auth.organization.id,
      actorUserId: auth.session.user.id,
      action: 'STAFF_DEVICE_RESET',
      entityType: 'StaffProfile',
      entityId: staffProfile.id,
      metadata: {
        staffId: staffProfile.staffId,
        staffName: staffProfile.name,
        action: 'RESET_ALL_DEVICES',
        resetBy: actorName,
      },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent'),
    });

    const updatedStaff = await prisma.staffProfile.findFirst({
      where: { id: staffProfile.id },
      include: {
        user: true,
        branchAssignments: { include: { branch: true } },
        devices: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: `All device registrations for ${staffProfile.name} have been reset. Re-registration required on next login.`,
      staff: updatedStaff,
    });
  } catch (error: any) {
    console.error('Reset staff device error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to reset staff devices.' },
      { status: 500 }
    );
  }
}
