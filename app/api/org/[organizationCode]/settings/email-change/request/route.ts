import { NextRequest, NextResponse } from 'next/server';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import { prisma } from '@/lib/prisma';
import { normalizeEmail, generateNumericOTP, hashToken } from '@/lib/security';
import { sendEmail } from '@/services/email.service';
import {
  templateEmailChangeOTP,
  templateEmailChangeNoticeOld,
} from '@/services/email-templates';

export async function POST(
  req: NextRequest,
  { params }: { params: { organizationCode: string } }
) {
  try {
    const auth = await requireOrgAdmin(params.organizationCode);
    if (!auth.authorized || !auth.organization || !auth.session) {
      return NextResponse.json(
        { success: false, error: auth.errorMessage || 'Unauthorized.' },
        { status: auth.errorStatus || 401 }
      );
    }

    const { organization, session } = auth;
    const body = await req.json();
    const { newEmail } = body;

    const cleanNewEmail = normalizeEmail(newEmail);
    const oldEmail = organization.contactEmail || session.user.email;

    if (!cleanNewEmail || !cleanNewEmail.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid new email address.' },
        { status: 400 }
      );
    }

    if (cleanNewEmail === normalizeEmail(oldEmail)) {
      return NextResponse.json(
        { success: false, error: 'New email address must be different from current email.' },
        { status: 400 }
      );
    }

    // Invalidate existing pending tokens for this organization/user email change
    await prisma.securityToken.deleteMany({
      where: {
        organizationId: organization.id,
        userId: session.user.id,
        consumedAt: null,
      },
    });

    // Generate 6-digit OTP
    const otpCode = generateNumericOTP();
    const tokenHash = hashToken(otpCode);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await prisma.securityToken.create({
      data: {
        organizationId: organization.id,
        userId: session.user.id,
        type: 'LOGIN_OTP',
        tokenHash,
        expiresAt,
        metadata: {
          action: 'ORGANIZATION_EMAIL_CHANGE',
          oldEmail,
          newEmail: cleanNewEmail,
        },
      },
    });

    // 1. Dispatch OTP email to NEW email
    const otpEmailPayload = templateEmailChangeOTP({
      orgName: organization.name,
      newEmail: cleanNewEmail,
      otpCode,
      expiresInMinutes: 15,
    });

    await sendEmail({
      recipient: cleanNewEmail,
      subject: otpEmailPayload.subject,
      htmlContent: otpEmailPayload.html,
      textContent: otpEmailPayload.text,
      organizationId: organization.id,
      type: 'EMAIL_CHANGE_OTP',
    });

    // 2. Dispatch Security Notification to OLD email
    if (oldEmail && oldEmail !== cleanNewEmail) {
      const oldNoticePayload = templateEmailChangeNoticeOld({
        orgName: organization.name,
        oldEmail,
        newEmail: cleanNewEmail,
      });

      await sendEmail({
        recipient: oldEmail,
        subject: oldNoticePayload.subject,
        htmlContent: oldNoticePayload.html,
        textContent: oldNoticePayload.text,
        organizationId: organization.id,
        type: 'EMAIL_CHANGE_NOTICE',
      });
    }

    return NextResponse.json({
      success: true,
      message: `Verification OTP has been sent to ${cleanNewEmail}. Please check your inbox.`,
    });
  } catch (error: any) {
    console.error('Error requesting email change OTP:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to dispatch verification OTP.' },
      { status: 500 }
    );
  }
}
