import { NextRequest, NextResponse } from 'next/server';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import { prisma } from '@/lib/prisma';
import { normalizeEmail, hashToken } from '@/lib/security';
import { sendEmail } from '@/services/email.service';
import { templateEmailChangeSuccess } from '@/services/email-templates';

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
    const { otpCode, newEmail } = body;

    const cleanOtp = (otpCode || '').toString().trim();
    const cleanNewEmail = normalizeEmail(newEmail);

    if (!cleanOtp || cleanOtp.length !== 6) {
      return NextResponse.json(
        { success: false, error: 'Please enter the 6-digit OTP verification code.' },
        { status: 400 }
      );
    }

    const tokenHash = hashToken(cleanOtp);
    const securityToken = await prisma.securityToken.findUnique({
      where: { tokenHash },
    });

    if (
      !securityToken ||
      securityToken.organizationId !== organization.id ||
      securityToken.consumedAt !== null ||
      securityToken.expiresAt < new Date()
    ) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired OTP verification code.' },
        { status: 400 }
      );
    }

    const metadata: any = securityToken.metadata || {};
    const targetNewEmail = cleanNewEmail || metadata.newEmail;
    const oldEmail = metadata.oldEmail || organization.contactEmail || session.user.email;

    if (!targetNewEmail) {
      return NextResponse.json(
        { success: false, error: 'Target new email is missing.' },
        { status: 400 }
      );
    }

    // 1. Mark token consumed
    await prisma.securityToken.update({
      where: { id: securityToken.id },
      data: { consumedAt: new Date() },
    });

    // 2. Update Organization contactEmail in DB
    const updatedOrg = await prisma.organization.update({
      where: { id: organization.id },
      data: {
        contactEmail: targetNewEmail,
      },
    });

    // 3. Update Org Admin User email if admin user's email was matching old contactEmail
    if (session.user.email === oldEmail) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { email: targetNewEmail },
      });
    }

    // 4. Send Confirmation Emails to BOTH OLD AND NEW Email addresses
    const successTemplate = templateEmailChangeSuccess({
      orgName: organization.name,
      oldEmail,
      newEmail: targetNewEmail,
    });

    // Send to NEW Email
    await sendEmail({
      recipient: targetNewEmail,
      subject: successTemplate.subject,
      htmlContent: successTemplate.html,
      textContent: successTemplate.text,
      organizationId: organization.id,
      type: 'EMAIL_CHANGE_SUCCESS',
    });

    // Send to OLD Email
    if (oldEmail && oldEmail !== targetNewEmail) {
      await sendEmail({
        recipient: oldEmail,
        subject: successTemplate.subject,
        htmlContent: successTemplate.html,
        textContent: successTemplate.text,
        organizationId: organization.id,
        type: 'EMAIL_CHANGE_SUCCESS',
      });
    }

    return NextResponse.json({
      success: true,
      message: `Contact email updated to ${targetNewEmail} successfully! Confirmation sent to both addresses.`,
      organization: updatedOrg,
    });
  } catch (error: any) {
    console.error('Error verifying email change OTP:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to verify OTP.' },
      { status: 500 }
    );
  }
}
