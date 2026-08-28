import { NextRequest, NextResponse } from 'next/server';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import { getStaffMonthlyPayrollSummary, generatePayrollSummaryCsv } from '@/services/payroll.service';

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
    const now = new Date();
    const year = parseInt(searchParams.get('year') || String(now.getUTCFullYear()), 10);
    const month = parseInt(searchParams.get('month') || String(now.getUTCMonth() + 1), 10);
    const staffId = searchParams.get('staffId');
    const branchId = searchParams.get('branchId') || undefined;

    if (!staffId) {
      return NextResponse.json(
        { success: false, error: 'Staff ID is required to export payroll summary.' },
        { status: 400 }
      );
    }

    const summary = await getStaffMonthlyPayrollSummary({
      organizationId: auth.organization.id,
      year,
      month,
      staffId,
      branchId,
    });

    const csvContent = generatePayrollSummaryCsv({
      organizationName: auth.organization.name,
      summary,
    });

    const staffClean = summary.staff.name.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `Payroll_Hours_Summary_${params.organizationCode}_${staffClean}_${year}_${month}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('Error exporting payroll CSV:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to export payroll CSV.' },
      { status: 500 }
    );
  }
}
