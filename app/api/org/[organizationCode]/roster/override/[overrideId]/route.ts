import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import { recordAuditLog } from '@/services/audit.service';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: Request,
  { params }: { params: { organizationCode: string; overrideId: string } }
) {
  try {
    const auth = await requireOrgAdmin(params.organizationCode);
    if (!auth.authorized || !auth.organization || !auth.session) {
      return NextResponse.json(
        { success: false, error: auth.errorMessage },
        { status: auth.errorStatus || 401 }
      );
    }

    const override = await prisma.staffShiftOverride.findFirst({
      where: {
        id: params.overrideId,
        staffProfile: { organizationId: auth.organization.id },
      },
      include: {
        staffProfile: true,
      },
    });

    if (!override) {
      return NextResponse.json(
        { success: false, error: 'Shift override not found or access denied.' },
        { status: 404 }
      );
    }

    await prisma.staffShiftOverride.delete({
      where: { id: override.id },
    });

    // Record Audit Log
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    await recordAuditLog({
      organizationId: auth.organization.id,
      actorUserId: auth.session.user.id,
      action: 'STAFF_SHIFT_OVERRIDE_DELETED',
      entityType: 'StaffShiftOverride',
      entityId: override.id,
      metadata: {
        staffId: override.staffProfile.staffId,
        staffName: override.staffProfile.name,
        date: override.date.toISOString().slice(0, 10),
      },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({
      success: true,
      message: 'Staff shift override removed. Base shift pattern restored for this date.',
    });
  } catch (error: any) {
    console.error('Delete staff shift override error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to remove staff shift override.' },
      { status: 500 }
    );
  }
}
