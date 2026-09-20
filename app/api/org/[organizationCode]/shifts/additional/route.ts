import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import { checkStaffShiftIntersection } from '@/lib/shift-intersection';
import { sendEmail } from '@/services/email.service';
import { templateAdditionalShiftAssigned } from '@/services/email-templates';
import { Weekday } from '@prisma/client';

export const dynamic = 'force-dynamic';

/**
 * GET /api/org/[organizationCode]/shifts/additional
 * List additional shifts for organization
 */
export async function GET(
  request: Request,
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

    const org = auth.organization;
    const url = new URL(request.url);
    const dateStr = url.searchParams.get('date');
    const staffId = url.searchParams.get('staffId');

    let dateFilter: any = undefined;
    if (dateStr) {
      const [year, month, day] = dateStr.split('-').map(Number);
      dateFilter = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    }

    const additionalShifts = await prisma.additionalShift.findMany({
      where: {
        organizationId: org.id,
        ...(dateFilter ? { date: dateFilter } : {}),
        ...(staffId ? { staffProfileId: staffId } : {}),
      },
      include: {
        staffProfile: {
          select: {
            id: true,
            name: true,
            staffId: true,
            user: { select: { email: true } },
          },
        },
      },
      orderBy: [{ date: 'desc' }, { startTime: 'asc' }],
    });

    return NextResponse.json({
      success: true,
      additionalShifts: additionalShifts.map((s) => ({
        id: s.id,
        staffProfileId: s.staffProfileId,
        staffName: s.staffProfile.name,
        staffId: s.staffProfile.staffId,
        staffEmail: s.staffProfile.user?.email,
        date: s.date.toISOString().split('T')[0],
        startTime: s.startTime,
        endTime: s.endTime,
        isOvernight: s.isOvernight,
        title: s.title || 'Additional Shift',
        notes: s.notes,
        createdAt: s.createdAt,
      })),
    });
  } catch (error: any) {
    console.error('Fetch additional shifts error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch additional shifts.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/org/[organizationCode]/shifts/additional
 * Assign Additional Shift to single staff or bulk list of staff members
 */
export async function POST(
  request: Request,
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

    const org = auth.organization;
    const body = await request.json().catch(() => ({}));
    const { staffProfileIds, date, shiftPatternId, startTime, endTime, title, notes } = body;

    if (!staffProfileIds || !Array.isArray(staffProfileIds) || staffProfileIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one staff member must be selected.' },
        { status: 400 }
      );
    }

    if (!date) {
      return NextResponse.json(
        { success: false, error: 'Date is required.' },
        { status: 400 }
      );
    }

    const [year, month, day] = date.split('-').map(Number);
    if (!year || !month || !day) {
      return NextResponse.json({ success: false, error: 'Invalid date format (YYYY-MM-DD).' }, { status: 400 });
    }

    const targetDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));

    let shiftStartTime = startTime;
    let shiftEndTime = endTime;
    let shiftIsOvernight = false;
    let shiftTitle = title ? title.trim() : 'Additional Shift';

    // If preset normal shift pattern selected, determine shift timing and title from pattern configuration
    if (shiftPatternId) {
      const shiftPattern = await prisma.shiftPattern.findFirst({
        where: { id: shiftPatternId, organizationId: org.id },
        include: { weeklyDays: true },
      });

      if (!shiftPattern) {
        return NextResponse.json({ success: false, error: 'Selected shift pattern not found.' }, { status: 404 });
      }

      shiftTitle = shiftPattern.name;

      const weekdayNames: Weekday[] = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
      const targetWeekday = weekdayNames[targetDate.getUTCDay()];
      const dayConfig = shiftPattern.weeklyDays.find((w) => w.weekday === targetWeekday);

      if (dayConfig && !dayConfig.isHoliday && dayConfig.startTime && dayConfig.endTime) {
        shiftStartTime = dayConfig.startTime;
        shiftEndTime = dayConfig.endTime;
        shiftIsOvernight = dayConfig.isOvernight;
      } else {
        const validDay = shiftPattern.weeklyDays.find((w) => !w.isHoliday && w.startTime && w.endTime);
        if (validDay && validDay.startTime && validDay.endTime) {
          shiftStartTime = validDay.startTime;
          shiftEndTime = validDay.endTime;
          shiftIsOvernight = validDay.isOvernight;
        }
      }
    }

    if (!shiftStartTime || !shiftEndTime) {
      return NextResponse.json(
        { success: false, error: 'Start time and end time are required for the additional shift.' },
        { status: 400 }
      );
    }

    const [startH, startM] = shiftStartTime.split(':').map(Number);
    const [endH, endM] = shiftEndTime.split(':').map(Number);
    shiftIsOvernight = endH * 60 + endM <= startH * 60 + startM;

    // Run Intersection & Approved Leave Validation for EACH selected staff member
    for (const staffProfileId of staffProfileIds) {
      const staff = await prisma.staffProfile.findUnique({
        where: { id: staffProfileId },
        select: { name: true },
      });

      const approvedLeave = await prisma.leaveRequest.findFirst({
        where: {
          staffProfileId,
          status: 'APPROVED',
          startDate: { lte: targetDate },
          endDate: { gte: targetDate },
        },
      });

      if (approvedLeave) {
        return NextResponse.json(
          {
            success: false,
            error: `Cannot assign additional shift to ${staff?.name || 'Staff Member'}: Staff is on approved leave for this date (${date}).`,
          },
          { status: 400 }
        );
      }

      const check = await checkStaffShiftIntersection({
        staffProfileId,
        date: targetDate,
        startTime: shiftStartTime,
        endTime: shiftEndTime,
      });

      if (check.intersects) {
        return NextResponse.json(
          {
            success: false,
            error: check.reason || `Shift time for ${date} intersects with an existing shift.`,
          },
          { status: 400 }
        );
      }
    }

    // Create Additional Shifts strictly in AdditionalShift table (without modifying permanent ShiftAssignments)
    const createdShifts = await prisma.$transaction(
      staffProfileIds.map((staffProfileId) =>
        prisma.additionalShift.create({
          data: {
            organizationId: org.id,
            staffProfileId,
            date: targetDate,
            startTime: shiftStartTime,
            endTime: shiftEndTime,
            isOvernight: shiftIsOvernight,
            title: shiftTitle,
            notes: notes ? notes.trim() : null,
            createdBy: auth.session!.user.id,
          },
          include: {
            staffProfile: {
              select: {
                name: true,
                staffId: true,
                user: { select: { email: true } },
              },
            },
          },
        })
      )
    );

    // Dispatch Email Notifications asynchronously
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const loginUrl = `${baseUrl}/${params.organizationCode.toLowerCase()}/login`;

    for (const shift of createdShifts) {
      const recipientEmail = shift.staffProfile.user?.email;
      if (recipientEmail) {
        const emailTemplate = templateAdditionalShiftAssigned({
          staffName: shift.staffProfile.name,
          orgName: org.name,
          date,
          startTime: shift.startTime,
          endTime: shift.endTime,
          title: shift.title || 'Additional Shift',
          notes: shift.notes,
          loginUrl,
        });

        sendEmail({
          recipient: recipientEmail,
          type: 'ADDITIONAL_SHIFT_ASSIGNED',
          subject: emailTemplate.subject,
          htmlContent: emailTemplate.html,
          textContent: emailTemplate.text,
          organizationId: org.id,
        }).catch((err) => console.error('Failed to send additional shift email:', err));
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully assigned additional shift for ${createdShifts.length} staff member(s).`,
      count: createdShifts.length,
    });
  } catch (error: any) {
    console.error('Assign additional shift error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to assign additional shift.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/org/[organizationCode]/shifts/additional
 * Remove an additional shift
 */
export async function DELETE(
  request: Request,
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

    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Additional shift ID is required.' }, { status: 400 });
    }

    const existingShift = await prisma.additionalShift.findFirst({
      where: {
        id,
        organizationId: auth.organization.id,
      },
    });

    if (!existingShift) {
      return NextResponse.json(
        { success: false, error: 'Additional shift not found or access denied.' },
        { status: 404 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.attendanceRecord.updateMany({
        where: { additionalShiftId: id },
        data: { additionalShiftId: null, isAdditionalShift: false },
      });

      await tx.additionalShift.delete({
        where: { id },
      });
    });

    return NextResponse.json({ success: true, message: 'Additional shift removed.' });
  } catch (error: any) {
    console.error('Delete additional shift error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete additional shift.' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/org/[organizationCode]/shifts/additional
 * Update an existing additional shift
 */
export async function PUT(
  request: Request,
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

    const org = auth.organization;
    const body = await request.json().catch(() => ({}));
    const { id, staffProfileId, date, startTime, endTime, title, notes } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Additional shift ID is required.' }, { status: 400 });
    }

    const existingShift = await prisma.additionalShift.findFirst({
      where: { id, organizationId: org.id },
    });

    if (!existingShift) {
      return NextResponse.json({ success: false, error: 'Additional shift not found.' }, { status: 404 });
    }

    const targetStaffId = staffProfileId || existingShift.staffProfileId;
    const targetDateStr = date || existingShift.date.toISOString().split('T')[0];
    const targetStartTime = startTime || existingShift.startTime;
    const targetEndTime = endTime || existingShift.endTime;
    const targetTitle = title !== undefined ? title.trim() : existingShift.title;

    const [year, month, day] = targetDateStr.split('-').map(Number);
    const targetDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));

    const [startH, startM] = targetStartTime.split(':').map(Number);
    const [endH, endM] = targetEndTime.split(':').map(Number);
    const isOvernight = endH * 60 + endM <= startH * 60 + startM;

    // Check intersection excluding this current additional shift ID
    const check = await checkStaffShiftIntersection({
      staffProfileId: targetStaffId,
      date: targetDate,
      startTime: targetStartTime,
      endTime: targetEndTime,
      excludeAdditionalShiftId: id,
    });

    if (check.intersects) {
      return NextResponse.json(
        { success: false, error: check.reason || 'Shift time intersects with an existing schedule.' },
        { status: 400 }
      );
    }

    const updated = await prisma.additionalShift.update({
      where: { id },
      data: {
        staffProfileId: targetStaffId,
        date: targetDate,
        startTime: targetStartTime,
        endTime: targetEndTime,
        isOvernight,
        title: targetTitle || 'Additional Shift',
        notes: notes !== undefined ? (notes ? notes.trim() : null) : existingShift.notes,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Additional shift updated successfully.',
      additionalShift: updated,
    });
  } catch (error: any) {
    console.error('Update additional shift error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update additional shift.' },
      { status: 500 }
    );
  }
}
