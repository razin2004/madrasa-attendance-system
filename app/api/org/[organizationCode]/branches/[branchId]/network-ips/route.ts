import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import { recordAuditLog } from '@/services/audit.service';
import { isValidPublicIp } from '@/lib/ip-detection';

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

    const body = await request.json().catch(() => ({}));
    const { publicIp, overrideReason } = body;

    if (!publicIp || typeof publicIp !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid public IP address.' },
        { status: 400 }
      );
    }

    const cleanIp = publicIp.trim();

    // Validate public IP format & reject private / localhost ranges
    if (!isValidPublicIp(cleanIp)) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Invalid public IP address. Private LAN ranges (10.x, 192.168.x, 172.16-31.x) and localhost (127.0.0.1) cannot be registered as branch public IPs.',
        },
        { status: 400 }
      );
    }

    const branch = await prisma.branch.findFirst({
      where: {
        id: params.branchId,
        organizationId: auth.organization.id,
      },
      include: {
        networkIdentities: {
          where: { isActive: true },
        },
      },
    });

    if (!branch) {
      return NextResponse.json(
        { success: false, error: 'Branch not found.' },
        { status: 404 }
      );
    }

    // Check maximum 5 authorized public IPs requirement
    const secondaryIps = branch.networkIdentities.filter((n) => n.publicIp !== branch.publicIp);
    const existingCount = (branch.publicIp ? 1 : 0) + secondaryIps.length;
    if (existingCount >= 5) {
      return NextResponse.json(
        {
          success: false,
          error: 'Maximum limit of 5 authorized public IP addresses reached for this branch.',
        },
        { status: 400 }
      );
    }

    // Check duplicate IP
    if (
      branch.publicIp === cleanIp ||
      branch.networkIdentities.some((n) => n.publicIp === cleanIp)
    ) {
      return NextResponse.json(
        { success: false, error: `Public IP "${cleanIp}" is already registered for this branch.` },
        { status: 409 }
      );
    }

    // If branch primary publicIp is empty, set primary publicIp; otherwise add to networkIdentities
    if (!branch.publicIp) {
      await prisma.branch.update({
        where: { id: branch.id },
        data: { publicIp: cleanIp },
      });
    } else {
      await prisma.branchNetworkIdentity.create({
        data: {
          branchId: branch.id,
          publicIp: cleanIp,
          isActive: true,
          source: 'MANUAL_ADD',
          overrideReason: overrideReason?.trim() || 'Added by Admin',
          capturedBy: auth.session.user.name || auth.session.user.email,
        },
      });
    }

    const updatedBranch = await prisma.branch.findUnique({
      where: { id: branch.id },
      include: {
        networkIdentities: { where: { isActive: true } },
      },
    });

    const reqIp = request.headers.get('x-forwarded-for') || '127.0.0.1';
    await recordAuditLog({
      organizationId: auth.organization.id,
      actorUserId: auth.session.user.id,
      action: 'BRANCH_NETWORK_IP_OVERRIDDEN',
      entityType: 'Branch',
      entityId: branch.id,
      metadata: {
        branchName: branch.name,
        addedIp: cleanIp,
      },
      ipAddress: reqIp,
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({
      success: true,
      message: `Public IP address "${cleanIp}" registered successfully.`,
      branch: updatedBranch,
    });
  } catch (error: any) {
    console.error('Add branch public IP error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add public IP address.' },
      { status: 500 }
    );
  }
}

export async function PATCH(
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

    const body = await request.json().catch(() => ({}));
    const { primaryIp, overrideReason } = body;

    if (!primaryIp || typeof primaryIp !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Valid primary IP address is required.' },
        { status: 400 }
      );
    }

    const cleanIp = primaryIp.trim();
    if (!isValidPublicIp(cleanIp)) {
      return NextResponse.json(
        { success: false, error: 'Invalid public IP address format.' },
        { status: 400 }
      );
    }

    const branch = await prisma.branch.findFirst({
      where: {
        id: params.branchId,
        organizationId: auth.organization.id,
      },
      include: {
        networkIdentities: true,
      },
    });

    if (!branch) {
      return NextResponse.json(
        { success: false, error: 'Branch not found.' },
        { status: 404 }
      );
    }

    const oldPrimary = branch.publicIp;

    // 1. If oldPrimary exists and is different, move oldPrimary to networkIdentities
    if (oldPrimary && oldPrimary !== cleanIp) {
      const existsOld = branch.networkIdentities.some((n) => n.publicIp === oldPrimary);
      if (!existsOld) {
        await prisma.branchNetworkIdentity.create({
          data: {
            branchId: branch.id,
            publicIp: oldPrimary,
            isActive: true,
            source: 'PREVIOUS_PRIMARY',
            overrideReason: 'Demoted from primary IP',
            capturedBy: auth.session.user.name || auth.session.user.email,
          },
        });
      }
    }

    // 2. Remove cleanIp from networkIdentities if present to avoid duplication
    await prisma.branchNetworkIdentity.deleteMany({
      where: {
        branchId: branch.id,
        publicIp: cleanIp,
      },
    });

    // 3. Update primary publicIp on Branch
    await prisma.branch.update({
      where: { id: branch.id },
      data: {
        publicIp: cleanIp,
        ipSource: 'MANUAL_OVERRIDE',
        ipCapturedAt: new Date(),
        ipCapturedBy: auth.session.user.name || auth.session.user.email,
      },
    });

    const updatedBranch = await prisma.branch.findUnique({
      where: { id: branch.id },
      include: {
        networkIdentities: { where: { isActive: true } },
      },
    });

    const reqIp = request.headers.get('x-forwarded-for') || '127.0.0.1';
    await recordAuditLog({
      organizationId: auth.organization.id,
      actorUserId: auth.session.user.id,
      action: 'BRANCH_NETWORK_IP_OVERRIDDEN',
      entityType: 'Branch',
      entityId: branch.id,
      metadata: {
        branchName: branch.name,
        oldPrimary,
        newPrimary: cleanIp,
        reason: overrideReason || 'Primary IP Updated',
      },
      ipAddress: reqIp,
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({
      success: true,
      message: `Primary IP updated to "${cleanIp}".`,
      branch: updatedBranch,
    });
  } catch (error: any) {
    console.error('Update primary branch IP error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update primary IP address.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    const { searchParams } = new URL(request.url);
    const ipToRemove = searchParams.get('ip');

    if (!ipToRemove) {
      return NextResponse.json(
        { success: false, error: 'IP address to remove is required.' },
        { status: 400 }
      );
    }

    const cleanIp = ipToRemove.trim();
    const branch = await prisma.branch.findFirst({
      where: {
        id: params.branchId,
        organizationId: auth.organization.id,
      },
    });

    if (!branch) {
      return NextResponse.json(
        { success: false, error: 'Branch not found.' },
        { status: 404 }
      );
    }

    if (branch.publicIp === cleanIp) {
      await prisma.branch.update({
        where: { id: branch.id },
        data: { publicIp: null },
      });
    }

    await prisma.branchNetworkIdentity.deleteMany({
      where: {
        branchId: branch.id,
        publicIp: cleanIp,
      },
    });

    const updatedBranch = await prisma.branch.findUnique({
      where: { id: branch.id },
      include: {
        networkIdentities: { where: { isActive: true } },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Authorized IP "${cleanIp}" removed successfully.`,
      branch: updatedBranch,
    });
  } catch (error: any) {
    console.error('Delete branch public IP error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to remove public IP address.' },
      { status: 500 }
    );
  }
}
