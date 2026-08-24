import { NextResponse } from 'next/server';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import { calculateWeeklyRoster } from '@/services/roster.service';
import { formatDateToIsoDay } from '@/lib/shift-validation';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { organizationCode: string } }
) {
  try {
    const auth = await requireOrgAdmin(params.organizationCode);
    if (!auth.authorized || !auth.organization) {
      return NextResponse.json(
        { success: false, error: auth.errorMessage },
        { status: auth.errorStatus || 401 }
      );
    }

    const { searchParams } = new URL(request.url);

    // Default to current week Monday to Sunday if not supplied
    let startDate = searchParams.get('startDate');
    let endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0 is Sun, 1 is Mon...
      const distanceToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(now);
      monday.setDate(now.getDate() + distanceToMon);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      startDate = formatDateToIsoDay(monday);
      endDate = formatDateToIsoDay(sunday);
    }

    const branchId = searchParams.get('branchId') || undefined;
    const staffId = searchParams.get('staffId') || undefined;
    const shiftPatternId = searchParams.get('shiftPatternId') || undefined;

    const roster = await calculateWeeklyRoster(auth.organization.id, startDate, endDate, {
      branchId,
      staffId,
      shiftPatternId,
    });

    return NextResponse.json({
      success: true,
      roster,
    });
  } catch (error: any) {
    console.error('Calculate weekly roster error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to calculate weekly roster.' },
      { status: 500 }
    );
  }
}
