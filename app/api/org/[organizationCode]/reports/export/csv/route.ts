import { NextRequest, NextResponse } from 'next/server';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import {
  getDailyAttendanceReport,
  getMonthlyEmployeeAttendanceReport,
  getDateRangeAttendanceReport,
} from '@/services/reports.service';
import { generateAttendanceReportCsv } from '@/services/export-csv.service';
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
    const rawReportType = searchParams.get('reportType');
    const reportType = rawReportType === 'RANGE' ? 'RANGE' : rawReportType === 'MONTHLY' ? 'MONTHLY' : 'DAILY';
    const date = searchParams.get('date') || new Date().toISOString().slice(0, 10);
    const startDate = searchParams.get('startDate') || date;
    const endDate = searchParams.get('endDate') || date;

    const now = new Date();
    const year = parseInt(searchParams.get('year') || String(now.getUTCFullYear()), 10);
    const month = parseInt(searchParams.get('month') || String(now.getUTCMonth() + 1), 10);
    const branchId = searchParams.get('branchId') || undefined;
    const staffId = searchParams.get('staffId') || undefined;
    const status = searchParams.get('status') || undefined;
    const source = (searchParams.get('source') as AttendanceSource) || undefined;
    const search = searchParams.get('search') || undefined;

    let rows: any[] = [];
    let filename = `ShiftGuard_Attendance_Report_${params.organizationCode}_${date}.csv`;

    if (reportType === 'RANGE') {
      const rangeReport = await getDateRangeAttendanceReport({
        organizationId: auth.organization.id,
        startDate,
        endDate,
        branchId,
        staffId,
        status,
        source,
        search,
      });
      rows = rangeReport.rows;
      filename = `ShiftGuard_Range_Report_${params.organizationCode}_${startDate}_to_${endDate}.csv`;
    } else if (reportType === 'DAILY') {
      const dailyReport = await getDailyAttendanceReport({
        organizationId: auth.organization.id,
        date,
        branchId,
        staffId,
        status,
        source,
        search,
      });
      rows = dailyReport.rows;
      filename = `ShiftGuard_Daily_Report_${params.organizationCode}_${date}.csv`;
    } else {
      const monthlyReport = await getMonthlyEmployeeAttendanceReport({
        organizationId: auth.organization.id,
        year,
        month,
        staffId,
        branchId,
        status,
        source,
      });
      rows = monthlyReport.daysRows;
      const staffNameClean = monthlyReport.staff.name.replace(/[^a-zA-Z0-9]/g, '_');
      filename = `ShiftGuard_Monthly_Report_${params.organizationCode}_${staffNameClean}_${year}_${month}.csv`;
    }

    const csvContent = generateAttendanceReportCsv({
      organizationName: auth.organization.name,
      reportType: reportType === 'RANGE' ? ('DAILY' as any) : reportType,
      rows,
    });

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('Error generating CSV report:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to generate CSV export.' },
      { status: 500 }
    );
  }
}
