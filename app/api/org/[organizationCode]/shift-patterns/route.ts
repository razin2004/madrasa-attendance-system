import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import { validateWeeklyShiftSchedule } from '@/lib/shift-validation';
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

    const shiftPatterns = await prisma.shiftPattern.findMany({
      where: { organizationId: auth.organization.id },
      include: {
        weeklyDays: {
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: { assignments: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formattedPatterns = shiftPatterns.map((p) => ({
      ...p,
      assignedStaffCount: p._count.assignments,
    }));

    return NextResponse.json({
      success: true,
      shiftPatterns: formattedPatterns,
      patterns: formattedPatterns,
      counts: {
        total: shiftPatterns.length,
        active: shiftPatterns.filter((p) => p.isActive).length,
        inactive: shiftPatterns.filter((p) => !p.isActive).length,
      },
    });
  } catch (error: any) {
    console.error('List shift patterns error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve shift patterns.' },
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
    const { name, description, minimumStaffingThreshold = 1, days = [] } = body;

    // 1. Validate Shift Pattern Name (Section 5)
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: 'Shift pattern name must be at least 2 characters.' },
        { status: 400 }
      );
    }

    const cleanName = name.trim();

    // Check duplicate name within the organization
    const existing = await prisma.shiftPattern.findFirst({
      where: {
        organizationId: auth.organization.id,
        name: { equals: cleanName, mode: 'insensitive' },
      },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: `A shift pattern named "${cleanName}" already exists in your organization.` },
        { status: 409 }
      );
    }

    // 2. Validate Minimum Staffing Threshold (Section 8)
    const thresholdNum = Number(minimumStaffingThreshold);
    if (isNaN(thresholdNum) || thresholdNum < 1) {
      return NextResponse.json(
        { success: false, error: 'Minimum staffing threshold must be a positive integer (at least 1).' },
        { status: 400 }
      );
    }

    // 3. Validate 7-day weekly schedule (Section 4, 6, 7)
    const scheduleValidation = validateWeeklyShiftSchedule(days);
    if (!scheduleValidation.isValid || !scheduleValidation.validatedDays) {
      return NextResponse.json(
        { success: false, error: scheduleValidation.errors[0] || 'Invalid weekly schedule.' },
        { status: 400 }
      );
    }

    // 4. Transactional creation of ShiftPattern and WeeklyShiftDay records
    const newPattern = await prisma.$transaction(
      async (tx) => {
        const pattern = await tx.shiftPattern.create({
          data: {
            organizationId: auth.organization!.id,
            name: cleanName,
            description: description?.trim() || null,
            minimumStaffingThreshold: thresholdNum,
            isActive: true,
          },
        });

        await tx.weeklyShiftDay.createMany({
          data: scheduleValidation.validatedDays!.map((d) => ({
            shiftPatternId: pattern.id,
            weekday: d.weekday,
            isHoliday: d.isHoliday,
            startTime: d.startTime,
            endTime: d.endTime,
            isOvernight: d.isOvernight,
          })),
        });

        return pattern;
      },
      { maxWait: 15000, timeout: 30000 }
    );

    // 5. Record Audit Log
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    await recordAuditLog({
      organizationId: auth.organization.id,
      actorUserId: auth.session.user.id,
      action: 'SHIFT_PATTERN_CREATED',
      entityType: 'ShiftPattern',
      entityId: newPattern.id,
      metadata: {
        name: cleanName,
        minimumStaffingThreshold: thresholdNum,
      },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent'),
    });

    const fullPattern = await prisma.shiftPattern.findUnique({
      where: { id: newPattern.id },
      include: { weeklyDays: true },
    });

    return NextResponse.json({
      success: true,
      message: `Shift pattern "${cleanName}" created successfully.`,
      shiftPattern: fullPattern,
    });
  } catch (error: any) {
    console.error('Create shift pattern error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create shift pattern.' },
      { status: 500 }
    );
  }
}
