import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/tenant-auth';
import { getOrCreateStaffLeaveBalances } from '@/services/leave.service';

export async function GET(
  req: NextRequest,
  { params }: { params: { organizationCode: string } }
) {
  try {
    const auth = await requireStaff(params.organizationCode);
    if (!auth.authorized || !auth.organization || !auth.staffProfile) {
      return NextResponse.json(
        { success: false, error: auth.errorMessage || 'Unauthorized.' },
        { status: auth.errorStatus || 401 }
      );
    }

    const { organization, staffProfile } = auth;
    const year = parseInt(req.nextUrl.searchParams.get('year') || '', 10) || new Date().getUTCFullYear();

    const balances = await getOrCreateStaffLeaveBalances(staffProfile.id, organization.id, year);

    return NextResponse.json({
      success: true,
      year,
      balances,
    });
  } catch (error: any) {
    console.error('Error fetching staff leave balances:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}
