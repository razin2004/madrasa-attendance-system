import { NextRequest, NextResponse } from 'next/server';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import { getAdminDailyAttendance } from '@/services/attendance.service';
import { AttendanceSource } from '@prisma/client';

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
    const date = searchParams.get('date') || new Date().toISOString().slice(0, 10);
    const branchId = searchParams.get('branchId') || undefined;
    const source = (searchParams.get('source') as AttendanceSource) || undefined;
    const search = searchParams.get('search') || undefined;

    const data = await getAdminDailyAttendance({
      organizationId: auth.organization.id,
      date,
      branchId,
      source,
      search,
    });

    return NextResponse.json({
      success: true,
      ...data,
    });
  } catch (error: any) {
    console.error('Error fetching admin daily attendance:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}
