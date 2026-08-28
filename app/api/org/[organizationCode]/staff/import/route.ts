import { NextRequest, NextResponse } from 'next/server';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(
  req: NextRequest,
  { params }: { params: { organizationCode: string } }
) {
  try {
    const auth = await requireOrgAdmin(params.organizationCode);
    if (!auth.authorized || !auth.organization) {
      return NextResponse.json(
        { success: false, error: auth.errorMessage || 'Unauthorized.' },
        { status: auth.errorStatus || 401 }
      );
    }

    const { organization } = auth;
    const body = await req.json();
    const rows: Array<{
      name?: string;
      email?: string;
      staffId?: string;
      phone?: string;
      address?: string;
      role?: string;
      branchName?: string;
    }> = body.rows || [];

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No staff rows provided for import.' },
        { status: 400 }
      );
    }

    // Fetch existing branches for name matching
    const existingBranches = await prisma.branch.findMany({
      where: { organizationId: organization.id },
      select: { id: true, name: true },
    });

    const branchMap = new Map<string, string>();
    existingBranches.forEach((b) => {
      branchMap.set(b.name.trim().toLowerCase(), b.id);
    });

    const errors: Array<{ row: number; email?: string; reason: string }> = [];
    const createdStaff: any[] = [];
    let importedCount = 0;
    let skippedCount = 0;

    const defaultPasswordHash = await bcrypt.hash('ShiftGuard@2026', 10);
    const existingEmails = new Set(
      (await prisma.user.findMany({ select: { email: true } })).map((u) => u.email.toLowerCase())
    );

    const processedEmailsInBatch = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 1;
      const r = rows[i];

      const cleanName = r.name?.trim() || '';
      const cleanEmail = r.email?.trim().toLowerCase() || '';
      const cleanStaffId = r.staffId?.trim() || '';
      const cleanPhone = r.phone?.trim() || '';
      const cleanAddress = r.address?.trim() || '';
      const cleanBranchName = r.branchName?.trim() || '';
      const rawRole = r.role?.trim().toUpperCase() || 'STAFF';

      if (!cleanName) {
        errors.push({ row: rowNum, email: cleanEmail, reason: 'Full Name is required.' });
        skippedCount++;
        continue;
      }

      if (!cleanEmail || !cleanEmail.includes('@')) {
        errors.push({ row: rowNum, email: cleanEmail, reason: 'Valid email address is required.' });
        skippedCount++;
        continue;
      }

      if (existingEmails.has(cleanEmail) || processedEmailsInBatch.has(cleanEmail)) {
        errors.push({ row: rowNum, email: cleanEmail, reason: `Email '${cleanEmail}' is already registered in system.` });
        skippedCount++;
        continue;
      }

      processedEmailsInBatch.add(cleanEmail);

      // Generate Staff ID if not provided
      const staffIdToUse = cleanStaffId || `STF-${Math.floor(1000 + Math.random() * 9000)}`;

      // Resolve branch if specified
      let matchedBranchId: string | null = null;
      if (cleanBranchName) {
        matchedBranchId = branchMap.get(cleanBranchName.toLowerCase()) || null;
      }
      if (!matchedBranchId && existingBranches.length > 0) {
        matchedBranchId = existingBranches[0].id; // Fall back to first branch if not matched
      }

      try {
        const userRole = ['ORG_ADMIN', 'MANAGER', 'STAFF'].includes(rawRole) ? rawRole : 'STAFF';

        // Create User & StaffProfile in transaction
        const result = await prisma.$transaction(async (tx) => {
          const newUser = await tx.user.create({
            data: {
              name: cleanName,
              email: cleanEmail,
              passwordHash: defaultPasswordHash,
              role: userRole as any,
              status: 'ACTIVE',
              mustChangePassword: true,
            },
          });

          const newProfile = await tx.staffProfile.create({
            data: {
              organizationId: organization.id,
              userId: newUser.id,
              staffId: staffIdToUse,
              name: cleanName,
              phone: cleanPhone || null,
              address: cleanAddress || 'Not Provided',
            },
          });

          if (matchedBranchId) {
            await tx.branchStaffAssignment.create({
              data: {
                branchId: matchedBranchId,
                staffProfileId: newProfile.id,
              },
            });
          }

          return { user: newUser, profile: newProfile };
        });

        existingEmails.add(cleanEmail);
        importedCount++;
        createdStaff.push({
          id: result.profile.id,
          name: cleanName,
          email: cleanEmail,
          staffId: staffIdToUse,
        });
      } catch (err: any) {
        errors.push({
          row: rowNum,
          email: cleanEmail,
          reason: err.message || 'Database creation failed for row.',
        });
        skippedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Bulk import completed: ${importedCount} imported, ${skippedCount} skipped.`,
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
