import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/tenant-auth';
import { prisma } from '@/lib/prisma';
import { calculateStaffingImpact } from '@/services/leave.service';

export async function GET(
  req: NextRequest,
  { params }: { params: { organizationCode: string; requestId: string } }
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

    const request = await prisma.leaveRequest.findUnique({
      where: { id: params.requestId },
      include: {
        staffProfile: {
          select: { id: true, name: true, staffId: true },
        },
        reviewerUser: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!request || request.organizationId !== organization.id || request.staffProfileId !== staffProfile.id) {
      return NextResponse.json(
        { success: false, error: 'Leave request not found.' },
        { status: 404 }
      );
    }

    // Calculate Day-by-Day Staffing Impact for Staff View
    const staffingImpact = await calculateStaffingImpact(
      organization.id,
      request.staffProfileId,
      request.startDate,
      request.endDate
    );

    return NextResponse.json({
      success: true,
      request,
      staffingImpact: staffingImpact.days || [],
      hasShortage: staffingImpact.hasShortage || false,
    });
  } catch (error: any) {
    console.error('Error fetching staff leave details:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}
