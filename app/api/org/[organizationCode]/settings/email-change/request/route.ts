import { NextRequest, NextResponse } from 'next/server';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import { prisma } from '@/lib/prisma';
import { normalizeEmail, generateNumericOTP, hashToken } from '@/lib/security';
import { sendEmail } from '@/services/email.service';
import {
  templateEmailChangeOTP,
  templateEmailChangeOldOTP,
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

    // 1. Generate 6-digit OTP for NEW Email
    const newEmailOtp = generateNumericOTP();
    const newTokenHash = hashToken(newEmailOtp);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await prisma.securityToken.create({
      data: {
        organizationId: organization.id,
        userId: session.user.id,
        type: 'LOGIN_OTP',
        tokenHash: newTokenHash,
        expiresAt,
        metadata: {
          action: 'EMAIL_CHANGE_NEW',
          targetEmail: cleanNewEmail,
          oldEmail,
          newEmail: cleanNewEmail,
        },
      },
    });

    // 2. Generate 6-digit OTP for CURRENT (OLD) Email
    const oldEmailOtp = generateNumericOTP();
    const oldTokenHash = hashToken(oldEmailOtp);

    await prisma.securityToken.create({
      data: {
        organizationId: organization.id,
        userId: session.user.id,
        type: 'LOGIN_OTP',
        tokenHash: oldTokenHash,
        expiresAt,
        metadata: {
          action: 'EMAIL_CHANGE_OLD',
          targetEmail: oldEmail,
          oldEmail,
          newEmail: cleanNewEmail,
        },
      },
    });

    // 3. Dispatch OTP to NEW Email Address
    const newOtpPayload = templateEmailChangeOTP({
      orgName: organization.name,
      newEmail: cleanNewEmail,
      otpCode: newEmailOtp,
      expiresInMinutes: 15,
    });

    await sendEmail({
      recipient: cleanNewEmail,
      subject: newOtpPayload.subject,
      htmlContent: newOtpPayload.html,
      textContent: newOtpPayload.text,
      organizationId: organization.id,
      type: 'EMAIL_CHANGE_NEW_OTP',
    });

    // 4. Dispatch Security Authorization OTP to CURRENT (OLD) Email Address
    if (oldEmail) {
      const oldOtpPayload = templateEmailChangeOldOTP({
        orgName: organization.name,
        oldEmail,
        newEmail: cleanNewEmail,
        otpCode: oldEmailOtp,
        expiresInMinutes: 15,
      });

      await sendEmail({
        recipient: oldEmail,
        subject: oldOtpPayload.subject,
        htmlContent: oldOtpPayload.html,
        textContent: oldOtpPayload.text,
        organizationId: organization.id,
        type: 'EMAIL_CHANGE_OLD_OTP',
      });
    }

    return NextResponse.json({
      success: true,
      message: `Verification codes dispatched! Check both your current email (${oldEmail}) and new email (${cleanNewEmail}).`,
    });
  } catch (error: any) {
    console.error('Error requesting email change OTPs:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to dispatch verification OTPs.' },
      { status: 500 }
    );
  }
}
