import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/tenant-auth';
import { getCorrectionRequestDetail } from '@/services/attendance.service';

export async function GET(
  req: NextRequest,
  { params }: { params: { organizationCode: string; requestId: string } }
) {
  try {
    const auth = await requireStaff(params.organizationCode);
    if (!auth.authorized || !auth.organization || !auth.staffProfile) {
      return NextResponse.json(
        { success: false, error: auth.errorMessage || 'Unauthorized.' },
        { status: auth.errorStatus || 401 }
      );
    }

    const detail = await getCorrectionRequestDetail(params.requestId, auth.organization.id);

    if (!detail || detail.request.staffProfileId !== auth.staffProfile.id) {
      return NextResponse.json(
        { success: false, error: 'Correction request not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      request: detail.request,
      existingRecords: detail.existingRecords,
    });
  } catch (error: any) {
    console.error('Error fetching correction request detail:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}
