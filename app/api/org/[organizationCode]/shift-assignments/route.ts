import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import { checkShiftAssignmentConflict } from '@/services/roster.service';
import { parseIsoDayToDate } from '@/lib/shift-validation';
import { recordAuditLog } from '@/services/audit.service';

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

    const { searchParams } = new URL(request.url);
    const staffId = searchParams.get('staffId');
    const shiftPatternId = searchParams.get('shiftPatternId');

    const assignments = await prisma.shiftAssignment.findMany({
      where: {
        staffProfile: {
          organizationId: auth.organization.id,
          id: staffId || undefined,
        },
        shiftPatternId: shiftPatternId || undefined,
      },
      include: {
        staffProfile: {
          select: {
            id: true,
            staffId: true,
            name: true,
            phone: true,
            user: { select: { status: true } },
          },
        },
        shiftPattern: {
          select: {
            id: true,
            name: true,
            minimumStaffingThreshold: true,
            isActive: true,
          },
        },
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    return NextResponse.json({
      success: true,
      assignments,
      count: assignments.length,
    });
  } catch (error: any) {
    console.error('List shift assignments error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve shift assignments.' },
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
    const { shiftPatternId, staffProfileIds = [], effectiveFrom, effectiveTo } = body;

    // 1. Validate Shift Pattern
    if (!shiftPatternId || typeof shiftPatternId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Shift pattern ID is required.' },
        { status: 400 }
      );
    }

    const pattern = await prisma.shiftPattern.findFirst({
      where: {
        id: shiftPatternId,
        organizationId: auth.organization.id,
      },
    });

    if (!pattern) {
      return NextResponse.json(
        { success: false, error: 'Shift pattern not found in this organization.' },
        { status: 404 }
      );
    }

    if (!pattern.isActive) {
      return NextResponse.json(
        { success: false, error: 'Cannot assign an inactive shift pattern. Please reactivate it first.' },
        { status: 400 }
      );
    }

    // 2. Validate Staff Profile IDs
    if (!Array.isArray(staffProfileIds) || staffProfileIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Please select at least one staff member to assign.' },
        { status: 400 }
      );
    }

    const validStaff = await prisma.staffProfile.findMany({
      where: {
        id: { in: staffProfileIds },
        organizationId: auth.organization.id,
      },
      include: { user: { select: { status: true } } },
    });

    if (validStaff.length !== staffProfileIds.length) {
      return NextResponse.json(
        { success: false, error: 'One or more selected staff members do not belong to this organization.' },
        { status: 400 }
      );
    }

    // Check inactive staff
    const inactiveStaff = validStaff.filter((s) => s.user.status === 'INACTIVE');
    if (inactiveStaff.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot assign inactive staff members: ${inactiveStaff.map((s) => s.name).join(', ')}.`,
        },
        { status: 400 }
      );
    }

    // 3. Validate Effective Dates
    if (!effectiveFrom || typeof effectiveFrom !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) {
      return NextResponse.json(
        { success: false, error: 'Effective start date is required in YYYY-MM-DD format.' },
        { status: 400 }
      );
    }

    const startDate = parseIsoDayToDate(effectiveFrom);
    let endDate: Date | null = null;

    if (effectiveTo && typeof effectiveTo === 'string') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveTo)) {
        return NextResponse.json(
          { success: false, error: 'Effective end date must be in YYYY-MM-DD format.' },
          { status: 400 }
        );
      }
      endDate = parseIsoDayToDate(effectiveTo);
      if (endDate < startDate) {
        return NextResponse.json(
          { success: false, error: 'Effective end date cannot be earlier than start date.' },
          { status: 400 }
        );
      }
    }

    // 4. Run Conflict Prevention Engine on each staff member (Section 14, 24)
    for (const staff of validStaff) {
      const conflictCheck = await checkShiftAssignmentConflict(
        staff.id,
        startDate,
        endDate
      );

      if (conflictCheck.hasConflict) {
        return NextResponse.json(
          {
            success: false,
            error: `${staff.name} (${staff.staffId}) has a scheduling conflict: ${conflictCheck.message}`,
            conflictDetails: conflictCheck.conflictingAssignment,
          },
          { status: 409 }
        );
      }
    }

    const actorName = auth.session.user.name || auth.session.user.email;

    // 5. Transactional Creation of Shift Assignments
    const createdAssignments = await prisma.$transaction(
      async (tx) => {
        const created = [];
        for (const staff of validStaff) {
          const assignment = await tx.shiftAssignment.create({
            data: {
              staffProfileId: staff.id,
              shiftPatternId: pattern.id,
              effectiveFrom: startDate,
              effectiveTo: endDate,
              assignedBy: actorName,
            },
            include: {
              staffProfile: { select: { name: true, staffId: true } },
              shiftPattern: { select: { name: true } },
            },
          });
          created.push(assignment);
        }
        return created;
      },
      { maxWait: 15000, timeout: 30000 }
    );

    // 6. Record Audit Log
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    await recordAuditLog({
      organizationId: auth.organization.id,
      actorUserId: auth.session.user.id,
      action: 'SHIFT_ASSIGNED',
      entityType: 'ShiftAssignment',
      entityId: pattern.id,
      metadata: {
        patternName: pattern.name,
        assignedStaffCount: validStaff.length,
        effectiveFrom,
        effectiveTo: effectiveTo || null,
        staffIds: validStaff.map((s) => s.staffId),
      },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({
      success: true,
      message: `Shift pattern "${pattern.name}" assigned to ${validStaff.length} staff member(s).`,
      assignments: createdAssignments,
    });
  } catch (error: any) {
    console.error('Create shift assignments error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create shift assignments.' },
      { status: 500 }
    );
  }
}
