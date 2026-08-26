import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizeEmail } from '@/lib/security';
import { validateImageFile, saveLogoFile } from '@/lib/storage';
import { sendEmail } from '@/services/email.service';
import {
  templateOrgRegistrationReceived,
  templateOrgRegistrationApplicantConfirmation,
} from '@/services/email-templates';
import { recordAuditLog } from '@/services/audit.service';
import { checkRateLimit, recordRateLimitAttempt } from '@/lib/rate-limiter';

export const dynamic = 'force-dynamic';

// International phone validation regex (+[1-9][0-9]{7,14} or standard digits)
const PHONE_REGEX = /^\+?[0-9\s\-()]{7,20}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const rateLimitKey = `register-org:${ip}`;

    // Rate limiting: max 10 registration attempts per hour
    const rateCheck = checkRateLimit(rateLimitKey, {
      maxAttempts: 10,
      windowMs: 60 * 60 * 1000,
      lockoutMs: 30 * 60 * 1000,
    });

    if (rateCheck.isBlocked) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many registration attempts. Please try again in ${rateCheck.retryAfterSeconds || 60} seconds.`,
        },
        { status: 429 }
      );
    }

    const formData = await request.formData();

    const name = (formData.get('name') as string)?.trim();
    const phone = (formData.get('phone') as string)?.trim();
    const contactPersonName = (formData.get('contactPersonName') as string)?.trim();
    const contactEmailRaw = (formData.get('contactEmail') as string)?.trim();
    const organizationCodeRaw = (formData.get('organizationCode') as string)?.trim();
    const logoFile = formData.get('logo') as File | null;

    // 1. Validation Checks
    if (!name || name.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Organization name is required (minimum 2 characters).' },
        { status: 400 }
      );
    }

    if (!organizationCodeRaw) {
      return NextResponse.json(
        { success: false, error: 'Organization Code is required.' },
        { status: 400 }
      );
    }

    const cleanCode = organizationCodeRaw.toUpperCase();
    if (!/^[A-Z0-9]{3,12}$/.test(cleanCode)) {
      return NextResponse.json(
        { success: false, error: 'Organization Code must be 3-12 alphanumeric characters (e.g. ABCENG).' },
        { status: 400 }
      );
    }

    if (!contactPersonName || contactPersonName.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Contact person name is required.' },
        { status: 400 }
      );
    }

    if (!contactEmailRaw || !EMAIL_REGEX.test(contactEmailRaw)) {
      return NextResponse.json(
        { success: false, error: 'A valid contact email address is required.' },
        { status: 400 }
      );
    }

    if (!phone || !PHONE_REGEX.test(phone)) {
      return NextResponse.json(
        { success: false, error: 'A valid phone number with country code is required.' },
        { status: 400 }
      );
    }

    if (!logoFile || logoFile.size === 0) {
      return NextResponse.json(
        { success: false, error: 'Organization logo is required.' },
        { status: 400 }
      );
    }

    const contactEmail = normalizeEmail(contactEmailRaw);

    // Check Organization Code uniqueness
    const existingCode = await prisma.organization.findUnique({
      where: { organizationCode: cleanCode },
    });

    if (existingCode) {
      recordRateLimitAttempt(rateLimitKey, false);
      return NextResponse.json(
        {
          success: false,
          error: `Organization Code "${cleanCode}" is already taken by another organization. Please choose a different code.`,
        },
        { status: 409 }
      );
    }

    // 2. Validate Logo Image File
    const arrayBuffer = await logoFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const validation = validateImageFile(buffer, logoFile.name, logoFile.type);
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, error: validation.error || 'Invalid logo file.' },
        { status: 400 }
      );
    }

    // 3. Duplicate Detection Check
    const existingOrg = await prisma.organization.findFirst({
      where: {
        OR: [
          { name: { equals: name, mode: 'insensitive' } },
          { contactEmail: { equals: contactEmail, mode: 'insensitive' } },
          { phone: { equals: phone } },
        ],
        status: {
          in: ['PENDING', 'ACTIVE'],
        },
      },
    });

    if (existingOrg) {
      recordRateLimitAttempt(rateLimitKey, false);
      return NextResponse.json(
        {
          success: false,
          error:
            'An organization with similar registration details already exists. Please verify your information before continuing.',
        },
        { status: 409 }
      );
    }

    // 4. Save Logo File to Public Storage
    const logoUrl = await saveLogoFile(buffer, logoFile.name);

    // 5. Create Pending Organization
    const newOrg = await prisma.organization.create({
      data: {
        name,
        organizationCode: cleanCode,
        phone,
        contactPersonName,
        contactEmail,
        logoUrl,
        status: 'PENDING',
      },
    });

    recordRateLimitAttempt(rateLimitKey, true);

    // 6. Record Audit Log
    await recordAuditLog({
      organizationId: newOrg.id,
      action: 'ORGANIZATION_REGISTERED',
      entityType: 'Organization',
      entityId: newOrg.id,
      metadata: {
        name: newOrg.name,
        contactEmail: newOrg.contactEmail,
        phone: newOrg.phone,
      },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent'),
    });

    // 7. Dispatch Notification Emails (Non-blocking failure resilience)
    // Email A: Confirmation to Organization Applicant / Contact Person
    const applicantTemplate = templateOrgRegistrationApplicantConfirmation({
      orgName: newOrg.name,
      organizationCode: newOrg.organizationCode || cleanCode,
      contactPersonName: newOrg.contactPersonName || 'Applicant',
      contactEmail: newOrg.contactEmail || '',
      submittedAt: new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
    });

    sendEmail({
      recipient: newOrg.contactEmail || contactEmail,
      type: 'ORG_REGISTRATION_APPLICANT_CONFIRMATION',
      subject: applicantTemplate.subject,
      htmlContent: applicantTemplate.html,
      textContent: applicantTemplate.text,
      organizationId: newOrg.id,
    }).catch((emailErr) => {
      console.error('Applicant registration confirmation email failed:', emailErr);
    });

    // Email B: Notification to Super Admin (Requires SUPER_ADMIN_EMAIL environment variable)
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL?.trim();
    if (!superAdminEmail) {
      console.error('Server Configuration Warning: SUPER_ADMIN_EMAIL environment variable is not set. Organization registration alert email was not dispatched.');
    } else {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://shiftguard.app';
      const reviewUrl = `${baseUrl}/super-admin/dashboard`;

      const superAdminTemplate = templateOrgRegistrationReceived({
        orgName: newOrg.name,
        organizationCode: newOrg.organizationCode,
        contactPersonName: newOrg.contactPersonName || '',
        contactEmail: newOrg.contactEmail || '',
        phone: newOrg.phone || '',
        submittedAt: new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
        reviewUrl,
      });

      sendEmail({
        recipient: superAdminEmail,
        type: 'ORG_REGISTRATION_RECEIVED',
        subject: superAdminTemplate.subject,
        htmlContent: superAdminTemplate.html,
        textContent: superAdminTemplate.text,
        organizationId: newOrg.id,
      }).catch((emailErr) => {
        console.error('Super Admin registration notification failed:', emailErr);
      });
    }

    return NextResponse.json({
      success: true,
      organizationId: newOrg.id,
      name: newOrg.name,
      status: 'PENDING',
    });
  } catch (error: any) {
    console.error('Organization registration error:', error);
    return NextResponse.json(
      {
        success: false,
        error: "We couldn't complete the registration. Please verify the information and try again.",
      },
      { status: 500 }
    );
  }
}
