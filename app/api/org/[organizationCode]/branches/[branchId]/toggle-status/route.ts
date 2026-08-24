import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import { recordAuditLog } from '@/services/audit.service';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { organizationCode: string; branchId: string } }
) {
  try {
    const auth = await requireOrgAdmin(params.organizationCode);
    if (!auth.authorized || !auth.organization || !auth.session) {
      return NextResponse.json(
        { success: false, error: auth.errorMessage },
        { status: auth.errorStatus || 401 }
      );
    }

    const branch = await prisma.branch.findFirst({
      where: {
        id: params.branchId,
        organizationId: auth.organization.id,
      },
    });

    if (!branch) {
      return NextResponse.json(
        { success: false, error: 'Branch not found or access denied.' },
        { status: 404 }
      );
    }

    const nextStatus = branch.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    const updatedBranch = await prisma.branch.update({
      where: { id: branch.id },
      data: { status: nextStatus },
    });

    // Record Audit Log
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    await recordAuditLog({
      organizationId: auth.organization.id,
      actorUserId: auth.session.user.id,
      action: nextStatus === 'ACTIVE' ? 'BRANCH_ACTIVATED' : 'BRANCH_DEACTIVATED',
      entityType: 'Branch',
      entityId: branch.id,
      metadata: {
        branchName: branch.name,
        previousStatus: branch.status,
        newStatus: nextStatus,
      },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({
      success: true,
      message: `Branch "${branch.name}" is now ${nextStatus.toLowerCase()}.`,
      branch: updatedBranch,
    });
  } catch (error: any) {
    console.error('Toggle branch status error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update branch status.' },
      { status: 500 }
    );
  }
}
