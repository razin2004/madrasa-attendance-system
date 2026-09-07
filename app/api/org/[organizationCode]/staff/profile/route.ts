import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaff } from '@/lib/tenant-auth';
import { recordAuditLog } from '@/services/audit.service';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { organizationCode: string } }
) {
  try {
    const auth = await requireStaff(params.organizationCode);
    if (!auth.authorized || !auth.organization || !auth.staffProfile) {
      return NextResponse.json(
        { success: false, error: auth.errorMessage },
        { status: auth.errorStatus || 401 }
      );
    }

    const staffProfile = await prisma.staffProfile.findUnique({
      where: { id: auth.staffProfile.id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            status: true,
            role: true,
            createdAt: true,
          },
        },
        branchAssignments: {
          include: {
            branch: true,
          },
        },
        devices: true,
      },
    });

    return NextResponse.json({
      success: true,
      staffProfile,
      organization: auth.organization,
    });
  } catch (error: any) {
    console.error('Fetch staff profile error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load staff profile.' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { organizationCode: string } }
) {
  try {
    const auth = await requireStaff(params.organizationCode);
    if (!auth.authorized || !auth.organization || !auth.staffProfile || !auth.session) {
      return NextResponse.json(
        { success: false, error: auth.errorMessage },
        { status: auth.errorStatus || 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { idDocType, idDocLast4 } = body;

    if (!idDocType || typeof idDocType !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Identity card document type is required.' },
        { status: 400 }
      );
    }

    const validTypes = ['AADHAAR', 'VOTER_ID', 'PASSPORT', 'DRIVING_LICENSE', 'COLLEGE_ID', 'GOVERNMENT_ID', 'OTHER'];
    if (!validTypes.includes(idDocType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid identity card document type.' },
        { status: 400 }
      );
    }

    // Clean up last 4 digits
    const cleanLast4 = typeof idDocLast4 === 'string' && idDocLast4.trim() ? idDocLast4.trim().slice(-4) : null;

    if (idDocType !== 'OTHER' && (!cleanLast4 || cleanLast4.length < 4)) {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid 4-digit ID card number / document reference.' },
        { status: 400 }
      );
    }

    // Compute salted hash if last4 exists
    let idDocHash: string | null = null;
    if (cleanLast4) {
      idDocHash = crypto
        .createHash('sha256')
        .update(`${auth.organization.id}:${idDocType}:${cleanLast4}`)
        .digest('hex');
    }

    const updatedProfile = await prisma.staffProfile.update({
      where: { id: auth.staffProfile.id },
      data: {
        idDocType: idDocType as any,
        idDocLast4: cleanLast4,
        idDocHash: idDocHash,
      },
      include: {
        user: true,
        branchAssignments: { include: { branch: true } },
        devices: true,
      },
    });

    // Record Audit Log
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    await recordAuditLog({
      organizationId: auth.organization.id,
      actorUserId: auth.session.user.id,
      action: 'STAFF_ID_DOC_UPDATED',
      entityType: 'StaffProfile',
      entityId: updatedProfile.id,
      metadata: {
        staffId: updatedProfile.staffId,
        idDocType,
        idDocLast4: cleanLast4,
      },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({
      success: true,
      message: 'Identity Card details updated successfully!',
      staffProfile: updatedProfile,
    });
  } catch (error: any) {
    console.error('Update staff ID error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update identity document.' },
      { status: 500 }
    );
  }
}
