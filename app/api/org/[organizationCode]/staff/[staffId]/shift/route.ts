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

    let staffProfile = null;

    if (params.staffId === 'me' || params.staffId === 'undefined' || !params.staffId) {
      staffProfile = await prisma.staffProfile.findFirst({
        where: {
          organizationId: organization.id,
          userId: session.user.id,
        },
      });
    } else {
      staffProfile = await prisma.staffProfile.findFirst({
        where: {
          organizationId: organization.id,
          OR: [{ id: params.staffId }, { staffId: params.staffId }],
        },
      });

      if (!staffProfile) {
        staffProfile = await prisma.staffProfile.findFirst({
          where: {
            organizationId: organization.id,
            userId: session.user.id,
          },
        });
      }
    }

    if (!staffProfile) {
      return NextResponse.json(
        { success: false, error: 'Staff member profile not found for this account.' },
        { status: 404 }
      );
    }

    const history = await getStaffShiftAssignmentHistory(staffProfile.id);
    const activeAssignments = history.filter(
      (h) => !h.effectiveTo || new Date(h.effectiveTo) >= new Date()
    );

    return NextResponse.json({
      success: true,
      currentAssignment: activeAssignments[0] || null,
      activeAssignment: activeAssignments[0] || null,
      activeAssignments: activeAssignments || [],
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
    const { shiftPatternId, shiftPatternIds, effectiveFrom } = body;

    const patternIdsToAssign: string[] = Array.isArray(shiftPatternIds) && shiftPatternIds.length > 0
      ? shiftPatternIds
      : typeof shiftPatternId === 'string' && shiftPatternId.trim()
      ? [shiftPatternId.trim()]
      : [];

    if (patternIdsToAssign.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Please select at least one valid shift pattern.' },
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
        organizationId: auth.organization.id,
        OR: [{ id: params.staffId }, { staffId: params.staffId }],
      },
    });

    if (!staffProfile) {
      return NextResponse.json(
        { success: false, error: 'Staff member not found.' },
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

    const createdAssignments = [];
    for (const pId of patternIdsToAssign) {
      const shiftPattern = await prisma.shiftPattern.findFirst({
        where: {
          id: pId,
          organizationId: auth.organization.id,
        },
      });

      if (!shiftPattern) {
        return NextResponse.json(
          { success: false, error: `Shift pattern "${pId}" does not exist in this organization.` },
          { status: 404 }
        );
      }

      try {
        const assignment = await assignOrUpdateStaffShift({
          staffProfileId: staffProfile.id,
          shiftPatternId: shiftPattern.id,
          effectiveFrom: startDate,
          assignedBy: auth.session.user.name || auth.session.user.email,
        });
        createdAssignments.push(assignment);
      } catch (err: any) {
        return NextResponse.json(
          { success: false, error: err.message || 'Time conflict detected with an existing shift assignment.' },
          { status: 409 }
        );
      }
    }

    // Check staffing availability shortage for this shift pattern on effective date
    const firstAssignment = createdAssignments[0];
    const shortageInfo = firstAssignment
      ? await calculateShiftStaffingShortage(
          auth.organization.id,
          firstAssignment.shiftPatternId,
          startDate
        )
      : null;

    // Record Audit Log
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    await recordAuditLog({
      organizationId: auth.organization.id,
      actorUserId: auth.session.user.id,
      action: 'SHIFT_PATTERN_UPDATED',
      entityType: 'ShiftAssignment',
      entityId: firstAssignment?.id || staffProfile.id,
      metadata: {
        staffProfileId: staffProfile.id,
        staffId: staffProfile.staffId,
        staffName: staffProfile.name,
        assignedShiftCount: createdAssignments.length,
        effectiveFrom: startDate.toISOString().slice(0, 10),
        shortageInfo,
      },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({
      success: true,
      message: `Assigned ${createdAssignments.length} shift pattern(s) to ${staffProfile.name} starting from ${startDate.toISOString().slice(0, 10)}.`,
      assignments: createdAssignments,
      assignment: firstAssignment || null,
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
