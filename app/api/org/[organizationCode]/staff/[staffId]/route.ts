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
    const { name, phone, address } = body;

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
      if (typeof phone !== 'string' || phone.trim().length < 8) {
        return NextResponse.json(
          { success: false, error: 'Valid phone number is required.' },
          { status: 400 }
        );
      }
      const cleanPhone = phone.trim();
      if (cleanPhone !== existingStaff.phone) {
        // Check duplicate phone in organization
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
        changes.phone = { old: existingStaff.phone, new: cleanPhone };
        updateData.phone = cleanPhone;
      }
    }

    if (address !== undefined) {
      if (typeof address !== 'string' || address.trim().length < 3) {
        return NextResponse.json(
          { success: false, error: 'Address must be at least 3 characters.' },
          { status: 400 }
        );
      }
      if (address.trim() !== existingStaff.address) {
        changes.address = { old: existingStaff.address, new: address.trim() };
        updateData.address = address.trim();
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
    if (updateData.name || updateData.phone) {
      await prisma.user.update({
        where: { id: existingStaff.userId },
        data: {
          name: updateData.name || undefined,
          phone: updateData.phone || undefined,
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
