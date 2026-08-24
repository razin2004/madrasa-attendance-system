import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/tenant-auth';
import {
  submitAttendanceCorrectionRequest,
  getStaffCorrectionRequests,
} from '@/services/attendance.service';

export async function GET(
  req: NextRequest,
  { params }: { params: { organizationCode: string } }
) {
  try {
    const auth = await requireStaff(params.organizationCode);
    if (!auth.authorized || !auth.organization || !auth.staffProfile) {
      return NextResponse.json(
        { success: false, error: auth.errorMessage || 'Unauthorized.' },
        { status: auth.errorStatus || 401 }
      );
    }

    const requests = await getStaffCorrectionRequests(auth.staffProfile.id, auth.organization.id);

    return NextResponse.json({
      success: true,
      requests,
    });
  } catch (error: any) {
    console.error('Error fetching staff correction requests:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { organizationCode: string } }
) {
  try {
    const auth = await requireStaff(params.organizationCode);
    if (!auth.authorized || !auth.organization || !auth.session || !auth.staffProfile) {
      return NextResponse.json(
        { success: false, error: auth.errorMessage || 'Unauthorized.' },
        { status: auth.errorStatus || 401 }
      );
    }

    const { organization, session, staffProfile } = auth;
    const body = await req.json();
    const { type, date, requestedClockIn, requestedClockOut, reason, branchId } = body;

    if (!type || !date || !reason?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Correction type, target date, and reason are required.' },
        { status: 400 }
      );
    }

    const originUrl = req.nextUrl.origin;

    const request = await submitAttendanceCorrectionRequest({
      organizationId: organization.id,
      staffProfileId: staffProfile.id,
      userId: session.user.id,
      type,
      date,
      requestedClockIn,
      requestedClockOut,
      reason,
      branchId,
      originUrl,
    });

    return NextResponse.json({
      success: true,
      message: 'Attendance correction request submitted successfully.',
      correctionRequest: request,
    });
  } catch (error: any) {
    console.error('Error submitting correction request:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to submit correction request.' },
      { status: 400 }
    );
  }
}
