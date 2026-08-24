import { NextRequest, NextResponse } from 'next/server';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import { createAdminManualLeave } from '@/services/leave.service';

export async function POST(
  req: NextRequest,
  { params }: { params: { organizationCode: string } }
) {
  try {
    const auth = await requireOrgAdmin(params.organizationCode);
    if (!auth.authorized || !auth.organization || !auth.session) {
      return NextResponse.json(
        { success: false, error: auth.errorMessage || 'Unauthorized.' },
        { status: auth.errorStatus || 401 }
      );
    }

    const { organization, session } = auth;
    const body = await req.json();

    const { staffProfileId, type, startDate, endDate, reason, adminComment } = body;

    if (!staffProfileId || !type || !startDate || !endDate || !reason?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Staff member, leave type, start date, end date, and reason are required.' },
        { status: 400 }
      );
    }

    const originUrl = req.nextUrl.origin;

    const leave = await createAdminManualLeave({
      organizationId: organization.id,
      adminUserId: session.user.id,
      staffProfileId,
      type,
      startDate,
      endDate,
      reason,
      adminComment,
      originUrl,
    });

    return NextResponse.json({
      success: true,
      message: 'Leave manually entered and recorded successfully.',
      leaveRequest: leave,
    });
  } catch (error: any) {
    console.error('Error creating manual leave:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create manual leave.' },
      { status: 400 }
    );
  }
}
