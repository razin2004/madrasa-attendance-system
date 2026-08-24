import { NextRequest, NextResponse } from 'next/server';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import { prisma } from '@/lib/prisma';
import {
  calculateStaffingImpact,
  suggestAlternativeDateRanges,
  getOrCreateStaffLeaveBalances,
  AlternativeSuggestion,
} from '@/services/leave.service';

export async function GET(
  req: NextRequest,
  { params }: { params: { organizationCode: string; requestId: string } }
) {
  try {
    const auth = await requireOrgAdmin(params.organizationCode);
    if (!auth.authorized || !auth.organization) {
      return NextResponse.json(
        { success: false, error: auth.errorMessage || 'Unauthorized.' },
        { status: auth.errorStatus || 401 }
      );
    }

    const { organization } = auth;

    const request = await prisma.leaveRequest.findUnique({
      where: { id: params.requestId },
      include: {
        staffProfile: {
          include: {
            user: { select: { id: true, name: true, email: true, phone: true } },
            branchAssignments: { include: { branch: true } },
            shiftAssignments: {
              include: {
                shiftPattern: { include: { weeklyDays: true } },
              },
              orderBy: { effectiveFrom: 'desc' },
            },
          },
        },
        reviewerUser: { select: { id: true, name: true, email: true } },
        enteredByAdmin: { select: { id: true, name: true, email: true } },
      },
    });

    if (!request || request.organizationId !== organization.id) {
      return NextResponse.json(
        { success: false, error: 'Leave request not found.' },
        { status: 404 }
      );
    }

    const year = request.startDate.getUTCFullYear();

    // 1. Calculate Day-by-Day Staffing Impact
    const staffingImpact = await calculateStaffingImpact(
      organization.id,
      request.staffProfileId,
      request.startDate,
      request.endDate
    );

    // 2. Compute Alternative Date Suggestions if shortage exists or request is multi-day
    let alternativeSuggestions: AlternativeSuggestion[] = [];
    if (staffingImpact.hasShortage || request.daysCount > 1) {
      alternativeSuggestions = await suggestAlternativeDateRanges(
        organization.id,
        request.staffProfileId,
        request.startDate,
        request.endDate,
        request.daysCount
      );
    }

    // 3. Get Staff Leave Balances
    const balances = await getOrCreateStaffLeaveBalances(
      request.staffProfileId,
      organization.id,
      year
    );

    return NextResponse.json({
      success: true,
      request,
      staffingImpact,
      alternativeSuggestions,
      balances,
    });
  } catch (error: any) {
    console.error('Error fetching leave request details:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}
