import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import { recordAuditLog } from '@/services/audit.service';

export const dynamic = 'force-dynamic';

const IP_REGEX =
  /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

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

    const body = await request.json().catch(() => ({}));
    const { manualIp, reason } = body;

    const cleanIp = (manualIp as string)?.trim();
    const cleanReason = (reason as string)?.trim();

    if (!cleanIp || !IP_REGEX.test(cleanIp)) {
      return NextResponse.json(
        { success: false, error: 'A valid IPv4 or IPv6 address is required.' },
        { status: 400 }
      );
    }

    if (!cleanReason || cleanReason.length < 5) {
      return NextResponse.json(
        { success: false, error: 'A mandatory justification reason (at least 5 characters) is required for manual override.' },
        { status: 400 }
      );
    }

    const actorName = auth.session.user.name || auth.session.user.email;
    const oldIp = branch.publicIp;

    // Deactivate previous active network identities for this branch
    await prisma.branchNetworkIdentity.updateMany({
      where: { branchId: branch.id, isActive: true },
      data: { isActive: false },
    });

    // Update branch primary IP and add manual override record
    const updatedBranch = await prisma.branch.update({
      where: { id: branch.id },
      data: {
        publicIp: cleanIp,
        ipSource: 'MANUAL_OVERRIDE',
        ipCapturedAt: new Date(),
        ipCapturedBy: actorName,
        networkIdentities: {
          create: {
            publicIp: cleanIp,
            source: 'MANUAL_OVERRIDE',
            overrideReason: cleanReason,
            capturedBy: actorName,
            isActive: true,
          },
        },
      },
      include: {
        networkIdentities: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    // Record Audit Log
    const reqIp = request.headers.get('x-forwarded-for') || '127.0.0.1';
    await recordAuditLog({
      organizationId: auth.organization.id,
      actorUserId: auth.session.user.id,
      action: 'BRANCH_IP_MANUALLY_OVERRIDDEN',
      entityType: 'Branch',
      entityId: branch.id,
      metadata: {
        branchName: branch.name,
        oldPublicIp: oldIp,
        newPublicIp: cleanIp,
        reason: cleanReason,
        source: 'MANUAL_OVERRIDE',
      },
      ipAddress: reqIp,
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({
      success: true,
      message: `Manual network IP override applied: ${cleanIp}`,
      branch: updatedBranch,
    });
  } catch (error: any) {
    console.error('Manual IP override error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to apply manual IP override.' },
      { status: 500 }
    );
  }
}
