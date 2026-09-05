import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizeEmail, verifyPassword } from '@/lib/security';
import { checkRateLimit, recordRateLimitAttempt } from '@/lib/rate-limiter';
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
    const { email, password, staffId, pin } = body;

    const isStaffLogin = Boolean(staffId && pin);
    const isAdminLogin = Boolean(email && password);

    if (!isStaffLogin && !isAdminLogin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Please provide either Staff ID & PIN or Email & Password.',
        },
        { status: 400 }
      );
    }

    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const rateLimitIdentifier = isStaffLogin ? staffId.toUpperCase().trim() : normalizeEmail(email);
    const rateLimitKey = `org-login:${orgCode}:${rateLimitIdentifier}:${ip}`;

    // Rate Limiter: max 5 attempts per 15 minutes
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

    // 1. Resolve Target Organization
    const organization = await prisma.organization.findFirst({
      where: {
        organizationCode: { equals: orgCode, mode: 'insensitive' },
      },
    });

    if (!organization) {
      return NextResponse.json(
        { success: false, error: `Organization "${orgCode}" does not exist.` },
        { status: 404 }
      );
    }

    if (organization.status !== 'ACTIVE') {
      return NextResponse.json(
        {
          success: false,
          error:
            organization.status === 'PENDING'
              ? 'This organization registration is currently under review by Super Admin.'
              : organization.status === 'SUSPENDED'
              ? 'This organization account has been deactivated by Super Admin. Please contact support or your system administrator for assistance.'
              : `This organization is currently ${organization.status.toLowerCase()}.`,
        },
        { status: 403 }
      );
    }

    let user: any = null;
    let staffProfile: any = null;

    if (isStaffLogin) {
      // 2a. Staff Login: Find StaffProfile within this Organization
      const cleanStaffId = staffId.trim().toUpperCase();
      staffProfile = await prisma.staffProfile.findUnique({
        where: {
          organizationId_staffId: {
            organizationId: organization.id,
            staffId: cleanStaffId,
          },
        },
        include: {
          user: {
            include: { organization: true },
          },
          devices: true,
        },
      });

      if (!staffProfile || !staffProfile.user) {
        recordRateLimitAttempt(rateLimitKey, false);
        return NextResponse.json(
          {
            success: false,
            error: 'These credentials cannot be used for this organization.',
          },
          { status: 401 }
        );
      }

      user = staffProfile.user;

      // Verify PIN against user passwordHash
      const isPinValid = await verifyPassword(pin.trim(), user.passwordHash);
      if (!isPinValid) {
        recordRateLimitAttempt(rateLimitKey, false);
        return NextResponse.json(
          { success: false, error: 'These credentials cannot be used for this organization.' },
          { status: 401 }
        );
      }
    } else {
      // 2b. Admin Login: Find User by Email
      const normalizedEmail = normalizeEmail(email);
      user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        include: { organization: true },
      });

      if (!user || user.organizationId !== organization.id) {
        recordRateLimitAttempt(rateLimitKey, false);
        return NextResponse.json(
          {
            success: false,
            error: 'These credentials cannot be used for this organization.',
          },
          { status: 401 }
        );
      }

      // Verify Password Hash
      const isPasswordValid = await verifyPassword(password, user.passwordHash);
      if (!isPasswordValid) {
        recordRateLimitAttempt(rateLimitKey, false);
        return NextResponse.json(
          { success: false, error: 'These credentials cannot be used for this organization.' },
          { status: 401 }
        );
      }
    }

    if (user.status !== 'ACTIVE') {
      return NextResponse.json(
        { success: false, error: 'Your user account is inactive or suspended.' },
        { status: 403 }
      );
    }

    recordRateLimitAttempt(rateLimitKey, true);

    // Check if user MUST change temporary password
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

    // Create 30-Day Persistent Authenticated Session
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

    await recordAuditLog({
      organizationId: organization.id,
      actorUserId: user.id,
      action: 'LOGIN_SUCCESS',
      entityType: 'User',
      entityId: user.id,
      metadata: {
        role: user.role,
        tenantCode: orgCode,
        loginType: isStaffLogin ? 'STAFF_PIN' : 'EMAIL_PASSWORD',
      },
      ipAddress: ip,
      userAgent,
    }).catch(() => {});

    const isStaff = user.role === 'STAFF';
    const redirectUrl = isStaff ? `/${orgCode}/staff` : `/${orgCode}/admin`;

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
        organization: {
          id: organization.id,
          name: organization.name,
          organizationCode: organization.organizationCode,
        },
      },
    });
  } catch (error: any) {
    console.error('Tenant login API error:', error);
    return NextResponse.json(
      { success: false, error: 'Unable to sign in. Please try again.' },
      { status: 500 }
    );
  }
}
