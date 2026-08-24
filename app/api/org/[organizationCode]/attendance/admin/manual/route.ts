import { NextRequest, NextResponse } from 'next/server';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import { createAdminManualAttendance } from '@/services/attendance.service';

export async function POST(
  req: NextRequest,
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

    const { organization, session } = auth;
    const body = await req.json();
    const { staffProfileId, branchId, date, clockInTime, clockOutTime, reason, adminComment } = body;

    if (!staffProfileId || !date || !clockInTime || !reason?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Staff member, date, clock-in time, and reason are required.' },
        { status: 400 }
      );
    }

    const originUrl = req.nextUrl.origin;

    const result = await createAdminManualAttendance({
      organizationId: organization.id,
      adminUserId: session.user.id,
      staffProfileId,
      branchId,
      date,
      clockInTime,
      clockOutTime,
      reason: reason.trim(),
      adminComment,
      originUrl,
    });

    return NextResponse.json({
      success: true,
      message: 'Manual attendance recorded successfully.',
      records: result,
    });
  } catch (error: any) {
    console.error('Error creating manual attendance:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to record manual attendance.' },
      { status: 400 }
    );
  }
}
