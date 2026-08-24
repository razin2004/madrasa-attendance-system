import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/tenant-auth';
import { cancelStaffLeaveRequest } from '@/services/leave.service';

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

    const { organization, session, staffProfile } = auth;

    const cancelled = await cancelStaffLeaveRequest({
      organizationId: organization.id,
      requestId: params.requestId,
      staffProfileId: staffProfile.id,
      userId: session.user.id,
    });

    return NextResponse.json({
      success: true,
      message: 'Leave request cancelled successfully.',
      leaveRequest: cancelled,
    });
  } catch (error: any) {
    console.error('Error cancelling leave request:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to cancel leave request.' },
      { status: 400 }
    );
  }
}
