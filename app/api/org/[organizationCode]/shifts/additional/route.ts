import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import { checkStaffShiftIntersection } from '@/lib/shift-intersection';
import { sendEmail } from '@/services/email.service';
import { templateAdditionalShiftAssigned } from '@/services/email-templates';

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
    const { staffProfileIds, date, startTime, endTime, title, notes } = body;

    if (!staffProfileIds || !Array.isArray(staffProfileIds) || staffProfileIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one staff member must be selected.' },
        { status: 400 }
      );
    }

    if (!date || !startTime || !endTime) {
      return NextResponse.json(
        { success: false, error: 'Date, start time, and end time are required.' },
        { status: 400 }
      );
    }

    const [year, month, day] = date.split('-').map(Number);
    if (!year || !month || !day) {
      return NextResponse.json({ success: false, error: 'Invalid date format (YYYY-MM-DD).' }, { status: 400 });
    }

    const targetDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const isOvernight = endH * 60 + endM <= startH * 60 + startM;

    // 1. Run Intersection Validation for EACH selected staff member
    for (const staffProfileId of staffProfileIds) {
      const check = await checkStaffShiftIntersection({
        staffProfileId,
        date: targetDate,
        startTime,
        endTime,
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

    // 2. Create Additional Shifts in Prisma transaction
    const createdShifts = await prisma.$transaction(
      staffProfileIds.map((staffProfileId) =>
        prisma.additionalShift.create({
          data: {
            organizationId: org.id,
            staffProfileId,
            date: targetDate,
            startTime,
            endTime,
            isOvernight,
            title: title || 'Additional Shift',
            notes: notes || null,
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

    // 3. Dispatch Email Notifications asynchronously
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const loginUrl = `${baseUrl}/${params.organizationCode.toLowerCase()}/login`;

    for (const shift of createdShifts) {
      const recipientEmail = shift.staffProfile.user?.email;
      if (recipientEmail) {
        const emailTemplate = templateAdditionalShiftAssigned({
          staffName: shift.staffProfile.name,
          orgName: org.name,
          date,
          startTime,
          endTime,
          title: shift.title,
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

    await prisma.additionalShift.delete({
      where: { id },
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
