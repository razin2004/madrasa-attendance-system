import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { getCurrentSession } from '@/lib/session';
import {
  generateOrganizationCodeBase,
  hashToken,
} from '@/lib/security';
import { sendEmail } from '@/services/email.service';
import {
  templateOrgApprovedConfirmation,
  templateOrgAdminPasswordSetup,
} from '@/services/email-templates';
import { recordAuditLog } from '@/services/audit.service';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const orgId = params.id;

    // 1. Authorize Super Admin Session
    const session = await getCurrentSession();
    if (!session || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Super Admin access required.' },
        { status: 401 }
      );
    }

    // 2. Fetch Target Organization
    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!organization) {
      return NextResponse.json(
        { success: false, error: 'Organization record not found.' },
        { status: 404 }
      );
    }

    if (organization.status !== 'PENDING') {
      return NextResponse.json(
        {
          success: false,
          error: `Organization cannot be approved because its current status is ${organization.status}.`,
        },
        { status: 400 }
      );
    }

    // 3. Resolve Organization Code (Preserve requested code if present, otherwise generate base)
    let finalCode = organization.organizationCode?.toUpperCase();
    if (!finalCode) {
      const baseCode = generateOrganizationCodeBase(organization.name);
      const existingMatches = await prisma.organization.findMany({
        where: {
          organizationCode: {
            startsWith: baseCode,
          },
        },
        select: { organizationCode: true },
      });

      const usedCodes = new Set(existingMatches.map((m) => m.organizationCode).filter(Boolean));
      let suffixNum = 1;
      finalCode = `${baseCode}${suffixNum.toString().padStart(2, '0')}`;

      while (usedCodes.has(finalCode)) {
        suffixNum += 1;
        finalCode = `${baseCode}${suffixNum.toString().padStart(2, '0')}`;
      }
    }

    const adminEmail = (organization.contactEmail || '').toLowerCase().trim();
    const adminName = organization.contactPersonName || 'Organization Admin';

    // Generate 24h cryptographically secure password setup token
    const rawSetupToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawSetupToken);
    const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 Hours

    // 4. Transactional Execution
    const result = await prisma.$transaction(
      async (tx) => {
        // Update Organization Status to ACTIVE
        const updatedOrg = await tx.organization.update({
          where: { id: orgId },
          data: {
            organizationCode: finalCode,
            status: 'ACTIVE',
            approvedAt: new Date(),
            reviewedAt: new Date(),
            reviewedBy: session.user.name || session.user.email,
          },
        });

        // Create or Update Org Admin user (PENDING activation until password created)
        let orgAdminUser = await tx.user.findUnique({
          where: { email: adminEmail },
        });

        if (!orgAdminUser) {
          orgAdminUser = await tx.user.create({
            data: {
              organizationId: updatedOrg.id,
              name: adminName,
              email: adminEmail,
              phone: organization.phone,
              passwordHash: '', // Set by user during password setup
              role: 'ORG_ADMIN',
              status: 'PENDING',
              mustChangePassword: false,
            },
          });
        } else {
          orgAdminUser = await tx.user.update({
            where: { id: orgAdminUser.id },
            data: {
              organizationId: updatedOrg.id,
              name: adminName,
              phone: organization.phone,
              role: 'ORG_ADMIN',
              status: 'PENDING',
              mustChangePassword: false,
            },
          });
        }

        // Create SecurityToken for password creation
        await tx.securityToken.create({
          data: {
            userId: orgAdminUser.id,
            organizationId: updatedOrg.id,
            type: 'INVITATION',
            tokenHash,
            expiresAt: tokenExpiresAt,
          },
        });

        return { updatedOrg, orgAdminUser };
      },
      {
        maxWait: 15000,
        timeout: 30000,
      }
    );

    // 5. Record Audit Log
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    await recordAuditLog({
      organizationId: result.updatedOrg.id,
      actorUserId: session.user.id,
      action: 'ORGANIZATION_APPROVED',
      entityType: 'Organization',
      entityId: result.updatedOrg.id,
      metadata: {
        organizationCode: finalCode,
        adminUserId: result.orgAdminUser.id,
        adminEmail: result.orgAdminUser.email,
      },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent'),
    });

    // 6. Dispatch Two Separate Emails (Awaited for serverless runtime resilience)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://shiftguard.app';
    const setupUrl = `${baseUrl}/activate-account?token=${rawSetupToken}`;
    const loginUrl = `${baseUrl}/login`;

    // Email 1: Approval Confirmation Email
    const approvalTemplate = templateOrgApprovedConfirmation({
      orgName: result.updatedOrg.name,
      organizationCode: finalCode,
      contactPersonName: adminName,
    });

    // Email 2: Password Setup & Login Email
    const setupTemplate = templateOrgAdminPasswordSetup({
      orgName: result.updatedOrg.name,
      organizationCode: finalCode,
      contactPersonName: adminName,
      adminEmail: result.orgAdminUser.email,
      setupUrl,
      loginUrl,
      expiresInHours: 24,
    });

    await Promise.allSettled([
      sendEmail({
        recipient: adminEmail,
        type: 'ORG_APPROVED_CONFIRMATION',
        subject: approvalTemplate.subject,
        htmlContent: approvalTemplate.html,
        textContent: approvalTemplate.text,
        organizationId: result.updatedOrg.id,
      }),
      sendEmail({
        recipient: adminEmail,
        type: 'ORG_ADMIN_PASSWORD_SETUP',
        subject: setupTemplate.subject,
        htmlContent: setupTemplate.html,
        textContent: setupTemplate.text,
        organizationId: result.updatedOrg.id,
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: `Organization ${result.updatedOrg.name} approved successfully. Two setup notification emails dispatched.`,
      organization: {
        id: result.updatedOrg.id,
        name: result.updatedOrg.name,
        organizationCode: finalCode,
        status: result.updatedOrg.status,
      },
      admin: {
        email: result.orgAdminUser.email,
        setupUrl,
        loginUrl,
      },
    });
  } catch (error: any) {
    console.error('Approve organization API error:', error);
    return NextResponse.json(
      { success: false, error: 'Approval transaction failed. Please try again.' },
      { status: 500 }
    );
  }
}
