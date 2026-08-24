import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import { checkShiftAssignmentConflict } from '@/services/roster.service';
import { parseIsoDayToDate } from '@/lib/shift-validation';
import { recordAuditLog } from '@/services/audit.service';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  { params }: { params: { organizationCode: string; assignmentId: string } }
) {
  try {
    const auth = await requireOrgAdmin(params.organizationCode);
    if (!auth.authorized || !auth.organization || !auth.session) {
      return NextResponse.json(
        { success: false, error: auth.errorMessage },
        { status: auth.errorStatus || 401 }
      );
    }

    const assignment = await prisma.shiftAssignment.findFirst({
      where: {
        id: params.assignmentId,
        staffProfile: { organizationId: auth.organization.id },
      },
      include: {
        staffProfile: true,
        shiftPattern: true,
      },
    });

    if (!assignment) {
      return NextResponse.json(
        { success: false, error: 'Shift assignment not found or access denied.' },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { effectiveFrom, effectiveTo } = body;

    let startDate = assignment.effectiveFrom;
    let endDate = assignment.effectiveTo;

    if (effectiveFrom) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) {
        return NextResponse.json(
          { success: false, error: 'Effective start date must be in YYYY-MM-DD format.' },
          { status: 400 }
        );
      }
      startDate = parseIsoDayToDate(effectiveFrom);
    }

    if (effectiveTo !== undefined) {
      if (effectiveTo === null || effectiveTo === '') {
        endDate = null;
      } else {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveTo)) {
          return NextResponse.json(
            { success: false, error: 'Effective end date must be in YYYY-MM-DD format.' },
            { status: 400 }
          );
        }
        endDate = parseIsoDayToDate(effectiveTo);
      }
    }

    if (endDate && endDate < startDate) {
      return NextResponse.json(
        { success: false, error: 'Effective end date cannot be earlier than start date.' },
        { status: 400 }
      );
    }

    // Run conflict check excluding this assignment itself
    const conflictCheck = await checkShiftAssignmentConflict(
      assignment.staffProfileId,
      startDate,
      endDate,
      assignment.id
    );

    if (conflictCheck.hasConflict) {
      return NextResponse.json(
        { success: false, error: conflictCheck.message },
        { status: 409 }
      );
    }

    const updated = await prisma.shiftAssignment.update({
      where: { id: assignment.id },
      data: {
        effectiveFrom: startDate,
        effectiveTo: endDate,
      },
      include: {
        staffProfile: { select: { name: true, staffId: true } },
        shiftPattern: { select: { name: true } },
      },
    });

    // Record Audit Log
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    await recordAuditLog({
      organizationId: auth.organization.id,
      actorUserId: auth.session.user.id,
      action: 'SHIFT_ASSIGNMENT_UPDATED',
      entityType: 'ShiftAssignment',
      entityId: updated.id,
      metadata: {
        staffId: assignment.staffProfile.staffId,
        patternName: assignment.shiftPattern.name,
        effectiveFrom: startDate.toISOString().slice(0, 10),
        effectiveTo: endDate ? endDate.toISOString().slice(0, 10) : null,
      },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({
      success: true,
      message: 'Shift assignment date range updated.',
      assignment: updated,
    });
  } catch (error: any) {
    console.error('Update shift assignment error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update shift assignment.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { organizationCode: string; assignmentId: string } }
) {
  try {
    const auth = await requireOrgAdmin(params.organizationCode);
    if (!auth.authorized || !auth.organization || !auth.session) {
      return NextResponse.json(
        { success: false, error: auth.errorMessage },
        { status: auth.errorStatus || 401 }
      );
    }

    const assignment = await prisma.shiftAssignment.findFirst({
      where: {
        id: params.assignmentId,
        staffProfile: { organizationId: auth.organization.id },
      },
      include: {
        staffProfile: true,
        shiftPattern: true,
      },
    });

    if (!assignment) {
      return NextResponse.json(
        { success: false, error: 'Shift assignment not found or access denied.' },
        { status: 404 }
      );
    }

    await prisma.shiftAssignment.delete({
      where: { id: assignment.id },
    });

    // Record Audit Log
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    await recordAuditLog({
      organizationId: auth.organization.id,
      actorUserId: auth.session.user.id,
      action: 'SHIFT_ASSIGNMENT_REMOVED',
      entityType: 'ShiftAssignment',
      entityId: assignment.id,
      metadata: {
        staffId: assignment.staffProfile.staffId,
        staffName: assignment.staffProfile.name,
        patternName: assignment.shiftPattern.name,
      },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({
      success: true,
      message: `Shift assignment for ${assignment.staffProfile.name} removed.`,
    });
  } catch (error: any) {
    console.error('Delete shift assignment error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete shift assignment.' },
      { status: 500 }
    );
  }
}
