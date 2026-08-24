import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/tenant-auth';
import { getStaffCorrectionRequests } from '@/services/attendance.service';

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
    console.error('Error fetching corrections:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}
