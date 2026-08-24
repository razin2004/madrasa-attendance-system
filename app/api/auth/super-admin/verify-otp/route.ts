import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashToken } from '@/lib/security';
import { createSession, setSessionCookie } from '@/lib/session';
import { recordAuditLog } from '@/services/audit.service';
import { checkRateLimit, recordRateLimitAttempt } from '@/lib/rate-limiter';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { userId, otp } = body;

    if (!userId || !otp) {
      return NextResponse.json(
        { success: false, error: 'User ID and verification code are required.' },
        { status: 400 }
      );
    }

    const cleanOtp = otp.toString().trim();
    if (cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      return NextResponse.json(
        { success: false, error: 'Verification code must be exactly 6 digits.' },
        { status: 400 }
      );
    }

    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const rateLimitKey = `verify-otp:${userId}`;

    // Rate limit: max 5 OTP verification attempts
    const rateCheck = checkRateLimit(rateLimitKey, {
      maxAttempts: 5,
      windowMs: 5 * 60 * 1000,
      lockoutMs: 15 * 60 * 1000,
    });

    if (rateCheck.isBlocked) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many failed verification attempts. Please wait ${rateCheck.retryAfterSeconds || 60} seconds.`,
        },
        { status: 429 }
      );
    }

    // Find User
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.role !== 'SUPER_ADMIN' || user.status !== 'ACTIVE') {
      return NextResponse.json(
        { success: false, error: 'Invalid user or account status.' },
        { status: 403 }
      );
    }

    // Find active non-consumed SecurityToken
    const token = await prisma.securityToken.findFirst({
      where: {
        userId: user.id,
        type: 'LOGIN_OTP',
        consumedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Verification code expired or not found. Please request a new code.' },
        { status: 400 }
      );
    }

    // Check expiration (5 min)
    if (new Date() > token.expiresAt) {
      await prisma.securityToken.delete({ where: { id: token.id } }).catch(() => {});
      return NextResponse.json(
        { success: false, error: 'Verification code has expired. Please request a new code.' },
        { status: 400 }
      );
    }

    // Check attempts limit
    if (token.attempts >= token.maxAttempts) {
      await prisma.securityToken.delete({ where: { id: token.id } }).catch(() => {});
      return NextResponse.json(
        { success: false, error: 'Maximum attempts exceeded for this code. Please request a new code.' },
        { status: 400 }
      );
    }

    // Verify Hash
    const hashedInput = hashToken(cleanOtp);
    if (hashedInput !== token.tokenHash) {
      // Increment attempt counter
      await prisma.securityToken.update({
        where: { id: token.id },
        data: { attempts: { increment: 1 } },
      });

      recordRateLimitAttempt(rateLimitKey, false);

      const remaining = token.maxAttempts - (token.attempts + 1);
      return NextResponse.json(
        {
          success: false,
          error: `Incorrect verification code. ${remaining > 0 ? `${remaining} attempts remaining.` : 'Code has been invalidated.'}`,
        },
        { status: 401 }
      );
    }

    // Valid OTP -> Mark token consumed
    await prisma.securityToken.update({
      where: { id: token.id },
      data: { consumedAt: new Date() },
    });

    // Create Authenticated Session
    const userAgent = request.headers.get('user-agent') || undefined;
    const { sessionToken, expiresAt } = await createSession(user.id, {
      ipAddress: ip,
      userAgent,
    });

    // Set HttpOnly session cookie
    setSessionCookie(sessionToken, expiresAt);

    // Update lastLoginAt
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Record Audit Log
    await recordAuditLog({
      actorUserId: user.id,
      action: 'LOGIN_SUCCESS',
      entityType: 'User',
      entityId: user.id,
      metadata: { role: 'SUPER_ADMIN', method: 'PASSWORD_PLUS_OTP' },
      ipAddress: ip,
      userAgent,
    });

    recordRateLimitAttempt(rateLimitKey, true);

    return NextResponse.json({
      success: true,
      redirectUrl: '/super-admin/dashboard',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error: any) {
    console.error('Verify OTP error:', error);
    return NextResponse.json(
      { success: false, error: 'Verification service error. Please try again.' },
      { status: 500 }
    );
  }
}
