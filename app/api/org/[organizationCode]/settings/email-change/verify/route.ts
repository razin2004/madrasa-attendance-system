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
    const { oldEmailOtp, newEmailOtp, newEmail } = body;

    const cleanOldOtp = (oldEmailOtp || '').toString().trim();
    const cleanNewOtp = (newEmailOtp || '').toString().trim();
    const cleanNewEmail = normalizeEmail(newEmail);

    if (!cleanOldOtp || cleanOldOtp.length !== 6) {
      return NextResponse.json(
        { success: false, error: 'Please enter the 6-digit verification code sent to your CURRENT email.' },
        { status: 400 }
      );
    }

    if (!cleanNewOtp || cleanNewOtp.length !== 6) {
      return NextResponse.json(
        { success: false, error: 'Please enter the 6-digit verification code sent to your NEW email.' },
        { status: 400 }
      );
    }

    // 1. Verify NEW Email OTP Token
    const newTokenHash = hashToken(cleanNewOtp);
    const newToken = await prisma.securityToken.findUnique({
      where: { tokenHash: newTokenHash },
    });

    if (
      !newToken ||
      newToken.organizationId !== organization.id ||
      newToken.consumedAt !== null ||
      newToken.expiresAt < new Date()
    ) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired OTP code for the NEW email address.' },
        { status: 400 }
      );
    }

    // 2. Verify CURRENT (OLD) Email OTP Token
    const oldTokenHash = hashToken(cleanOldOtp);
    const oldToken = await prisma.securityToken.findUnique({
      where: { tokenHash: oldTokenHash },
    });

    if (
      !oldToken ||
      oldToken.organizationId !== organization.id ||
      oldToken.consumedAt !== null ||
      oldToken.expiresAt < new Date()
    ) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired authorization code for your CURRENT email address.' },
        { status: 400 }
      );
    }

    const metadataNew: any = newToken.metadata || {};
    const metadataOld: any = oldToken.metadata || {};

    const targetNewEmail = cleanNewEmail || metadataNew.newEmail || metadataOld.newEmail;
    const oldEmail = metadataOld.oldEmail || metadataNew.oldEmail || organization.contactEmail || session.user.email;

    if (!targetNewEmail) {
      return NextResponse.json(
        { success: false, error: 'Target new email address is missing.' },
        { status: 400 }
      );
    }

    // 3. Mark both tokens consumed
    await prisma.securityToken.updateMany({
      where: { id: { in: [newToken.id, oldToken.id] } },
      data: { consumedAt: new Date() },
    });

    // 4. Update Organization contactEmail in DB
    const updatedOrg = await prisma.organization.update({
      where: { id: organization.id },
      data: {
        contactEmail: targetNewEmail,
      },
    });

    // 5. Update Org Admin User email if admin user's email was matching old contactEmail
    if (session.user.email === oldEmail) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { email: targetNewEmail },
      });
    }

    // 6. Send Confirmation Emails to BOTH OLD AND NEW Email addresses
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
      message: `Contact email updated to ${targetNewEmail} successfully! Both OTP codes verified. Confirmation sent to both email addresses.`,
      organization: updatedOrg,
    });
  } catch (error: any) {
    console.error('Error verifying dual email change OTPs:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to verify OTPs.' },
      { status: 500 }
    );
  }
}
