import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import { recordAuditLog } from '@/services/audit.service';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { organizationCode: string; staffId: string } }
) {
  try {
    const auth = await requireOrgAdmin(params.organizationCode);
    if (!auth.authorized || !auth.organization) {
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
      include: {
        user: {
          select: {
            id: true,
            email: true,
            status: true,
            role: true,
            lastLoginAt: true,
            createdAt: true,
          },
        },
        branchAssignments: {
          include: {
            branch: true,
          },
        },
        devices: true,
      },
    });

    if (!staffProfile) {
      return NextResponse.json(
        { success: false, error: 'Staff member not found or access denied.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      staff: staffProfile,
    });
  } catch (error: any) {
    console.error('Fetch staff profile error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve staff details.' },
      { status: 500 }
    );
  }
}

export async function PATCH(
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

    const existingStaff = await prisma.staffProfile.findFirst({
      where: {
        organizationId: auth.organization.id,
        OR: [{ id: params.staffId }, { staffId: params.staffId }],
      },
    });

    if (!existingStaff) {
      return NextResponse.json(
        { success: false, error: 'Staff member not found or access denied.' },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { name, phone, address, idDocType, idDocLast4 } = body;

    const updateData: any = {};
    const changes: Record<string, { old: any; new: any }> = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2) {
        return NextResponse.json(
          { success: false, error: 'Name must be at least 2 characters.' },
          { status: 400 }
        );
      }
      if (name.trim() !== existingStaff.name) {
        changes.name = { old: existingStaff.name, new: name.trim() };
        updateData.name = name.trim();
      }
    }

    if (phone !== undefined) {
      const cleanPhone = typeof phone === 'string' && phone.trim() ? phone.trim() : null;
      if (cleanPhone && cleanPhone.length < 8) {
        return NextResponse.json(
          { success: false, error: 'Valid phone number is required.' },
          { status: 400 }
        );
      }
      if (cleanPhone !== existingStaff.phone) {
        if (cleanPhone) {
          const dupPhone = await prisma.staffProfile.findFirst({
            where: {
              organizationId: auth.organization.id,
              phone: cleanPhone,
              id: { not: existingStaff.id },
            },
          });
          if (dupPhone) {
            return NextResponse.json(
              { success: false, error: `Phone number ${cleanPhone} is already assigned to another staff member.` },
              { status: 409 }
            );
          }
        }
        changes.phone = { old: existingStaff.phone, new: cleanPhone };
        updateData.phone = cleanPhone;
      }
    }

    if (address !== undefined) {
      const cleanAddress = typeof address === 'string' ? address.trim() : '';
      if (cleanAddress !== existingStaff.address) {
        changes.address = { old: existingStaff.address, new: cleanAddress };
        updateData.address = cleanAddress;
      }
    }

    if (idDocType !== undefined && typeof idDocType === 'string') {
      const validTypes = ['AADHAAR', 'VOTER_ID', 'PASSPORT', 'DRIVING_LICENSE', 'OTHER'];
      if (validTypes.includes(idDocType)) {
        if (idDocType !== existingStaff.idDocType) {
          changes.idDocType = { old: existingStaff.idDocType, new: idDocType };
          updateData.idDocType = idDocType;
        }
      }
    }

    if (idDocLast4 !== undefined) {
      const cleanLast4 = typeof idDocLast4 === 'string' ? idDocLast4.trim().slice(0, 4) : null;
      if (cleanLast4 !== existingStaff.idDocLast4) {
        changes.idDocLast4 = { old: existingStaff.idDocLast4, new: cleanLast4 };
        updateData.idDocLast4 = cleanLast4;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No changes detected.',
        staff: existingStaff,
      });
    }

    const updatedProfile = await prisma.staffProfile.update({
      where: { id: existingStaff.id },
      data: updateData,
      include: {
        user: true,
        branchAssignments: { include: { branch: true } },
        devices: true,
      },
    });

    // Also update name/phone on User record if changed
    if (updateData.name || updateData.phone !== undefined) {
      await prisma.user.update({
        where: { id: existingStaff.userId },
        data: {
          name: updateData.name || undefined,
          phone: updateData.phone !== undefined ? updateData.phone : undefined,
        },
      });
    }

    // Record Audit Log
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    await recordAuditLog({
      organizationId: auth.organization.id,
      actorUserId: auth.session.user.id,
      action: 'STAFF_UPDATED',
      entityType: 'StaffProfile',
      entityId: updatedProfile.id,
      metadata: {
        staffId: updatedProfile.staffId,
        changes,
      },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({
      success: true,
      message: 'Staff profile updated successfully.',
      staff: updatedProfile,
    });
  } catch (error: any) {
    console.error('Update staff error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update staff profile.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    const existingStaff = await prisma.staffProfile.findFirst({
      where: {
        organizationId: auth.organization.id,
        OR: [{ id: params.staffId }, { staffId: params.staffId }],
      },
    });

    if (!existingStaff) {
      return NextResponse.json(
        { success: false, error: 'Staff member not found or access denied.' },
        { status: 404 }
      );
    }

    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';

    // Record audit log before deleting
    await recordAuditLog({
      organizationId: auth.organization.id,
      actorUserId: auth.session.user.id,
      action: 'STAFF_DELETED',
      entityType: 'StaffProfile',
      entityId: existingStaff.id,
      metadata: {
        staffId: existingStaff.staffId,
        name: existingStaff.name,
        email: existingStaff.userId,
      },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent'),
    });

    // Deleting User automatically cascades and deletes StaffProfile, devices, assignments, attendance, leaves, etc.
    await prisma.user.delete({
      where: { id: existingStaff.userId },
    });

    return NextResponse.json({
      success: true,
      message: `Staff account ${existingStaff.name} (${existingStaff.staffId}) deleted successfully.`,
    });
  } catch (error: any) {
    console.error('Delete staff error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete staff account.' },
      { status: 500 }
    );
  }
}

