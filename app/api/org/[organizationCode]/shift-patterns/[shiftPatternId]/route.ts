import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import { validateWeeklyShiftSchedule } from '@/lib/shift-validation';
import { recordAuditLog } from '@/services/audit.service';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { organizationCode: string; shiftPatternId: string } }
) {
  try {
    const auth = await requireOrgAdmin(params.organizationCode);
    if (!auth.authorized || !auth.organization) {
      return NextResponse.json(
        { success: false, error: auth.errorMessage },
        { status: auth.errorStatus || 401 }
      );
    }

    const shiftPattern = await prisma.shiftPattern.findFirst({
      where: {
        id: params.shiftPatternId,
        organizationId: auth.organization.id,
      },
      include: {
        weeklyDays: true,
        assignments: {
          include: {
            staffProfile: {
              select: {
                id: true,
                staffId: true,
                name: true,
                phone: true,
                user: { select: { status: true } },
                branchAssignments: {
                  include: {
                    branch: { select: { id: true, name: true } },
                  },
                },
              },
            },
          },
          orderBy: { effectiveFrom: 'desc' },
        },
      },
    });

    if (!shiftPattern) {
      return NextResponse.json(
        { success: false, error: 'Shift pattern not found or access denied.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      shiftPattern,
    });
  } catch (error: any) {
    console.error('Fetch shift pattern error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve shift pattern details.' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { organizationCode: string; shiftPatternId: string } }
) {
  try {
    const auth = await requireOrgAdmin(params.organizationCode);
    if (!auth.authorized || !auth.organization || !auth.session) {
      return NextResponse.json(
        { success: false, error: auth.errorMessage },
        { status: auth.errorStatus || 401 }
      );
    }

    const existingPattern = await prisma.shiftPattern.findFirst({
      where: {
        id: params.shiftPatternId,
        organizationId: auth.organization.id,
      },
    });

    if (!existingPattern) {
      return NextResponse.json(
        { success: false, error: 'Shift pattern not found or access denied.' },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { name, description, minimumStaffingThreshold, days } = body;

    const updateData: any = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2) {
        return NextResponse.json(
          { success: false, error: 'Shift pattern name must be at least 2 characters.' },
          { status: 400 }
        );
      }
      const cleanName = name.trim();
      if (cleanName !== existingPattern.name) {
        const dup = await prisma.shiftPattern.findFirst({
          where: {
            organizationId: auth.organization.id,
            name: { equals: cleanName, mode: 'insensitive' },
            id: { not: existingPattern.id },
          },
        });
        if (dup) {
          return NextResponse.json(
            { success: false, error: `A shift pattern named "${cleanName}" already exists.` },
            { status: 409 }
          );
        }
        updateData.name = cleanName;
      }
    }

    if (description !== undefined) {
      updateData.description = typeof description === 'string' ? description.trim() : null;
    }

    if (minimumStaffingThreshold !== undefined) {
      const thresholdNum = Number(minimumStaffingThreshold);
      if (isNaN(thresholdNum) || thresholdNum < 1) {
        return NextResponse.json(
          { success: false, error: 'Minimum staffing threshold must be at least 1.' },
          { status: 400 }
        );
      }
      updateData.minimumStaffingThreshold = thresholdNum;
    }

    let validatedDays: any[] | null = null;
    if (days !== undefined) {
      const scheduleValidation = validateWeeklyShiftSchedule(days);
      if (!scheduleValidation.isValid || !scheduleValidation.validatedDays) {
        return NextResponse.json(
          { success: false, error: scheduleValidation.errors[0] || 'Invalid weekly schedule.' },
          { status: 400 }
        );
      }
      validatedDays = scheduleValidation.validatedDays;
    }

    // Execute update transaction
    const updatedPattern = await prisma.$transaction(
      async (tx) => {
        const pattern = await tx.shiftPattern.update({
          where: { id: existingPattern.id },
          data: updateData,
        });

        if (validatedDays) {
          // Delete old days and re-create
          await tx.weeklyShiftDay.deleteMany({
            where: { shiftPatternId: pattern.id },
          });

          await tx.weeklyShiftDay.createMany({
            data: validatedDays.map((d) => ({
              shiftPatternId: pattern.id,
              weekday: d.weekday,
              isHoliday: d.isHoliday,
              startTime: d.startTime,
              endTime: d.endTime,
              isOvernight: d.isOvernight,
            })),
          });
        }

        return pattern;
      },
      { maxWait: 15000, timeout: 30000 }
    );

    // Record Audit Log
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    await recordAuditLog({
      organizationId: auth.organization.id,
      actorUserId: auth.session.user.id,
      action: 'SHIFT_PATTERN_UPDATED',
      entityType: 'ShiftPattern',
      entityId: updatedPattern.id,
      metadata: {
        patternId: updatedPattern.id,
        name: updatedPattern.name,
      },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent'),
    });

    const fullPattern = await prisma.shiftPattern.findUnique({
      where: { id: updatedPattern.id },
      include: { weeklyDays: true },
    });

    return NextResponse.json({
      success: true,
      message: 'Shift pattern updated successfully.',
      shiftPattern: fullPattern,
    });
  } catch (error: any) {
    console.error('Update shift pattern error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update shift pattern.' },
      { status: 500 }
    );
  }
}
