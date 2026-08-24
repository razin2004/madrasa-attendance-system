import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import { recordAuditLog } from '@/services/audit.service';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { organizationCode: string; shiftPatternId: string } }
) {
  try {
    const auth = await requireOrgAdmin(params.organizationCode);
    if (!auth.authorized || !auth.organization || !auth.session) {
      return NextResponse.json(
        { success: false, error: auth.errorMessage },
        { status: auth.errorStatus || 401 }
      );
    }

    const shiftPattern = await prisma.shiftPattern.findFirst({
      where: {
        id: params.shiftPatternId,
        organizationId: auth.organization.id,
      },
    });

    if (!shiftPattern) {
      return NextResponse.json(
        { success: false, error: 'Shift pattern not found or access denied.' },
        { status: 404 }
      );
    }

    const nextActiveState = !shiftPattern.isActive;

    const updatedPattern = await prisma.shiftPattern.update({
      where: { id: shiftPattern.id },
      data: { isActive: nextActiveState },
    });

    // Record Audit Log
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    await recordAuditLog({
      organizationId: auth.organization.id,
      actorUserId: auth.session.user.id,
      action: nextActiveState ? 'SHIFT_PATTERN_ACTIVATED' : 'SHIFT_PATTERN_DEACTIVATED',
      entityType: 'ShiftPattern',
      entityId: updatedPattern.id,
      metadata: {
        name: updatedPattern.name,
        isActive: nextActiveState,
      },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({
      success: true,
      message: `Shift pattern "${updatedPattern.name}" is now ${nextActiveState ? 'active' : 'inactive'}.`,
      isActive: nextActiveState,
    });
  } catch (error: any) {
    console.error('Toggle shift pattern active state error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update shift pattern status.' },
      { status: 500 }
    );
  }
}
