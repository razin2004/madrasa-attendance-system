import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { normalizeEmail, hashToken, getAppBaseUrl } from '@/lib/security';
import { checkRateLimit, recordRateLimitAttempt } from '@/lib/rate-limiter';
import { sendEmail } from '@/services/email.service';
import { templatePasswordResetLink } from '@/services/email-templates';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email } = body;

    if (!email || typeof email !== 'string' || !email.trim().includes('@')) {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    const normalizedEmail = normalizeEmail(email);
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const rateLimitKey = `forgot-password:${normalizedEmail}:${ip}`;

    const rateCheck = checkRateLimit(rateLimitKey, {
      maxAttempts: 3,
      windowMs: 15 * 60 * 1000,
      lockoutMs: 15 * 60 * 1000,
    });

    if (rateCheck.isBlocked) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many password reset requests. Please try again in ${rateCheck.retryAfterSeconds || 60} seconds.`,
        },
        { status: 429 }
      );
    }

    recordRateLimitAttempt(rateLimitKey, true);

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // Generic success message to prevent account enumeration
    const genericSuccessMsg = 'If an active account exists for this email address, a password reset link has been dispatched.';

    if (!user || user.status !== 'ACTIVE') {
      return NextResponse.json({
        success: true,
        message: genericSuccessMsg,
      });
    }

    // Generate 32-byte secure reset token
    const rawResetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawResetToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 Hour

    await prisma.securityToken.create({
      data: {
        userId: user.id,
        organizationId: user.organizationId,
        type: 'PASSWORD_RESET',
        tokenHash,
        expiresAt,
      },
    });

    const origin = getAppBaseUrl(request);
    const resetUrl = `${origin}/reset-password?token=${rawResetToken}`;

    await sendEmail({
      recipient: user.email,
      type: 'PASSWORD_RESET',
      subject: 'ShiftGuard Password Reset Request',
      htmlContent: templatePasswordResetLink({
        userName: user.name,
        resetUrl,
        expiresInMinutes: 60,
      }).html,
      textContent: templatePasswordResetLink({
        userName: user.name,
        resetUrl,
        expiresInMinutes: 60,
      }).text,
      organizationId: user.organizationId,
    }).catch((emailErr) => console.error('Failed to send password reset email:', emailErr));

    return NextResponse.json({
      success: true,
      message: genericSuccessMsg,
    });
  } catch (error: any) {
    console.error('Forgot password API error:', error);
    return NextResponse.json(
      { success: false, error: 'Unable to process password reset request.' },
      { status: 500 }
    );
  }
}
