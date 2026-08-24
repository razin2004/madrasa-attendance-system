import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentSession } from '@/lib/session';
import { sendEmail } from '@/services/email.service';
import { templateOrgRegistrationRejected } from '@/services/email-templates';
import { recordAuditLog } from '@/services/audit.service';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const orgId = params.id;
    const body = await request.json().catch(() => ({}));
    const rejectionReason = (body.rejectionReason as string)?.trim() || null;

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
          error: `Organization cannot be rejected because its current status is ${organization.status}.`,
        },
        { status: 400 }
      );
    }

    // 3. Update Organization to REJECTED
    const updatedOrg = await prisma.organization.update({
      where: { id: orgId },
      data: {
        status: 'REJECTED',
        rejectionReason,
        rejectedAt: new Date(),
        reviewedAt: new Date(),
        reviewedBy: session.user.name || session.user.email,
      },
    });

    // 4. Record Audit Log
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    await recordAuditLog({
      organizationId: updatedOrg.id,
      actorUserId: session.user.id,
      action: 'ORGANIZATION_REJECTED',
      entityType: 'Organization',
      entityId: updatedOrg.id,
      metadata: {
        name: updatedOrg.name,
        contactEmail: updatedOrg.contactEmail,
        rejectionReason,
      },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent'),
    });

    // 5. Dispatch Rejection Email to Applicant (Non-blocking)
    if (updatedOrg.contactEmail) {
      const emailTemplate = templateOrgRegistrationRejected({
        orgName: updatedOrg.name,
        contactPersonName: updatedOrg.contactPersonName || 'Applicant',
        rejectionReason,
      });

      sendEmail({
        recipient: updatedOrg.contactEmail,
        type: 'ORG_REJECTED',
        subject: emailTemplate.subject,
        htmlContent: emailTemplate.html,
        textContent: emailTemplate.text,
        organizationId: updatedOrg.id,
      }).catch((err) => {
        console.error('Non-blocking rejection email error:', err);
      });
    }

    return NextResponse.json({
      success: true,
      message: `Organization ${updatedOrg.name} has been rejected.`,
      organization: {
        id: updatedOrg.id,
        name: updatedOrg.name,
        status: updatedOrg.status,
      },
    });
  } catch (error: any) {
    console.error('Reject organization API error:', error);
    return NextResponse.json(
      { success: false, error: 'Rejection operation failed. Please try again.' },
      { status: 500 }
    );
  }
}
