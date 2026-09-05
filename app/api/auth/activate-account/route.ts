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
        { success: false, error: 'Activation token is missing.' },
        { status: 400 }
      );
    }

    const tokenHash = hashToken(token.trim());
    const securityToken = await prisma.securityToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: { organization: true },
        },
      },
    });

    if (
      !securityToken ||
      securityToken.type !== 'INVITATION' ||
      securityToken.consumedAt !== null ||
      securityToken.expiresAt < new Date() ||
      !securityToken.user
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'This account activation link is invalid or has expired. Please ask your administrator to resend your invitation.',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        name: securityToken.user.name,
        email: securityToken.user.email,
        orgName: securityToken.user.organization?.name || 'ShiftGuard Workspace',
        role: securityToken.user.role,
      },
    });
  } catch (error: any) {
    console.error('Validate activation token error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to validate activation token.' },
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
        { success: false, error: 'Activation token is required.' },
        { status: 400 }
      );
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters long.' },
        { status: 400 }
      );
    }

    const tokenHash = hashToken(token.trim());
    const securityToken = await prisma.securityToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: { organization: true },
        },
      },
    });

    if (
      !securityToken ||
      securityToken.type !== 'INVITATION' ||
      securityToken.consumedAt !== null ||
      securityToken.expiresAt < new Date() ||
      !securityToken.user
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'This account activation link is invalid or has expired. Please contact your administrator.',
        },
        { status: 400 }
      );
    }

    const user = securityToken.user;
    const passwordHash = await hashPassword(password);

    // Transactionally update password hash, activate user account, and consume token
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          status: 'ACTIVE',
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
        action: 'STAFF_ACCOUNT_ACTIVATED',
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
      message: 'Account activated successfully! You can now sign in with your email and password.',
      loginUrl: '/login',
    });
  } catch (error: any) {
    console.error('Activate staff account error:', error);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred during account activation.' },
      { status: 500 }
    );
  }
}
