import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/tenant-auth';
import { getStaffMonthlyAttendanceSummary } from '@/services/attendance.service';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { organizationCode: string } }
) {
  try {
    const auth = await requireStaff(params.organizationCode);
    if (!auth.authorized || !auth.organization || !auth.staffProfile) {
      return NextResponse.json(
        { success: false, error: auth.errorMessage },
        { status: auth.errorStatus || 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const now = new Date();
    const year = parseInt(searchParams.get('year') || String(now.getFullYear()), 10);
    const month = parseInt(searchParams.get('month') || String(now.getMonth() + 1), 10);

    const summary = await getStaffMonthlyAttendanceSummary(
      auth.staffProfile.id,
      year,
      month
    );

    return NextResponse.json({
      success: true,
      summary,
      records: summary.records || [],
    });
  } catch (error: any) {
    console.error('Attendance history error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve attendance history.' },
      { status: 500 }
    );
  }
}
