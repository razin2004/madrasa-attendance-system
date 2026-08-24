import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, verifyPassword } from '@/lib/security';
import { createSession, setSessionCookie } from '@/lib/session';
import { recordAuditLog } from '@/services/audit.service';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { organizationCode: string } }
) {
  try {
    const orgCode = params.organizationCode?.toUpperCase().trim();
    const body = await request.json().catch(() => ({}));
    const { userId, currentPassword, newPassword } = body;

    if (!userId || !currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: 'User ID, current password, and new password are required.' },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { success: false, error: 'New password must be at least 8 characters long.' },
        { status: 400 }
      );
    }

    // 1. Resolve Organization
    const organization = await prisma.organization.findFirst({
      where: {
        organizationCode: { equals: orgCode, mode: 'insensitive' },
      },
    });

    if (!organization) {
      return NextResponse.json(
        { success: false, error: 'Organization not found.' },
        { status: 404 }
      );
    }

    // 2. Fetch User
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.organizationId !== organization.id) {
      return NextResponse.json(
        { success: false, error: 'User not authorized for this organization.' },
        { status: 403 }
      );
    }

    // 3. Verify Current Temporary Password
    const isCurrentValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      return NextResponse.json(
        { success: false, error: 'Current temporary password is incorrect.' },
        { status: 400 }
      );
    }

    // 4. Update Password & Unset mustChangePassword
    const newHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
        lastLoginAt: new Date(),
      },
    });

    // 5. Create Session & Cookie
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || undefined;

    const { sessionToken, expiresAt } = await createSession(user.id, {
      ipAddress: ip,
      userAgent,
    });

    setSessionCookie(sessionToken, expiresAt);

    // 6. Record Audit Log
    await recordAuditLog({
      organizationId: organization.id,
      actorUserId: user.id,
      action: 'PASSWORD_CHANGED',
      entityType: 'User',
      entityId: user.id,
      metadata: { initialReset: true },
      ipAddress: ip,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully.',
      redirectUrl: `/${orgCode}/admin`,
    });
  } catch (error: any) {
    console.error('Change password API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update password. Please try again.' },
      { status: 500 }
    );
  }
}
