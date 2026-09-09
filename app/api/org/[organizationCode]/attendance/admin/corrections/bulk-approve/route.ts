import { NextRequest, NextResponse } from 'next/server';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import { bulkApproveAttendanceCorrections } from '@/services/attendance.service';

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

    const body = await req.json().catch(() => ({}));
    const { requestIds, comment } = body;

    if (!Array.isArray(requestIds) || requestIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Please provide at least one correction request ID.' },
        { status: 400 }
      );
    }

    const originUrl = req.nextUrl.origin;
    const result = await bulkApproveAttendanceCorrections({
      organizationId: auth.organization.id,
      requestIds,
      reviewerUserId: auth.session.user.id,
      reviewerComment: comment,
      originUrl,
    });

    return NextResponse.json({
      success: true,
      message: `Bulk approval complete: ${result.successCount} approved, ${result.failedCount} failed.`,
      result,
    });
  } catch (error: any) {
    console.error('Error in bulk approval:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Bulk approval failed.' },
      { status: 500 }
    );
  }
}
