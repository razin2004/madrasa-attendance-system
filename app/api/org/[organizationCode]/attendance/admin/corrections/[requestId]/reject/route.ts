import { NextRequest, NextResponse } from 'next/server';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import { rejectAttendanceCorrection } from '@/services/attendance.service';

export async function POST(
  req: NextRequest,
  { params }: { params: { organizationCode: string; requestId: string } }
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
    const body = await req.json().catch(() => ({}));
    const { rejectionReason } = body;

    if (!rejectionReason || !rejectionReason.trim()) {
      return NextResponse.json(
        { success: false, error: 'A rejection reason is required.' },
        { status: 400 }
      );
    }

    const originUrl = req.nextUrl.origin;

    const rejected = await rejectAttendanceCorrection({
      organizationId: organization.id,
      requestId: params.requestId,
      reviewerUserId: session.user.id,
      rejectionReason: rejectionReason.trim(),
      originUrl,
    });

    return NextResponse.json({
      success: true,
      message: 'Attendance correction request rejected.',
      correctionRequest: rejected,
    });
  } catch (error: any) {
    console.error('Error rejecting attendance correction:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to reject correction request.' },
      { status: 400 }
    );
  }
}
