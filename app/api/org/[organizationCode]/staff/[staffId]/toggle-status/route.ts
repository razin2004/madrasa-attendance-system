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
        id: params.staffId,
        organizationId: auth.organization.id,
      },
      include: { user: true },
    });

    if (!staffProfile) {
      return NextResponse.json(
        { success: false, error: 'Staff member not found or access denied.' },
        { status: 404 }
      );
    }

    const nextStatus = staffProfile.user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    const updatedUser = await prisma.user.update({
      where: { id: staffProfile.userId },
      data: { status: nextStatus },
    });

    // Record Audit Log
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    await recordAuditLog({
      organizationId: auth.organization.id,
      actorUserId: auth.session.user.id,
      action: nextStatus === 'ACTIVE' ? 'STAFF_ACTIVATED' : 'STAFF_DEACTIVATED',
      entityType: 'StaffProfile',
      entityId: staffProfile.id,
      metadata: {
        staffId: staffProfile.staffId,
        staffName: staffProfile.name,
        previousStatus: staffProfile.user.status,
        newStatus: nextStatus,
      },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({
      success: true,
      message: `Staff member "${staffProfile.name}" is now ${nextStatus.toLowerCase()}.`,
      status: nextStatus,
    });
  } catch (error: any) {
    console.error('Toggle staff status error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update staff account status.' },
      { status: 500 }
    );
  }
}
