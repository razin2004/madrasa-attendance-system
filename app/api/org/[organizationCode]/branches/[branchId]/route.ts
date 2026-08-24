import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import { recordAuditLog } from '@/services/audit.service';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { organizationCode: string; branchId: string } }
) {
  try {
    const auth = await requireOrgAdmin(params.organizationCode);
    if (!auth.authorized || !auth.organization) {
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
      include: {
        networkIdentities: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!branch) {
      return NextResponse.json(
        { success: false, error: 'Branch not found or access denied.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      branch,
    });
  } catch (error: any) {
    console.error('Fetch branch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve branch details.' },
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

    // 1. Fetch Existing Branch
    const existingBranch = await prisma.branch.findFirst({
      where: {
        id: params.branchId,
        organizationId: auth.organization.id,
      },
    });

    if (!existingBranch) {
      return NextResponse.json(
        { success: false, error: 'Branch not found or access denied.' },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { name, address, geofenceRadiusMeters } = body;

    const updateData: any = {};
    const changes: Record<string, { old: any; new: any }> = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2) {
        return NextResponse.json(
          { success: false, error: 'Branch name must be at least 2 characters.' },
          { status: 400 }
        );
      }
      if (name.trim() !== existingBranch.name) {
        changes.name = { old: existingBranch.name, new: name.trim() };
        updateData.name = name.trim();
      }
    }

    if (address !== undefined) {
      if (typeof address !== 'string' || address.trim().length < 3) {
        return NextResponse.json(
          { success: false, error: 'Address must be at least 3 characters.' },
          { status: 400 }
        );
      }
      if (address.trim() !== existingBranch.address) {
        changes.address = { old: existingBranch.address, new: address.trim() };
        updateData.address = address.trim();
      }
    }

    if (geofenceRadiusMeters !== undefined) {
      const radius = parseInt(geofenceRadiusMeters, 10);
      if (isNaN(radius) || radius < 20 || radius > 5000) {
        return NextResponse.json(
          { success: false, error: 'Geofence radius must be between 20 and 5000 meters.' },
          { status: 400 }
        );
      }
      if (radius !== existingBranch.geofenceRadiusMeters) {
        changes.geofenceRadiusMeters = {
          old: existingBranch.geofenceRadiusMeters,
          new: radius,
        };
        updateData.geofenceRadiusMeters = radius;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No changes detected.',
        branch: existingBranch,
      });
    }

    const updatedBranch = await prisma.branch.update({
      where: { id: existingBranch.id },
      data: updateData,
    });

    // Record Audit Log
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    await recordAuditLog({
      organizationId: auth.organization.id,
      actorUserId: auth.session.user.id,
      action: changes.geofenceRadiusMeters ? 'GEOFENCE_RADIUS_CHANGED' : 'BRANCH_UPDATED',
      entityType: 'Branch',
      entityId: updatedBranch.id,
      metadata: {
        branchName: updatedBranch.name,
        changes,
      },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({
      success: true,
      message: 'Branch updated successfully.',
      branch: updatedBranch,
    });
  } catch (error: any) {
    console.error('Update branch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update branch.' },
      { status: 500 }
    );
  }
}
