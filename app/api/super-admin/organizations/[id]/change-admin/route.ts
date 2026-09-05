import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { getCurrentSession } from '@/lib/session';
import { recordAuditLog } from '@/services/audit.service';
import { hashToken, getAppBaseUrl } from '@/lib/security';
import { sendEmail } from '@/services/email.service';
import { templateOrgAdminPasswordSetup } from '@/services/email-templates';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const orgId = params.id;

    // 1. Authorize Super Admin
    const session = await getCurrentSession();
    if (!session || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Super Admin access required.' },
        { status: 401 }
      );
    }

    // 2. Parse Payload
    const body = await request.json();
    const { contactPersonName, contactEmail, phone, sendInvitation } = body;

    if (!contactPersonName || !contactPersonName.trim()) {
      return NextResponse.json(
        { success: false, error: 'Contact person name is required.' },
        { status: 400 }
      );
    }

    if (!contactEmail || !contactEmail.trim() || !contactEmail.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'A valid contact email address is required.' },
        { status: 400 }
      );
    }

    const normalizedEmail = contactEmail.trim().toLowerCase();
    const trimmedName = contactPersonName.trim();
    const trimmedPhone = phone ? phone.trim() : null;

    // 3. Fetch Organization
    const existingOrg = await prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!existingOrg) {
      return NextResponse.json(
        { success: false, error: 'Organization not found.' },
        { status: 404 }
      );
    }

    const previousAdminName = existingOrg.contactPersonName;
    const previousAdminEmail = existingOrg.contactEmail;

    // 4. Perform Transaction to update Org & Org Admin User
    let rawToken: string | null = null;

    const result = await prisma.$transaction(async (tx) => {
      // Update Organization contact details
      const updatedOrg = await tx.organization.update({
        where: { id: orgId },
        data: {
          contactPersonName: trimmedName,
          contactEmail: normalizedEmail,
          phone: trimmedPhone,
        },
        include: {
          _count: {
            select: {
              branches: true,
              staffProfiles: true,
              users: true,
              attendanceRecords: true,
            },
          },
        },
      });

      // Find existing ORG_ADMIN for this organization
      let orgAdminUser = await tx.user.findFirst({
        where: {
          organizationId: orgId,
          role: 'ORG_ADMIN',
        },
      });

      if (orgAdminUser) {
        // Update existing Org Admin User
        orgAdminUser = await tx.user.update({
          where: { id: orgAdminUser.id },
          data: {
            name: trimmedName,
            email: normalizedEmail,
            phone: trimmedPhone,
          },
        });
      } else {
        // Check if user with new email already exists in system
        const emailUser = await tx.user.findUnique({
          where: { email: normalizedEmail },
        });

        if (emailUser) {
          orgAdminUser = await tx.user.update({
            where: { id: emailUser.id },
            data: {
              organizationId: orgId,
              name: trimmedName,
              role: 'ORG_ADMIN',
              phone: trimmedPhone,
            },
          });
        } else {
          // Create new Org Admin User
          orgAdminUser = await tx.user.create({
            data: {
              organizationId: orgId,
              name: trimmedName,
              email: normalizedEmail,
              phone: trimmedPhone,
              passwordHash: '',
              role: 'ORG_ADMIN',
              status: 'PENDING',
            },
          });
        }
      }

      // If sendInvitation requested, create security token for setup
      if (sendInvitation && orgAdminUser) {
        rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = hashToken(rawToken);

        await tx.securityToken.create({
          data: {
            userId: orgAdminUser.id,
            organizationId: orgId,
            type: 'INVITATION',
            tokenHash,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 Hours
          },
        });
      }

      return { updatedOrg, orgAdminUser };
    });

    // 5. Record Audit Log
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    await recordAuditLog({
      organizationId: result.updatedOrg.id,
      actorUserId: session.user.id,
      action: 'ORGANIZATION_ADMIN_CHANGED',
      entityType: 'Organization',
      entityId: result.updatedOrg.id,
      metadata: {
        previousAdminName,
        previousAdminEmail,
        newAdminName: trimmedName,
        newAdminEmail: normalizedEmail,
        adminUserId: result.orgAdminUser.id,
      },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent'),
    }).catch(() => {});

    // 6. Optional Email Dispatch
    if (sendInvitation && rawToken && result.updatedOrg.organizationCode) {
      const baseUrl = getAppBaseUrl(request);
      const setupUrl = `${baseUrl}/activate-account?token=${rawToken}`;
      const loginUrl = `${baseUrl}/${result.updatedOrg.organizationCode}/login`;

      const setupTemplate = templateOrgAdminPasswordSetup({
        orgName: result.updatedOrg.name,
        organizationCode: result.updatedOrg.organizationCode,
        contactPersonName: trimmedName,
        adminEmail: normalizedEmail,
        setupUrl,
        loginUrl,
        expiresInHours: 24,
      });

      await sendEmail({
        recipient: normalizedEmail,
        type: 'ORG_ADMIN_PASSWORD_SETUP',
        subject: setupTemplate.subject,
        htmlContent: setupTemplate.html,
        textContent: setupTemplate.text,
        organizationId: result.updatedOrg.id,
      }).catch((err: any) => {
        console.error('Failed to send admin setup email:', err);
      });
    }

    return NextResponse.json({
      success: true,
      message: `Organization Admin successfully updated to ${trimmedName} (${normalizedEmail}).`,
      organization: result.updatedOrg,
      adminUser: {
        id: result.orgAdminUser.id,
        name: result.orgAdminUser.name,
        email: result.orgAdminUser.email,
      },
    });
  } catch (error: any) {
    console.error('Change Org Admin error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update Organization Admin.' },
      { status: 500 }
    );
  }
}
