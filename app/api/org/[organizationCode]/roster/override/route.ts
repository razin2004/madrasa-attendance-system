import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import { isValidTimeString, isOvernightShift, parseIsoDayToDate } from '@/lib/shift-validation';
import { recordAuditLog } from '@/services/audit.service';

export const dynamic = 'force-dynamic';

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
    const { staffProfileId, date, isHoliday = false, startTime, endTime, reason } = body;

    // 1. Validate staff belongs to this organization
    if (!staffProfileId || typeof staffProfileId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Staff profile ID is required.' },
        { status: 400 }
      );
    }

    const staff = await prisma.staffProfile.findFirst({
      where: {
        id: staffProfileId,
        organizationId: auth.organization.id,
      },
    });

    if (!staff) {
      return NextResponse.json(
        { success: false, error: 'Staff member not found or access denied.' },
        { status: 404 }
      );
    }

    // 2. Validate date
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { success: false, error: 'Target date must be in YYYY-MM-DD format.' },
        { status: 400 }
      );
    }

    const targetDate = parseIsoDayToDate(date);

    // 3. Validate Working Day vs Holiday
    let cleanStart: string | null = null;
    let cleanEnd: string | null = null;
    let overnight = false;

    if (!isHoliday) {
      if (!isValidTimeString(startTime)) {
        return NextResponse.json(
          { success: false, error: 'A valid start time (HH:mm) is required for working day override.' },
          { status: 400 }
        );
      }
      if (!isValidTimeString(endTime)) {
        return NextResponse.json(
          { success: false, error: 'A valid end time (HH:mm) is required for working day override.' },
          { status: 400 }
        );
      }
      cleanStart = (startTime as string).trim();
      cleanEnd = (endTime as string).trim();
      overnight = isOvernightShift(cleanStart, cleanEnd);
    }

    const actorName = auth.session.user.name || auth.session.user.email;

    // Upsert StaffShiftOverride record (Section 17)
    const override = await prisma.staffShiftOverride.upsert({
      where: {
        staffProfileId_date: {
          staffProfileId: staff.id,
          date: targetDate,
        },
      },
      create: {
        staffProfileId: staff.id,
        date: targetDate,
        isHoliday: !!isHoliday,
        startTime: cleanStart,
        endTime: cleanEnd,
        isOvernight: overnight,
        reason: reason?.trim() || null,
        createdBy: actorName,
      },
      update: {
        isHoliday: !!isHoliday,
        startTime: cleanStart,
        endTime: cleanEnd,
        isOvernight: overnight,
        reason: reason?.trim() || null,
        createdBy: actorName,
      },
    });

    // Record Audit Log
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    await recordAuditLog({
      organizationId: auth.organization.id,
      actorUserId: auth.session.user.id,
      action: 'STAFF_SHIFT_OVERRIDE_CREATED',
      entityType: 'StaffShiftOverride',
      entityId: override.id,
      metadata: {
        staffId: staff.staffId,
        staffName: staff.name,
        date,
        isHoliday,
        startTime: cleanStart,
        endTime: cleanEnd,
        reason,
      },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({
      success: true,
      message: `Shift override applied for ${staff.name} on ${date}.`,
      override,
    });
  } catch (error: any) {
    console.error('Create staff shift override error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to apply staff shift override.' },
      { status: 500 }
    );
  }
}
