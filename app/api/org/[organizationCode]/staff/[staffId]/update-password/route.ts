import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import { hashPassword, generateTemporaryPassword, getAppBaseUrl } from '@/lib/security';
import { sendEmail } from '@/services/email.service';
import { recordAuditLog } from '@/services/audit.service';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { organizationCode: string; staffId: string } }
) {
  try {
    const auth = await requireOrgAdmin(params.organizationCode);
    if (!auth.authorized || !auth.organization || !auth.session) {
      return NextResponse.json(
        { success: false, error: auth.errorMessage },
        { status: auth.errorStatus || 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { newPassword, password, sendEmailNotification } = body;
    const shouldSendEmail = sendEmailNotification !== false;

    let targetPassword = ((newPassword || password) as string)?.trim() || '';
    if (targetPassword.length > 0) {
      if (targetPassword.length < 8) {
        return NextResponse.json(
          { success: false, error: 'Password must be at least 8 characters long.' },
          { status: 400 }
        );
      }
    } else {
      // Auto-generate secure 8-character password if left empty
      targetPassword = generateTemporaryPassword(8);
    }

    const staffProfile = await prisma.staffProfile.findFirst({
      where: {
        organizationId: auth.organization.id,
        OR: [{ id: params.staffId }, { staffId: params.staffId }],
      },
      include: { user: true },
    });

    if (!staffProfile || !staffProfile.user) {
      return NextResponse.json(
        { success: false, error: 'Staff member not found or access denied.' },
        { status: 404 }
      );
    }

    const passwordHash = await hashPassword(targetPassword);

    await prisma.$transaction(async (tx) => {
      // Update password hash and set user status to ACTIVE
      await tx.user.update({
        where: { id: staffProfile.userId },
        data: {
          passwordHash,
          status: 'ACTIVE',
          mustChangePassword: false,
        },
      });

      // Invalidate invitation tokens as account is now activated with direct password
      await tx.securityToken.deleteMany({
        where: {
          userId: staffProfile.userId,
          type: 'INVITATION',
        },
      });
    });

    // Send email notification to staff member ONLY if checked
    let emailSent = false;
    if (shouldSendEmail) {
      const origin = getAppBaseUrl(request);
      const loginUrl = `${origin}/login`;

      const emailResult = await sendEmail({
        recipient: staffProfile.user.email,
        type: 'STAFF_PASSWORD_UPDATED',
        subject: `Your ShiftGuard Password Has Been Updated - ${auth.organization.name}`,
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0b0f19; color: #f8fafc; padding: 28px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);">
            <h2 style="color: #818cf8; margin-top: 0;">Password Updated</h2>
            <p>Hello <strong>${staffProfile.name}</strong>,</p>
            <p>Your account password for <strong>${auth.organization.name}</strong> has been updated by your organization administrator.</p>
            
            <div style="background: rgba(255,255,255,0.05); padding: 16px; border-radius: 8px; margin: 20px 0; border: 1px solid rgba(255,255,255,0.1);">
              <p style="margin: 4px 0;"><strong>Organization Code:</strong> <code style="color: #a5b4fc;">${auth.organization.organizationCode}</code></p>
              <p style="margin: 4px 0;"><strong>Staff ID:</strong> <code style="color: #a5b4fc;">${staffProfile.staffId}</code></p>
              <p style="margin: 4px 0;"><strong>Login Email:</strong> ${staffProfile.user.email}</p>
              <p style="margin: 4px 0;"><strong>New Password:</strong> <code style="color: #34d399; font-size: 16px;">${targetPassword}</code></p>
            </div>

            <p style="margin-top: 24px;">
              <a href="${loginUrl}" style="background: #4f46e5; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Log In to ShiftGuard</a>
            </p>
            <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">If you did not request this change, please contact your organization administrator immediately.</p>
          </div>
        `,
        textContent: `Hello ${staffProfile.name},\n\nYour account password for ${auth.organization.name} has been updated by your administrator.\n\nOrganization Code: ${auth.organization.organizationCode}\nStaff ID: ${staffProfile.staffId}\nEmail: ${staffProfile.user.email}\nNew Password: ${targetPassword}\n\nLogin Portal: ${loginUrl}`,
        organizationId: auth.organization.id,
      });

      emailSent = emailResult.success;
    }

    // Record Audit Log
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    await recordAuditLog({
      organizationId: auth.organization.id,
      actorUserId: auth.session.user.id,
      action: 'STAFF_PASSWORD_UPDATED_BY_ADMIN',
      entityType: 'StaffProfile',
      entityId: staffProfile.id,
      metadata: {
        staffId: staffProfile.staffId,
        staffName: staffProfile.name,
        email: staffProfile.user.email,
        emailSent,
      },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({
      success: true,
      message: `Password updated successfully for ${staffProfile.name}.`,
      updatedPassword: targetPassword,
      password: targetPassword,
      emailSent,
      staff: {
        id: staffProfile.id,
        staffId: staffProfile.staffId,
        name: staffProfile.name,
        email: staffProfile.user.email,
        phone: staffProfile.phone,
      },
    });
  } catch (error: any) {
    console.error('Update staff password error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update staff password.' },
      { status: 500 }
    );
  }
}
