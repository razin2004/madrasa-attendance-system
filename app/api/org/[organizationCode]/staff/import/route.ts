import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import { prisma } from '@/lib/prisma';
import { normalizeEmail, generateStaffId, hashPassword, hashToken, getAppBaseUrl } from '@/lib/security';
import { sendEmail } from '@/services/email.service';
import { templateStaffActivationInvitation } from '@/services/email-templates';

export const dynamic = 'force-dynamic';

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

    const { organization } = auth;
    const body = await req.json().catch(() => ({}));
    const rows: Array<{
      name?: string;
      email?: string;
      staffId?: string;
      phone?: string;
      address?: string;
      idDocType?: string;
      idDocLast4?: string;
      branchName?: string;
      role?: string;
    }> = body.rows || [];

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No staff rows provided for CSV import.' },
        { status: 400 }
      );
    }

    // Fetch existing branches for organization to match branch by name
    const existingBranches = await prisma.branch.findMany({
      where: { organizationId: organization.id },
      select: { id: true, name: true },
    });

    const branchMap = new Map<string, string>();
    existingBranches.forEach((b) => {
      branchMap.set(b.name.trim().toLowerCase(), b.id);
    });

    // Existing emails check
    const existingUsers = await prisma.user.findMany({ select: { email: true } });
    const existingEmails = new Set(existingUsers.map((u) => u.email.toLowerCase()));
    const processedEmailsInBatch = new Set<string>();

    // Initial count for sequential Staff ID generation if staffId is omitted
    let currentStaffCount = await prisma.staffProfile.count({
      where: { organizationId: organization.id },
    });

    const errors: Array<{ row: number; email?: string; reason: string }> = [];
    const createdStaff: any[] = [];
    let importedCount = 0;
    let skippedCount = 0;

    const validIdDocTypes = ['AADHAAR', 'VOTER_ID', 'PASSPORT', 'DRIVING_LICENSE', 'OTHER'];

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 1;
      const r = rows[i];

      const cleanName = r.name?.trim() || '';
      const rawEmail = r.email?.trim() || '';
      const cleanEmail = rawEmail ? normalizeEmail(rawEmail) : '';
      const cleanStaffId = r.staffId?.trim() || '';
      const cleanPhone = r.phone?.trim() || null;
      const cleanAddress = r.address?.trim() || '';
      const rawDocType = r.idDocType?.trim().toUpperCase() || 'OTHER';
      const cleanDocType = validIdDocTypes.includes(rawDocType) ? rawDocType : 'OTHER';
      const cleanDocLast4 = r.idDocLast4 ? r.idDocLast4.trim().replace(/\D/g, '').slice(0, 4) : null;
      const cleanBranchName = r.branchName?.trim() || '';
      const rawRole = r.role?.trim().toUpperCase() || 'STAFF';

      // 1. Mandatory Validation: Full Name and Email are strictly required
      if (!cleanName) {
        errors.push({ row: rowNum, email: cleanEmail, reason: 'Full Name is mandatory.' });
        skippedCount++;
        continue;
      }

      if (!cleanEmail || !cleanEmail.includes('@')) {
        errors.push({ row: rowNum, email: cleanEmail, reason: 'Valid Email Address is mandatory.' });
        skippedCount++;
        continue;
      }

      // Check email uniqueness across platform
      if (existingEmails.has(cleanEmail) || processedEmailsInBatch.has(cleanEmail)) {
        errors.push({
          row: rowNum,
          email: cleanEmail,
          reason: `Email address "${cleanEmail}" is already registered in the system.`,
        });
        skippedCount++;
        continue;
      }

      processedEmailsInBatch.add(cleanEmail);

      // Staff ID: Auto-generate if blank
      currentStaffCount++;
      const staffIdToUse = cleanStaffId || generateStaffId(currentStaffCount, 'STF');

      // Resolve branch if specified
      let matchedBranchId: string | null = null;
      if (cleanBranchName) {
        matchedBranchId = branchMap.get(cleanBranchName.toLowerCase()) || null;
      }
      if (!matchedBranchId && existingBranches.length === 1) {
        matchedBranchId = existingBranches[0].id; // Fallback to sole branch if only 1 exists
      }

      try {
        const userRole = ['ORG_ADMIN', 'SUB_ADMIN', 'STAFF'].includes(rawRole) ? rawRole : 'STAFF';
        const initialPlaceholderHash = await hashPassword(crypto.randomBytes(32).toString('hex'));
        const rawActivationToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = hashToken(rawActivationToken);
        const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        // Transactional creation
        const result = await prisma.$transaction(async (tx) => {
          const newUser = await tx.user.create({
            data: {
              organizationId: organization.id,
              name: cleanName,
              email: cleanEmail,
              phone: cleanPhone,
              passwordHash: initialPlaceholderHash,
              role: userRole as any,
              status: 'PENDING',
              mustChangePassword: false,
            },
          });

          const newProfile = await tx.staffProfile.create({
            data: {
              userId: newUser.id,
              organizationId: organization.id,
              staffId: staffIdToUse,
              name: cleanName,
              phone: cleanPhone,
              address: cleanAddress,
              idDocType: cleanDocType as any,
              idDocLast4: cleanDocLast4,
            },
          });

          if (matchedBranchId) {
            await tx.branchStaffAssignment.create({
              data: {
                branchId: matchedBranchId,
                staffProfileId: newProfile.id,
                assignedBy: auth.session?.user?.name || auth.session?.user?.email || 'Admin',
              },
            });
          }

          // Create setup activation token
          await tx.securityToken.create({
            data: {
              userId: newUser.id,
              organizationId: organization.id,
              type: 'INVITATION',
              tokenHash,
              expiresAt: tokenExpiresAt,
            },
          });

          return { user: newUser, profile: newProfile };
        });

        // Dispatch invitation email asynchronously
        const origin = getAppBaseUrl(req);
        const activationUrl = `${origin}/activate-account?token=${rawActivationToken}`;

        const emailTemplate = templateStaffActivationInvitation({
          staffName: cleanName,
          orgName: organization.name,
          activationUrl,
          expiresInHours: 24,
        });

        sendEmail({
          recipient: cleanEmail,
          type: 'STAFF_INVITATION',
          subject: emailTemplate.subject,
          htmlContent: emailTemplate.html,
          textContent: emailTemplate.text,
          organizationId: organization.id,
        }).catch((e) => console.error(`Failed to send setup email to ${cleanEmail}:`, e));

        existingEmails.add(cleanEmail);
        importedCount++;
        createdStaff.push({
          id: result.profile.id,
          name: cleanName,
          email: cleanEmail,
          staffId: staffIdToUse,
        });
      } catch (err: any) {
        console.error(`Row ${rowNum} import error:`, err);
        errors.push({
          row: rowNum,
          email: cleanEmail,
          reason: err.message || 'Failed to create staff record.',
        });
        skippedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Bulk CSV import complete: ${importedCount} staff members imported, ${skippedCount} skipped.`,
      importedCount,
      skippedCount,
      errors,
      createdStaff,
    });
  } catch (error: any) {
    console.error('Bulk staff import error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error during CSV import.' },
      { status: 500 }
    );
  }
}
