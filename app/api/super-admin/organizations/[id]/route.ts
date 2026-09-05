import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentSession } from '@/lib/session';
import { recordAuditLog } from '@/services/audit.service';

export const dynamic = 'force-dynamic';

export async function DELETE(
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

    // 2. Fetch Organization
    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        _count: {
          select: {
            users: true,
            branches: true,
            staffProfiles: true,
          },
        },
      },
    });

    if (!organization) {
      return NextResponse.json(
        { success: false, error: 'Organization record not found.' },
        { status: 404 }
      );
    }

    // Record audit log before deleting record
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    await recordAuditLog({
      organizationId: organization.id,
      actorUserId: session.user.id,
      action: 'ORGANIZATION_DELETED',
      entityType: 'Organization',
      entityId: organization.id,
      metadata: {
        organizationName: organization.name,
        organizationCode: organization.organizationCode,
        deletedUserCount: organization._count.users,
        deletedBranchCount: organization._count.branches,
        deletedStaffCount: organization._count.staffProfiles,
      },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent'),
    }).catch(() => {});

    // Delete organization (Cascade delete will clean up associated users, branches, records)
    await prisma.organization.delete({
      where: { id: orgId },
    });

    return NextResponse.json({
      success: true,
      message: `Organization "${organization.name}" and all associated data deleted permanently.`,
    });
  } catch (error: any) {
    console.error('Delete organization error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete organization. Please check for active dependencies.' },
      { status: 500 }
    );
  }
}
