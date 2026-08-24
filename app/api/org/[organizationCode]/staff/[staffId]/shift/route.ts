import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentSession } from '@/lib/session';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import {
  assignOrUpdateStaffShift,
  getStaffShiftAssignmentHistory,
  calculateShiftStaffingShortage,
} from '@/services/roster.service';
import { recordAuditLog } from '@/services/audit.service';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { organizationCode: string; staffId: string } }
) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Authentication required. Please sign in.' },
        { status: 401 }
      );
    }

    const organization = await prisma.organization.findFirst({
      where: {
        organizationCode: { equals: params.organizationCode, mode: 'insensitive' },
      },
    });

    if (!organization) {
      return NextResponse.json(
        { success: false, error: 'Organization not found.' },
        { status: 404 }
      );
    }

    // Tenant Isolation Check
    if (session.user.role !== 'SUPER_ADMIN' && session.user.organizationId !== organization.id) {
      return NextResponse.json(
        { success: false, error: 'Access denied: You do not belong to this organization.' },
        { status: 403 }
      );
    }

    const staffProfile = await prisma.staffProfile.findFirst({
      where: {
        id: params.staffId,
        organizationId: organization.id,
      },
    });

    if (!staffProfile) {
      return NextResponse.json(
        { success: false, error: 'Staff member not found.' },
        { status: 404 }
      );
    }

    const history = await getStaffShiftAssignmentHistory(staffProfile.id);
    const activeAssignment = history.find(
      (h) => !h.effectiveTo || new Date(h.effectiveTo) >= new Date()
    );

    return NextResponse.json({
      success: true,
      currentAssignment: activeAssignment || null,
      activeAssignment: activeAssignment || null,
      history,
    });
  } catch (error: any) {
    console.error('Get staff shift error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve staff shift details.' },
      { status: 500 }
    );
  }
}

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
    const { shiftPatternId, effectiveFrom } = body;

    if (!shiftPatternId || typeof shiftPatternId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Please select a valid shift pattern.' },
        { status: 400 }
      );
    }

    if (!effectiveFrom) {
      return NextResponse.json(
        { success: false, error: 'Please specify an effective-from date for the shift assignment.' },
        { status: 400 }
      );
    }

    const staffProfile = await prisma.staffProfile.findFirst({
      where: {
        id: params.staffId,
        organizationId: auth.organization.id,
      },
    });

    if (!staffProfile) {
      return NextResponse.json(
        { success: false, error: 'Staff member not found.' },
        { status: 404 }
      );
    }

    const shiftPattern = await prisma.shiftPattern.findFirst({
      where: {
        id: shiftPatternId,
        organizationId: auth.organization.id,
      },
    });

    if (!shiftPattern) {
      return NextResponse.json(
        { success: false, error: 'Selected shift pattern does not exist in this organization.' },
        { status: 404 }
      );
    }

    const startDate = new Date(effectiveFrom);
    if (isNaN(startDate.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid effective-from date format.' },
        { status: 400 }
      );
    }

    // Assign or update shift assignment
    const assignment = await assignOrUpdateStaffShift({
      staffProfileId: staffProfile.id,
      shiftPatternId: shiftPattern.id,
      effectiveFrom: startDate,
      assignedBy: auth.session.user.name || auth.session.user.email,
    });

    // Check staffing availability shortage for this shift pattern on effective date
    const shortageInfo = await calculateShiftStaffingShortage(
      auth.organization.id,
      shiftPattern.id,
      startDate
    );

    // Record Audit Log
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    await recordAuditLog({
      organizationId: auth.organization.id,
      actorUserId: auth.session.user.id,
      action: 'SHIFT_PATTERN_UPDATED',
      entityType: 'ShiftAssignment',
      entityId: assignment.id,
      metadata: {
        staffProfileId: staffProfile.id,
        staffId: staffProfile.staffId,
        staffName: staffProfile.name,
        shiftPatternId: shiftPattern.id,
        shiftPatternName: shiftPattern.name,
        effectiveFrom: startDate.toISOString().slice(0, 10),
        shortageInfo,
      },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({
      success: true,
      message: `Assigned "${shiftPattern.name}" to ${staffProfile.name} starting from ${startDate.toISOString().slice(0, 10)}.`,
      assignment,
      shortageInfo,
    });
  } catch (error: any) {
    console.error('Assign staff shift error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to assign shift to staff member.' },
      { status: 500 }
    );
  }
}
