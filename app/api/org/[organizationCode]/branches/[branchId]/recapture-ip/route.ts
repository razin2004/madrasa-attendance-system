import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import { extractClientPublicIp } from '@/lib/ip-detection';
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

    const detectedPublicIp = extractClientPublicIp(request);
    const actorName = auth.session.user.name || auth.session.user.email;
    const oldIp = branch.publicIp;

    // Deactivate previous active network identities for this branch
    await prisma.branchNetworkIdentity.updateMany({
      where: { branchId: branch.id, isActive: true },
      data: { isActive: false },
    });

    // Update branch primary IP and add to Network Identities history
    const updatedBranch = await prisma.branch.update({
      where: { id: branch.id },
      data: {
        publicIp: detectedPublicIp,
        ipSource: 'CAPTURED',
        ipCapturedAt: new Date(),
        ipCapturedBy: actorName,
        networkIdentities: {
          create: {
            publicIp: detectedPublicIp,
            source: 'CAPTURED',
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
    await recordAuditLog({
      organizationId: auth.organization.id,
      actorUserId: auth.session.user.id,
      action: 'BRANCH_IP_RECAPTURED',
      entityType: 'Branch',
      entityId: branch.id,
      metadata: {
        branchName: branch.name,
        oldPublicIp: oldIp,
        newPublicIp: detectedPublicIp,
        source: 'CAPTURED',
      },
      ipAddress: detectedPublicIp,
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({
      success: true,
      message: `Branch network IP re-captured successfully: ${detectedPublicIp}`,
      branch: updatedBranch,
    });
  } catch (error: any) {
    console.error('Recapture IP error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to re-capture network IP.' },
      { status: 500 }
    );
  }
}
