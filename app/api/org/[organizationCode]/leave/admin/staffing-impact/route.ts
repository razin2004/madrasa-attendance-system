import { NextRequest, NextResponse } from 'next/server';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import { calculateStaffingImpact } from '@/services/leave.service';

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

    const { organization } = auth;
    const { searchParams } = req.nextUrl;

    const staffProfileId = searchParams.get('staffProfileId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!staffProfileId || !startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: 'staffProfileId, startDate, and endDate are required.' },
        { status: 400 }
      );
    }

    const impact = await calculateStaffingImpact(
      organization.id,
      staffProfileId,
      new Date(startDate),
      new Date(endDate)
    );

    return NextResponse.json({
      success: true,
      impact,
    });
  } catch (error: any) {
    console.error('Error calculating staffing impact:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}
