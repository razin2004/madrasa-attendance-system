import { NextRequest, NextResponse } from 'next/server';
import { requireOrgAdmin, requireStaff } from '@/lib/tenant-auth';
import { getMonthlyEmployeeAttendanceReport } from '@/services/reports.service';
import { AttendanceSource } from '@prisma/client';

export async function GET(
  req: NextRequest,
  { params }: { params: { organizationCode: string } }
) {
  try {
    let organizationId: string;
    let effectiveStaffId: string | undefined;

    // 1. Check if user is Org Admin
    const adminAuth = await requireOrgAdmin(params.organizationCode);
    if (adminAuth.authorized && adminAuth.organization) {
      organizationId = adminAuth.organization.id;
      const requestedStaffId = req.nextUrl.searchParams.get('staffId');
      effectiveStaffId = requestedStaffId || undefined;
    } else {
      // 2. Check if user is Staff Member
      const staffAuth = await requireStaff(params.organizationCode);
      if (staffAuth.authorized && staffAuth.organization && staffAuth.staffProfile) {
        organizationId = staffAuth.organization.id;
        effectiveStaffId = staffAuth.staffProfile.id; // Enforce staff member's own profile
      } else {
        return NextResponse.json(
          { success: false, error: 'Authentication required to view attendance report.' },
          { status: 401 }
        );
      }
    }

    const { searchParams } = req.nextUrl;
    const now = new Date();
    const year = parseInt(searchParams.get('year') || String(now.getUTCFullYear()), 10);
    const month = parseInt(searchParams.get('month') || String(now.getUTCMonth() + 1), 10);
    const branchId = searchParams.get('branchId') || undefined;
    const status = searchParams.get('status') || undefined;
    const source = (searchParams.get('source') as AttendanceSource) || undefined;

    if (month < 1 || month > 12) {
      return NextResponse.json(
        { success: false, error: 'Invalid month specified.' },
        { status: 400 }
      );
    }

    const report = await getMonthlyEmployeeAttendanceReport({
      organizationId,
      year,
      month,
      staffId: effectiveStaffId,
      branchId,
      status,
      source,
    });

    return NextResponse.json({
      success: true,
      report,
      monthlyMetrics: report.monthlyMetrics,
      daysRows: report.daysRows,
    });
  } catch (error: any) {
    console.error('Error calculating monthly attendance report:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}
