import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentSession } from '@/lib/session';
import { recordAuditLog } from '@/services/audit.service';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const orgId = params.id;

    // 1. Authorize Super Admin Session
    const session = await getCurrentSession();
    if (!session || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Super Admin access required.' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const reason = body.reason?.trim() || 'Deactivated by Super Admin';

    // 2. Fetch Organization
    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!organization) {
      return NextResponse.json(
        { success: false, error: 'Organization record not found.' },
        { status: 404 }
      );
    }

    if (organization.status === 'SUSPENDED') {
      return NextResponse.json(
        { success: false, error: 'Organization is already deactivated/suspended.' },
        { status: 400 }
      );
    }

    // 3. Update Status to SUSPENDED
    const actorName = session.user.name || session.user.email;
    const updatedOrg = await prisma.organization.update({
      where: { id: orgId },
      data: {
        status: 'SUSPENDED',
        rejectionReason: reason,
        reviewedBy: actorName,
        reviewedAt: new Date(),
      },
    });

    // 4. Record Audit Log
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    await recordAuditLog({
      organizationId: updatedOrg.id,
      actorUserId: session.user.id,
      action: 'ORGANIZATION_DEACTIVATED',
      entityType: 'Organization',
      entityId: updatedOrg.id,
      metadata: {
        organizationName: updatedOrg.name,
        organizationCode: updatedOrg.organizationCode,
        reason,
      },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({
      success: true,
      message: `Organization "${updatedOrg.name}" has been deactivated.`,
      organization: updatedOrg,
    });
  } catch (error: any) {
    console.error('Deactivate organization error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to deactivate organization.' },
      { status: 500 }
    );
  }
}
