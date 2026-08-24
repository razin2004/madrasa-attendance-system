import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashToken, hashPassword } from '@/lib/security';
import { recordAuditLog } from '@/services/audit.service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token || !token.trim()) {
      return NextResponse.json(
        { success: false, error: 'Password reset token is missing.' },
        { status: 400 }
      );
    }

    const tokenHash = hashToken(token.trim());
    const securityToken = await prisma.securityToken.findUnique({
      where: { tokenHash },
      include: {
        user: true,
      },
    });

    if (
      !securityToken ||
      securityToken.type !== 'PASSWORD_RESET' ||
      securityToken.consumedAt !== null ||
      securityToken.expiresAt < new Date() ||
      !securityToken.user
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'This password reset link is invalid or has expired. Please request a new password reset.',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        name: securityToken.user.name,
        email: securityToken.user.email,
      },
    });
  } catch (error: any) {
    console.error('Validate reset token error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to validate password reset token.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { token, password } = body;

    if (!token || typeof token !== 'string' || !token.trim()) {
      return NextResponse.json(
        { success: false, error: 'Password reset token is required.' },
        { status: 400 }
      );
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { success: false, error: 'New password must be at least 8 characters long.' },
        { status: 400 }
      );
    }

    const tokenHash = hashToken(token.trim());
    const securityToken = await prisma.securityToken.findUnique({
      where: { tokenHash },
      include: {
        user: true,
      },
    });

    if (
      !securityToken ||
      securityToken.type !== 'PASSWORD_RESET' ||
      securityToken.consumedAt !== null ||
      securityToken.expiresAt < new Date() ||
      !securityToken.user
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'This password reset link is invalid or has expired. Please request a new password reset.',
        },
        { status: 400 }
      );
    }

    const user = securityToken.user;
    const passwordHash = await hashPassword(password);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          mustChangePassword: false,
        },
      }),
      prisma.securityToken.update({
        where: { id: securityToken.id },
        data: { consumedAt: new Date() },
      }),
    ]);

    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    if (user.organizationId) {
      await recordAuditLog({
        organizationId: user.organizationId,
        actorUserId: user.id,
        action: 'PASSWORD_RESET_COMPLETED',
        entityType: 'User',
        entityId: user.id,
        metadata: {
          email: user.email,
        },
        ipAddress: ip,
        userAgent: request.headers.get('user-agent'),
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully! You can now sign in with your new password.',
      loginUrl: '/login',
    });
  } catch (error: any) {
    console.error('Reset password API error:', error);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred during password reset.' },
      { status: 500 }
    );
  }
}
