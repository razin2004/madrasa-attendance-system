import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import {
  hashPassword,
  generateStaffId,
  normalizeEmail,
  hashToken,
} from '@/lib/security';
import { recordAuditLog } from '@/services/audit.service';
import { sendEmail } from '@/services/email.service';
import { templateStaffActivationInvitation } from '@/services/email-templates';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { organizationCode: string } }
) {
  try {
    const auth = await requireOrgAdmin(params.organizationCode);
    if (!auth.authorized || !auth.organization) {
      return NextResponse.json(
        { success: false, error: auth.errorMessage },
        { status: auth.errorStatus || 401 }
      );
    }

    const staffProfiles = await prisma.staffProfile.findMany({
      where: {
        organizationId: auth.organization.id,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            status: true,
            role: true,
            lastLoginAt: true,
          },
        },
        branchAssignments: {
          include: {
            branch: {
              select: {
                id: true,
                name: true,
                status: true,
              },
            },
          },
        },
        devices: true,
      },
    });

    const activeCount = staffProfiles.filter((s) => s.user.status === 'ACTIVE').length;
    const inactiveCount = staffProfiles.filter((s) => s.user.status === 'INACTIVE').length;
    const deviceRegisteredCount = staffProfiles.filter((s: any) => s.devices?.some((d: any) => d.status === 'REGISTERED')).length;
    const deviceResetRequiredCount = staffProfiles.filter((s: any) => s.devices?.some((d: any) => d.status === 'RESET_REQUIRED')).length;

    return NextResponse.json({
      success: true,
      staff: staffProfiles,
      staffMembers: staffProfiles,
      counts: {
        total: staffProfiles.length,
        active: activeCount,
        inactive: inactiveCount,
        deviceRegistered: deviceRegisteredCount,
        deviceResetRequired: deviceResetRequiredCount,
      },
    });
  } catch (error: any) {
    console.error('List staff error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve staff directory.' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: { organizationCode: string } }
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
    const {
      name,
      email,
      phone,
      address,
      idDocType = 'OTHER',
      idDocLast4,
      idDocHash,
      branchIds = [],
    } = body;

    // 1. Validation: Name and Email are mandatory. Phone is optional.
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: 'Staff full name is required.' },
        { status: 400 }
      );
    }

    if (!email || typeof email !== 'string' || !email.trim().includes('@')) {
      return NextResponse.json(
        { success: false, error: 'A valid email address is required for staff account authentication.' },
        { status: 400 }
      );
    }

    const cleanEmail = normalizeEmail(email);
    const cleanName = name.trim();
    const cleanPhone = phone && typeof phone === 'string' && phone.trim().length > 0 ? phone.trim() : null;
    const cleanAddress = address && typeof address === 'string' ? address.trim() : '';

    // Check email uniqueness across User table
    const existingUser = await prisma.user.findFirst({
      where: {
        email: cleanEmail,
      },
      include: {
        staffProfile: true,
      },
    });

    if (existingUser) {
      if (existingUser.organizationId === auth.organization.id) {
        if (existingUser.staffProfile) {
          return NextResponse.json(
            {
              success: false,
              error: `A staff account with email "${cleanEmail}" already exists in your organization (Staff ID: ${existingUser.staffProfile.staffId}).`,
            },
            { status: 409 }
          );
        }
        // User belongs to this organization (e.g. ORG_ADMIN) but has no StaffProfile yet.
        // Proceed to attach a StaffProfile to this existingUser!
      } else {
        return NextResponse.json(
          {
            success: false,
            error: `An account with email "${cleanEmail}" is already registered under another account or organization. Please specify a unique staff email address.`,
          },
          { status: 409 }
        );
      }
    }

    // Check optional phone uniqueness within organization if phone was provided
    if (cleanPhone) {
      const existingByPhone = await prisma.staffProfile.findFirst({
        where: {
          organizationId: auth.organization.id,
          phone: cleanPhone,
        },
      });

      if (existingByPhone) {
        return NextResponse.json(
          {
            success: false,
            error: `A staff member with phone number ${cleanPhone} already exists in this organization.`,
          },
          { status: 409 }
        );
      }
    }

    // Generate Sequential Staff ID
    const staffCount = await prisma.staffProfile.count({
      where: { organizationId: auth.organization.id },
    });
    const generatedStaffId = generateStaffId(staffCount + 1, 'STF');

    // 2. Verify Branch IDs belong to this organization
    if (Array.isArray(branchIds) && branchIds.length > 0) {
      const validBranches = await prisma.branch.findMany({
        where: {
          id: { in: branchIds },
          organizationId: auth.organization.id,
        },
      });

      if (validBranches.length !== branchIds.length) {
        return NextResponse.json(
          { success: false, error: 'One or more selected branches do not belong to this organization.' },
          { status: 400 }
        );
      }
    }

    // Generate random placeholder password hash (Staff will create permanent password via token)
    const initialPlaceholderHash = await hashPassword(crypto.randomBytes(32).toString('hex'));

    // Generate 24h cryptographically secure account activation setup token
    const rawActivationToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawActivationToken);
    const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 Hours

    // 3. Transactional Creation of User (if new), Profile, Branch Assignments, Device, and SecurityToken
    const result = await prisma.$transaction(
      async (tx) => {
        let targetUser: any = existingUser;

        if (!targetUser) {
          // User record in PENDING state awaiting staff password creation
          targetUser = await tx.user.create({
            data: {
              organizationId: auth.organization!.id,
              name: cleanName,
              email: cleanEmail,
              phone: cleanPhone,
              passwordHash: initialPlaceholderHash,
              role: 'STAFF',
              status: 'PENDING',
              mustChangePassword: false,
            },
          });
        }

        // StaffProfile record
        const profile = await tx.staffProfile.create({
          data: {
            userId: targetUser.id,
            organizationId: auth.organization!.id,
            staffId: generatedStaffId,
            name: cleanName,
            phone: cleanPhone || targetUser.phone,
            address: cleanAddress,
            idDocType: idDocType as any,
            idDocLast4: idDocLast4 || null,
            idDocHash: idDocHash || null,
          },
        });

        // Branch assignments
        if (Array.isArray(branchIds) && branchIds.length > 0) {
          await tx.branchStaffAssignment.createMany({
            data: branchIds.map((bId: string) => ({
              staffProfileId: profile.id,
              branchId: bId,
              assignedBy: auth.session!.user.name || auth.session!.user.email,
            })),
          });
        }

        // SecurityToken for account activation & password creation (if PENDING)
        if (targetUser.status === 'PENDING') {
          await tx.securityToken.create({
            data: {
              userId: targetUser.id,
              organizationId: auth.organization!.id,
              type: 'INVITATION',
              tokenHash,
              expiresAt: tokenExpiresAt,
            },
          });
        }

        return { user: targetUser, profile };
      },
      { maxWait: 15000, timeout: 30000 }
    );

    // 4. Send Account Setup Email to Staff (Awaited for serverless runtime resilience)
    const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const activationUrl = `${origin}/activate-account?token=${rawActivationToken}`;

    const emailTemplate = templateStaffActivationInvitation({
      staffName: cleanName,
      orgName: auth.organization.name,
      activationUrl,
      expiresInHours: 24,
    });

    await sendEmail({
      recipient: cleanEmail,
      type: 'STAFF_ACTIVATION_INVITATION',
      subject: emailTemplate.subject,
      htmlContent: emailTemplate.html,
      textContent: emailTemplate.text,
      organizationId: auth.organization.id,
    });

    // 5. Record Audit Log
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    await recordAuditLog({
      organizationId: auth.organization.id,
      actorUserId: auth.session.user.id,
      action: 'STAFF_CREATED',
      entityType: 'StaffProfile',
      entityId: result.profile.id,
      metadata: {
        staffId: generatedStaffId,
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        idDocType,
        assignedBranchesCount: branchIds.length,
      },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({
      success: true,
      message: `Staff account created for ${cleanName}. A password setup link has been sent to ${cleanEmail}.`,
      staff: {
        id: result.profile.id,
        staffId: generatedStaffId,
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        address: cleanAddress,
        activationUrl,
        deviceStatus: 'NOT_REGISTERED',
      },
    });
  } catch (error: any) {
    console.error('Create staff error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create staff account. Please verify details.' },
      { status: 500 }
    );
  }
}
