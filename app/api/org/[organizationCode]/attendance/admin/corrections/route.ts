import { NextRequest, NextResponse } from 'next/server';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import { getAdminCorrectionRequests } from '@/services/attendance.service';
import { CorrectionRequestStatus, CorrectionRequestType } from '@prisma/client';

export async function GET(
  req: NextRequest,
  { params }: { params: { organizationCode: string } }
) {
  try {
    const auth = await requireOrgAdmin(params.organizationCode);
    if (!auth.authorized || !auth.organization) {
      return NextResponse.json(
        { success: false, error: auth.errorMessage || 'Unauthorized.' },
        { status: auth.errorStatus || 401 }
      );
    }

    const { searchParams } = req.nextUrl;
    const status = (searchParams.get('status') as CorrectionRequestStatus) || undefined;
    const type = (searchParams.get('type') as CorrectionRequestType) || undefined;
    const branchId = searchParams.get('branchId') || undefined;
    const staffProfileId = searchParams.get('staffProfileId') || undefined;
    const search = searchParams.get('search') || undefined;

    const data = await getAdminCorrectionRequests({
      organizationId: auth.organization.id,
      status,
      type,
      branchId,
      staffProfileId,
      search,
    });

    return NextResponse.json({
      success: true,
      ...data,
    });
  } catch (error: any) {
    console.error('Error fetching admin correction requests:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}
