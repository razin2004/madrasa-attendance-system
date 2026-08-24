import { NextRequest, NextResponse } from 'next/server';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import { approveAttendanceCorrection } from '@/services/attendance.service';

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
    const { comment } = body;
    const originUrl = req.nextUrl.origin;

    const approved = await approveAttendanceCorrection({
      organizationId: organization.id,
      requestId: params.requestId,
      reviewerUserId: session.user.id,
      reviewerComment: comment,
      originUrl,
    });

    return NextResponse.json({
      success: true,
      message: 'Attendance correction approved successfully.',
      correctionRequest: approved,
    });
  } catch (error: any) {
    console.error('Error approving attendance correction:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to approve correction request.' },
      { status: 400 }
    );
  }
}
