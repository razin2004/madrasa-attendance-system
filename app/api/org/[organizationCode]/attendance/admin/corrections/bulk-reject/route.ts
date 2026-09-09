import { NextRequest, NextResponse } from 'next/server';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import { bulkRejectAttendanceCorrections } from '@/services/attendance.service';

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
    const { requestIds, rejectionReason } = body;

    if (!Array.isArray(requestIds) || requestIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Please provide at least one correction request ID.' },
        { status: 400 }
      );
    }

    if (!rejectionReason || !rejectionReason.trim()) {
      return NextResponse.json(
        { success: false, error: 'Rejection reason is required for bulk rejection.' },
        { status: 400 }
      );
    }

    const originUrl = req.nextUrl.origin;
    const result = await bulkRejectAttendanceCorrections({
      organizationId: auth.organization.id,
      requestIds,
      reviewerUserId: auth.session.user.id,
      rejectionReason: rejectionReason.trim(),
      originUrl,
    });

    return NextResponse.json({
      success: true,
      message: `Bulk rejection complete: ${result.successCount} rejected, ${result.failedCount} failed.`,
      result,
    });
  } catch (error: any) {
    console.error('Error in bulk rejection:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Bulk rejection failed.' },
      { status: 500 }
    );
  }
}
