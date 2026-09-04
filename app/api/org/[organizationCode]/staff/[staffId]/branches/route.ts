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
        organizationId: auth.organization.id,
        OR: [{ id: params.staffId }, { staffId: params.staffId }],
      },
    });

    if (!staffProfile) {
      return NextResponse.json(
        { success: false, error: 'Staff member not found or access denied.' },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { branchIds = [] } = body;

    if (!Array.isArray(branchIds)) {
      return NextResponse.json(
        { success: false, error: 'Invalid branchIds format. Array of IDs expected.' },
        { status: 400 }
      );
    }

    // Verify all branch IDs belong to this organization
    if (branchIds.length > 0) {
      const validBranches = await prisma.branch.findMany({
        where: {
          id: { in: branchIds },
          organizationId: auth.organization.id,
        },
      });

      if (validBranches.length !== branchIds.length) {
        return NextResponse.json(
          { success: false, error: 'One or more selected branches do not belong to this organization.' },
          { status: 400 }
        );
      }
    }

    const actorName = auth.session.user.name || auth.session.user.email;

    // Atomically sync assignments
    await prisma.$transaction(
      async (tx) => {
        // Delete assignments not in the new list
        await tx.branchStaffAssignment.deleteMany({
          where: {
            staffProfileId: staffProfile.id,
            branchId: { notIn: branchIds },
          },
        });

        // Insert new ones if they don't already exist
        for (const bId of branchIds) {
          const exists = await tx.branchStaffAssignment.findUnique({
            where: {
              staffProfileId_branchId: {
                staffProfileId: staffProfile.id,
                branchId: bId,
              },
            },
          });

          if (!exists) {
            await tx.branchStaffAssignment.create({
              data: {
                staffProfileId: staffProfile.id,
                branchId: bId,
                assignedBy: actorName,
              },
            });
          }
        }
      },
      { maxWait: 15000, timeout: 30000 }
    );

    const updatedAssignments = await prisma.branchStaffAssignment.findMany({
      where: { staffProfileId: staffProfile.id },
      include: { branch: true },
    });

    // Record Audit Log
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    await recordAuditLog({
      organizationId: auth.organization.id,
      actorUserId: auth.session.user.id,
      action: 'BRANCHES_ASSIGNED',
      entityType: 'StaffProfile',
      entityId: staffProfile.id,
      metadata: {
        staffId: staffProfile.staffId,
        assignedBranchesCount: branchIds.length,
        branchIds,
      },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({
      success: true,
      message: 'Branch assignments updated successfully.',
      branchAssignments: updatedAssignments,
    });
  } catch (error: any) {
    console.error('Update branch assignments error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update branch assignments.' },
      { status: 500 }
    );
  }
}
