import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizeEmail, verifyPassword } from '@/lib/security';
import { checkRateLimit, recordRateLimitAttempt } from '@/lib/rate-limiter';
import { createSession, setSessionCookie } from '@/lib/session';
import { recordAuditLog } from '@/services/audit.service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email, password, requestedOrgCode } = body;

    // 1. Validation: Require Email and Password
    if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Please enter your account email address and password.',
        },
        { status: 400 }
      );
    }

    const normalizedEmail = normalizeEmail(email);
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const rateLimitKey = `common-login:${requestedOrgCode || 'global'}:${normalizedEmail}:${ip}`;

    // 2. Rate Limiter: max 5 attempts per 15 minutes
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

    // 3. Query User Record from Database
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        organization: true,
        staffProfile: true,
      },
    });

    if (!user) {
      recordRateLimitAttempt(rateLimitKey, false);
      return NextResponse.json(
        { success: false, error: 'Invalid email address or password.' },
        { status: 401 }
      );
    }

    // 4. Verify Password Hash
    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      recordRateLimitAttempt(rateLimitKey, false);
      return NextResponse.json(
        { success: false, error: 'Invalid email address or password.' },
        { status: 401 }
      );
    }

    const organization = user.organization;
    const staffProfile = user.staffProfile;

    // 5. Organization Scoping & Mismatch Protection
    if (requestedOrgCode && typeof requestedOrgCode === 'string' && requestedOrgCode.trim()) {
      const targetCode = requestedOrgCode.trim().toUpperCase();
      if (!organization || !organization.organizationCode || organization.organizationCode.toUpperCase() !== targetCode) {
        recordRateLimitAttempt(rateLimitKey, false);
        return NextResponse.json(
          {
            success: false,
            error: 'These credentials cannot be used for this organization.',
          },
          { status: 401 }
        );
      }
    }

    // 6. Validate User Account & Organization Status
    if (user.status !== 'ACTIVE') {
      return NextResponse.json(
        {
          success: false,
          error:
            user.status === 'PENDING'
              ? 'Your account is pending activation. Please check your email to set your password.'
              : 'Your user account is inactive or suspended.',
        },
        { status: 403 }
      );
    }

    if (organization && organization.status !== 'ACTIVE') {
      return NextResponse.json(
        {
          success: false,
          error:
            organization.status === 'PENDING'
              ? 'This organization registration is currently under review by Super Admin.'
              : `This organization is currently ${organization.status.toLowerCase()}.`,
        },
        { status: 403 }
      );
    }

    recordRateLimitAttempt(rateLimitKey, true);

    // 7. Check Mandatory Password Change Flag
    if (user.mustChangePassword) {
      return NextResponse.json({
        success: true,
        mustChangePassword: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });
    }

    // 8. Create 30-Day Authenticated Session
    const userAgent = request.headers.get('user-agent') || undefined;
    const { sessionToken, expiresAt } = await createSession(user.id, {
      ipAddress: ip,
      userAgent,
    });

    setSessionCookie(sessionToken, expiresAt);

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    if (organization) {
      await recordAuditLog({
        organizationId: organization.id,
        actorUserId: user.id,
        action: 'LOGIN_SUCCESS',
        entityType: 'User',
        entityId: user.id,
        metadata: {
          role: user.role,
          tenantCode: organization.organizationCode,
          loginType: 'EMAIL_PASSWORD',
        },
        ipAddress: ip,
        userAgent,
      }).catch(() => {});
    }

    // 9. Automatic Server-Side Role-Based Redirect Resolution
    let redirectUrl = '/';
    if (user.role === 'SUPER_ADMIN') {
      redirectUrl = '/super-admin/dashboard';
    } else if (organization) {
      const orgCode = organization.organizationCode;
      redirectUrl = user.role === 'STAFF' ? `/${orgCode}/staff` : `/${orgCode}/admin`;
    }

    return NextResponse.json({
      success: true,
      mustChangePassword: false,
      redirectUrl,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        staffId: staffProfile?.staffId || null,
        organization: organization
          ? {
              id: organization.id,
              name: organization.name,
              organizationCode: organization.organizationCode,
            }
          : null,
      },
    });
  } catch (error: any) {
    console.error('Common login API error:', error);
    return NextResponse.json(
      { success: false, error: 'Unable to sign in. Please try again.' },
      { status: 500 }
    );
  }
}
