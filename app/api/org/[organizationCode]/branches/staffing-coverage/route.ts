import { NextRequest, NextResponse } from 'next/server';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import { prisma } from '@/lib/prisma';
import { parseIsoDateString } from '@/services/reports.service';

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
    const dateStr = searchParams.get('date') || new Date().toISOString().slice(0, 10);
    const targetDateObj = parseIsoDateString(dateStr);
    const startOfDay = new Date(targetDateObj.getTime());
    const endOfDay = new Date(targetDateObj.getTime() + 24 * 60 * 60 * 1000 - 1);

    const branches = await prisma.branch.findMany({
      where: {
        organizationId: auth.organization.id,
        status: 'ACTIVE',
      },
      include: {
        staffAssignments: {
          where: {
            staffProfile: { user: { status: 'ACTIVE' } },
          },
          include: {
            staffProfile: {
              include: {
                shiftAssignments: {
                  where: {
                    effectiveFrom: { lte: endOfDay },
                    OR: [{ effectiveTo: null }, { effectiveTo: { gte: startOfDay } }],
                  },
                  include: {
                    shiftPattern: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    let understaffedBranchesCount = 0;
    const branchResults: Array<{
      branchId: string;
      branchName: string;
      totalStaff: number;
      onLeaveStaff: number;
      availableStaff: number;
      minRequired: number;
      isUnderstaffed: boolean;
      shortageCount: number;
    }> = [];

    for (const b of branches) {
      const totalStaff = b.staffAssignments.length;
      const staffProfileIds = b.staffAssignments.map((a) => a.staffProfileId);

      // Count approved leave requests on target date
      const onLeaveStaff = await prisma.leaveRequest.count({
        where: {
          organizationId: auth.organization.id,
          staffProfileId: { in: staffProfileIds },
          status: 'APPROVED',
          startDate: { lte: endOfDay },
          endDate: { gte: startOfDay },
        },
      });

      // Calculate minimum threshold across assigned shift patterns (default fallback to 3)
      let maxMinRequired = 3;
      for (const sa of b.staffAssignments) {
        for (const shiftA of sa.staffProfile.shiftAssignments) {
          if (shiftA.shiftPattern?.minimumStaffingThreshold) {
            maxMinRequired = Math.max(maxMinRequired, shiftA.shiftPattern.minimumStaffingThreshold);
          }
        }
      }

      const availableStaff = Math.max(0, totalStaff - onLeaveStaff);
      const isUnderstaffed = totalStaff > 0 && availableStaff < maxMinRequired;
      const shortageCount = isUnderstaffed ? maxMinRequired - availableStaff : 0;

      if (isUnderstaffed) understaffedBranchesCount++;

      branchResults.push({
        branchId: b.id,
        branchName: b.name,
        totalStaff,
        onLeaveStaff,
        availableStaff,
        minRequired: maxMinRequired,
        isUnderstaffed,
        shortageCount,
      });
    }

    return NextResponse.json({
      success: true,
      date: dateStr,
      overallStatus: understaffedBranchesCount > 0 ? 'UNDERSTAFFED' : 'OK',
      understaffedBranchesCount,
      branches: branchResults,
    });
  } catch (error: any) {
    console.error('Error calculating branch staffing coverage:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to calculate staffing coverage.' },
      { status: 500 }
    );
  }
}
