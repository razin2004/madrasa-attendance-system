import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizeEmail, verifyPassword, generateNumericOTP, hashToken } from '@/lib/security';
import { checkRateLimit, recordRateLimitAttempt } from '@/lib/rate-limiter';
import { sendEmail } from '@/services/email.service';
import { templateSuperAdminOTP } from '@/services/email-templates';

export const dynamic = 'force-dynamic';

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const maskedLocal =
    local.length > 2
      ? `${local[0]}${'*'.repeat(Math.min(local.length - 2, 5))}${local[local.length - 1]}`
      : `${local[0]}*`;
  return `${maskedLocal}@${domain}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    const normalizedEmail = normalizeEmail(email);
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const rateLimitKey = `super-admin-login:${ip}:${normalizedEmail}`;

    // Rate limit: max 5 login attempts per 15 minutes
    const rateCheck = checkRateLimit(rateLimitKey, {
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000,
      lockoutMs: 15 * 60 * 1000,
    });

    if (rateCheck.isBlocked) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many failed sign in attempts. Please try again in ${rateCheck.retryAfterSeconds || 60} seconds.`,
        },
        { status: 429 }
      );
    }

    // Find Super Admin user
    const user = await prisma.user.findFirst({
      where: {
        email: normalizedEmail,
        role: 'SUPER_ADMIN',
      },
    });

    if (!user) {
      recordRateLimitAttempt(rateLimitKey, false);
      return NextResponse.json(
        { success: false, error: 'Invalid administrator credentials.' },
        { status: 401 }
      );
    }

    if (user.status !== 'ACTIVE') {
      return NextResponse.json(
        { success: false, error: 'Super Admin account is currently inactive.' },
        { status: 403 }
      );
    }

    // Verify Password
    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      recordRateLimitAttempt(rateLimitKey, false);
      return NextResponse.json(
        { success: false, error: 'Invalid administrator credentials.' },
        { status: 401 }
      );
    }

    // Password is valid -> Generate 6-digit OTP
    const otpCode = generateNumericOTP();
    const tokenHash = hashToken(otpCode);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Invalidate any active OTPs for this user
    await prisma.securityToken.deleteMany({
      where: {
        userId: user.id,
        type: 'LOGIN_OTP',
      },
    });

    // Create fresh SecurityToken
    await prisma.securityToken.create({
      data: {
        userId: user.id,
        type: 'LOGIN_OTP',
        tokenHash,
        expiresAt,
        maxAttempts: 5,
      },
    });

    // Dispatch OTP via Email Service
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

    recordRateLimitAttempt(rateLimitKey, true);

    return NextResponse.json({
      success: true,
      requiresOtp: true,
      userId: user.id,
      emailMasked: maskEmail(user.email),
    });
  } catch (error: any) {
    console.error('Super Admin login error:', error);
    return NextResponse.json(
      { success: false, error: 'Authentication service encountered an error. Please try again.' },
      { status: 500 }
    );
  }
}
