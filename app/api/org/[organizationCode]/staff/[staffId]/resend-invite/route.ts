import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import { getAppBaseUrl } from '@/lib/security';
import { sendEmail } from '@/services/email.service';
import { templateStaffActivationInvitation } from '@/services/email-templates';

export async function POST(
  request: NextRequest,
  { params }: { params: { organizationCode: string; staffId: string } }
) {
  try {
    const auth = await requireOrgAdmin(params.organizationCode);
    if (!auth.authorized || !auth.organization) {
      return NextResponse.json(
        { success: false, error: auth.errorMessage || 'Unauthorized' },
        { status: auth.errorStatus || 401 }
      );
    }

    const staff = await prisma.staffProfile.findFirst({
      where: {
        organizationId: auth.organization.id,
        OR: [{ id: params.staffId }, { staffId: params.staffId }],
      },
      include: {
        user: true,
      },
    });

    if (!staff || !staff.user) {
      return NextResponse.json({ success: false, error: 'Staff member or user account not found.' }, { status: 404 });
    }

    const rawActivationToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawActivationToken).digest('hex');
    const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.$transaction(async (tx) => {
      // Invalidate existing unused invitation tokens for this user
      await tx.securityToken.deleteMany({
        where: {
          userId: staff.user.id,
          type: 'INVITATION',
        },
      });

      // Create fresh SecurityToken
      await tx.securityToken.create({
        data: {
          userId: staff.user.id,
          organizationId: auth.organization!.id,
          type: 'INVITATION',
          tokenHash,
          expiresAt: tokenExpiresAt,
        },
      });
    });

    // Build activation URL & Email Template
    const origin = getAppBaseUrl(request);
    const activationUrl = `${origin}/activate-account?token=${rawActivationToken}`;

    const emailTemplate = templateStaffActivationInvitation({
      staffName: staff.name,
      orgName: auth.organization.name,
      activationUrl,
      expiresInHours: 24,
    });

    const emailResult = await sendEmail({
      recipient: staff.user.email,
      type: 'STAFF_ACTIVATION_INVITATION',
      subject: emailTemplate.subject,
      htmlContent: emailTemplate.html,
      textContent: emailTemplate.text,
      organizationId: auth.organization.id,
    });

    if (!emailResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Email dispatch failed: ${emailResult.error || 'Check server email configuration.'}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Login invitation email sent successfully to ${staff.user.email}`,
      activationUrl,
      staff: {
        id: staff.id,
        staffId: staff.staffId,
        name: staff.name,
        email: staff.user.email,
        phone: staff.phone,
      },
    });
  } catch (err: any) {
    console.error('Error resending staff invite email:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to resend login email.' },
      { status: 500 }
    );
  }
}
