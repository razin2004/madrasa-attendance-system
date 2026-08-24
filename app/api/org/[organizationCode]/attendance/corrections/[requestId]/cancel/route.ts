import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/tenant-auth';
import { cancelAttendanceCorrection } from '@/services/attendance.service';

export async function POST(
  req: NextRequest,
  { params }: { params: { organizationCode: string; requestId: string } }
) {
  try {
    const auth = await requireStaff(params.organizationCode);
    if (!auth.authorized || !auth.organization || !auth.session || !auth.staffProfile) {
      return NextResponse.json(
        { success: false, error: auth.errorMessage || 'Unauthorized.' },
        { status: auth.errorStatus || 401 }
      );
    }

    const cancelled = await cancelAttendanceCorrection({
      organizationId: auth.organization.id,
      requestId: params.requestId,
      staffProfileId: auth.staffProfile.id,
      userId: auth.session.user.id,
    });

    return NextResponse.json({
      success: true,
      message: 'Correction request cancelled successfully.',
      correctionRequest: cancelled,
    });
  } catch (error: any) {
    console.error('Error cancelling correction request:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to cancel correction request.' },
      { status: 400 }
    );
  }
}
