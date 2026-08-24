import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateNumericOTP, hashToken } from '@/lib/security';
import { sendEmail } from '@/services/email.service';
import { templateSuperAdminOTP } from '@/services/email-templates';
import { checkRateLimit, recordRateLimitAttempt } from '@/lib/rate-limiter';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required.' },
        { status: 400 }
      );
    }

    const rateKey = `resend-otp:${userId}`;
    const rateCheck = checkRateLimit(rateKey, {
      maxAttempts: 3,
      windowMs: 5 * 60 * 1000,
      lockoutMs: 60 * 1000, // 60s cooldown
    });

    if (rateCheck.isBlocked) {
      return NextResponse.json(
        {
          success: false,
          error: `Please wait ${rateCheck.retryAfterSeconds || 60} seconds before requesting another code.`,
        },
        { status: 429 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.role !== 'SUPER_ADMIN' || user.status !== 'ACTIVE') {
      return NextResponse.json(
        { success: false, error: 'User not found or inactive.' },
        { status: 403 }
      );
    }

    // Invalidate existing tokens
    await prisma.securityToken.deleteMany({
      where: {
        userId: user.id,
        type: 'LOGIN_OTP',
      },
    });

    // Generate fresh OTP
    const otpCode = generateNumericOTP();
    const tokenHash = hashToken(otpCode);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await prisma.securityToken.create({
      data: {
        userId: user.id,
        type: 'LOGIN_OTP',
        tokenHash,
        expiresAt,
        maxAttempts: 5,
      },
    });

    // Dispatch email
    const emailTemplate = templateSuperAdminOTP({
      otpCode,
      expiresInMinutes: 5,
      adminName: user.name,
    });

    await sendEmail({
      recipient: user.email,
      type: 'SUPER_ADMIN_OTP',
      subject: emailTemplate.subject,
      htmlContent: emailTemplate.html,
      textContent: emailTemplate.text,
    });

    recordRateLimitAttempt(rateKey, false, { lockoutMs: 60 * 1000, maxAttempts: 1 });

    return NextResponse.json({
      success: true,
      message: 'A new 6-digit verification code has been dispatched to your email.',
    });
  } catch (error: any) {
    console.error('Resend OTP error:', error);
    return NextResponse.json(
      { success: false, error: 'Unable to resend verification code.' },
      { status: 500 }
    );
  }
}
