import { NextResponse } from 'next/server';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import { calculateRosterDayDetail } from '@/services/roster.service';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { organizationCode: string; date: string } }
) {
  try {
    const auth = await requireOrgAdmin(params.organizationCode);
    if (!auth.authorized || !auth.organization) {
      return NextResponse.json(
        { success: false, error: auth.errorMessage },
        { status: auth.errorStatus || 401 }
      );
    }

    const { date } = params;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { success: false, error: 'Target date must be in YYYY-MM-DD format.' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId') || undefined;

    const dayDetail = await calculateRosterDayDetail(auth.organization.id, date, branchId);

    return NextResponse.json({
      success: true,
      dayDetail,
    });
  } catch (error: any) {
    console.error('Calculate day roster detail error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to calculate day roster detail.' },
      { status: 500 }
    );
  }
}
