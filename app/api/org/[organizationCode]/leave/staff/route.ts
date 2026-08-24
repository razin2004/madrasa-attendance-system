import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/tenant-auth';
import { prisma } from '@/lib/prisma';
import {
  getOrCreateStaffLeaveBalances,
  submitStaffLeaveRequest,
} from '@/services/leave.service';

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
    const year = new Date().getUTCFullYear();

    const [balances, requests] = await Promise.all([
      getOrCreateStaffLeaveBalances(staffProfile.id, organization.id, year),
      prisma.leaveRequest.findMany({
        where: {
          organizationId: organization.id,
          staffProfileId: staffProfile.id,
        },
        orderBy: { startDate: 'desc' },
      }),
    ]);

    return NextResponse.json({
      success: true,
      balances,
      requests,
    });
  } catch (error: any) {
    console.error('Error fetching staff leaves:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { organizationCode: string } }
) {
  try {
    const auth = await requireStaff(params.organizationCode);
    if (!auth.authorized || !auth.organization || !auth.session || !auth.staffProfile) {
      return NextResponse.json(
        { success: false, error: auth.errorMessage || 'Unauthorized.' },
        { status: auth.errorStatus || 401 }
      );
    }

    const { organization, session, staffProfile } = auth;
    const body = await req.json();

    const { type, startDate, endDate, reason } = body;

    if (!type || !startDate || !endDate || !reason?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Leave type, start date, end date, and reason are required.' },
        { status: 400 }
      );
    }

    const originUrl = req.nextUrl.origin;

    const result = await submitStaffLeaveRequest({
      organizationId: organization.id,
      staffProfileId: staffProfile.id,
      userId: session.user.id,
      type,
      startDate,
      endDate,
      reason,
      originUrl,
    });

    return NextResponse.json({
      success: true,
      message: 'Leave request submitted successfully.',
      leaveRequest: result.leaveRequest,
      retroactiveWarning: result.retroactiveWarning,
    });
  } catch (error: any) {
    console.error('Error submitting leave request:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to submit leave request.' },
      { status: 400 }
    );
  }
}
