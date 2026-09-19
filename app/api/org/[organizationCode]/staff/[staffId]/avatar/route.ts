import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOrgAdmin, requireStaff } from '@/lib/tenant-auth';
import { recordAuditLog } from '@/services/audit.service';

export const dynamic = 'force-dynamic';

async function authenticateUserOrAdmin(organizationCode: string) {
  const adminAuth = await requireOrgAdmin(organizationCode);
  if (adminAuth.authorized) {
    return { authorized: true, organization: adminAuth.organization!, session: adminAuth.session!, isAdmin: true, staffProfile: null };
  }

  const staffAuth = await requireStaff(organizationCode);
  if (staffAuth.authorized) {
    return { authorized: true, organization: staffAuth.organization!, session: staffAuth.session!, isAdmin: false, staffProfile: staffAuth.staffProfile };
  }

  return { authorized: false, errorMessage: adminAuth.errorMessage || staffAuth.errorMessage, errorStatus: adminAuth.errorStatus || staffAuth.errorStatus || 401 };
}

export async function POST(
  request: Request,
  { params }: { params: { organizationCode: string; staffId: string } }
) {
  try {
    const auth = await authenticateUserOrAdmin(params.organizationCode);
    if (!auth.authorized || !auth.organization) {
      return NextResponse.json(
        { success: false, error: auth.errorMessage },
        { status: auth.errorStatus || 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { avatarUrl } = body;

    const targetStaff = await prisma.staffProfile.findFirst({
      where: {
        organizationId: auth.organization.id,
        OR: [
          { id: params.staffId },
          { staffId: params.staffId },
        ],
      },
    });

    if (!targetStaff) {
      return NextResponse.json(
        { success: false, error: 'Staff member not found.' },
        { status: 404 }
      );
    }

    const isSelf = auth.staffProfile && auth.staffProfile.id === targetStaff.id;
    if (!isSelf && !auth.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized to update this profile avatar.' },
        { status: 403 }
      );
    }

    const updatedProfile = await prisma.staffProfile.update({
      where: { id: targetStaff.id },
      data: { avatarUrl: avatarUrl || null },
    });

    await recordAuditLog({
      organizationId: auth.organization.id,
      actorUserId: auth.session?.user?.id || targetStaff.userId,
      action: 'STAFF_AVATAR_UPDATED',
      entityType: 'StaffProfile',
      entityId: targetStaff.id,
      metadata: {
        staffId: targetStaff.staffId,
        hasAvatar: Boolean(avatarUrl),
      },
      ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({
      success: true,
      message: 'Profile picture updated successfully!',
      avatarUrl: updatedProfile.avatarUrl,
      staffProfile: updatedProfile,
    });
  } catch (error: any) {
    console.error('Update avatar error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update profile picture.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { organizationCode: string; staffId: string } }
) {
  try {
    const auth = await authenticateUserOrAdmin(params.organizationCode);
    if (!auth.authorized || !auth.organization) {
      return NextResponse.json(
        { success: false, error: auth.errorMessage },
        { status: auth.errorStatus || 401 }
      );
    }

    const targetStaff = await prisma.staffProfile.findFirst({
      where: {
        organizationId: auth.organization.id,
        OR: [
          { id: params.staffId },
          { staffId: params.staffId },
        ],
      },
    });

    if (!targetStaff) {
      return NextResponse.json(
        { success: false, error: 'Staff member not found.' },
        { status: 404 }
      );
    }

    const isSelf = auth.staffProfile && auth.staffProfile.id === targetStaff.id;
    if (!isSelf && !auth.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized to remove this profile avatar.' },
        { status: 403 }
      );
    }

    const updatedProfile = await prisma.staffProfile.update({
      where: { id: targetStaff.id },
      data: { avatarUrl: null },
    });

    return NextResponse.json({
      success: true,
      message: 'Profile picture removed successfully.',
      avatarUrl: null,
      staffProfile: updatedProfile,
    });
  } catch (error: any) {
    console.error('Delete avatar error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to remove profile picture.' },
      { status: 500 }
    );
  }
}
