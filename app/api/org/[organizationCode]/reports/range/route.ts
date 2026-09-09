import { NextRequest, NextResponse } from 'next/server';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import { getDateRangeAttendanceReport } from '@/services/reports.service';
import { AttendanceSource } from '@prisma/client';

export async function GET(
  req: NextRequest,
  { params }: { params: { organizationCode: string } }
) {
  try {
    const auth = await requireOrgAdmin(params.organizationCode);
    if (!auth.authorized || !auth.organization) {
      return NextResponse.json(
        { success: false, error: auth.errorMessage || 'Unauthorized access.' },
        { status: auth.errorStatus || 401 }
      );
    }

    const { searchParams } = req.nextUrl;
    const todayStr = new Date().toISOString().slice(0, 10);
    const sevenDaysAgoStr = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const startDate = searchParams.get('startDate') || sevenDaysAgoStr;
    const endDate = searchParams.get('endDate') || todayStr;
    const branchId = searchParams.get('branchId') || undefined;
    const staffId = searchParams.get('staffId') || undefined;
    const status = searchParams.get('status') || undefined;
    const source = (searchParams.get('source') as AttendanceSource) || undefined;
    const search = searchParams.get('search') || undefined;

    const report = await getDateRangeAttendanceReport({
      organizationId: auth.organization.id,
      startDate,
      endDate,
      branchId,
      staffId,
      status,
      source,
      search,
    });

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (error: any) {
    console.error('Error calculating date range attendance report:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}
