import { NextRequest, NextResponse } from 'next/server';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import {
  getDailyAttendanceReport,
  getMonthlyEmployeeAttendanceReport,
  getDateRangeAttendanceReport,
} from '@/services/reports.service';
import { generateAttendanceReportPdfHtml } from '@/services/export-pdf.service';
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
    let reportTitle = `Daily Attendance Report — ${date}`;
    let filterSummaryStr = `Date: ${date}`;

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
      reportTitle = `Custom Date Range Attendance Report (${startDate} to ${endDate})`;
      filterSummaryStr = `Date Range: ${startDate} to ${endDate} (${rangeReport.totalDays} Days)`;
      if (branchId) filterSummaryStr += ` | Branch ID: ${branchId}`;
      if (status) filterSummaryStr += ` | Status: ${status}`;
      if (source) filterSummaryStr += ` | Source: ${source}`;
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
      if (branchId) filterSummaryStr += ` | Branch ID: ${branchId}`;
      if (status) filterSummaryStr += ` | Status: ${status}`;
      if (source) filterSummaryStr += ` | Source: ${source}`;
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
      reportTitle = `Monthly Attendance Report — ${monthlyReport.staff.name} (${year}-${String(month).padStart(2, '0')})`;
      filterSummaryStr = `Staff: ${monthlyReport.staff.name} (ID: ${monthlyReport.staff.staffId}) | Period: ${year}-${String(month).padStart(2, '0')}`;
    }

    const pdfHtml = generateAttendanceReportPdfHtml({
      organizationName: auth.organization.name,
      logoUrl: auth.organization.logoUrl,
      reportTitle,
      filterSummaryStr,
      generatedAt: new Date().toLocaleString(),
      rows,
    });

    return new NextResponse(pdfHtml, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error: any) {
    console.error('Error generating PDF report:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to generate PDF export.' },
      { status: 500 }
    );
  }
}
