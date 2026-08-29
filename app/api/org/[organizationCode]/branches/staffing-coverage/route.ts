import { NextRequest, NextResponse } from 'next/server';
import { requireOrgAdmin } from '@/lib/tenant-auth';
import { prisma } from '@/lib/prisma';
import { parseIsoDateString } from '@/services/reports.service';

const WEEKDAYS: Array<'SUNDAY' | 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY'> = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
];

async function getCoverageForDate(auth: any, dateObj: Date) {
  const dateStr = dateObj.toISOString().slice(0, 10);
  const targetWeekday = WEEKDAYS[dateObj.getDay()];
  const startOfDay = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 0, 0, 0);
  const endOfDay = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 23, 59, 59, 999);

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
                  shiftPattern: {
                    include: {
                      weeklyDays: true,
                    },
                  },
                },
                orderBy: { effectiveFrom: 'desc' },
              },
            },
          },
        },
      },
    },
  });

  let understaffedBranchesCount = 0;
  const branchResults = [];

  for (const b of branches) {
    let workingStaffCount = 0;
    const workingStaffIds: string[] = [];
    let minRequired = 3;
    let shiftName = '';

    for (const sa of b.staffAssignments) {
      const activeShiftA = sa.staffProfile.shiftAssignments[0];
      if (activeShiftA?.shiftPattern) {
        const pattern = activeShiftA.shiftPattern;
        const dayRule = pattern.weeklyDays?.find((w) => w.weekday === targetWeekday);

        if (dayRule && !dayRule.isHoliday) {
          workingStaffCount++;
          workingStaffIds.push(sa.staffProfile.id);
          minRequired = Math.max(minRequired, pattern.minimumStaffingThreshold);
          const hours = dayRule.startTime && dayRule.endTime ? ` (${dayRule.startTime} – ${dayRule.endTime})` : '';
          shiftName = `${pattern.name}${hours}`;
        }
      } else {
        // Fallback: If no shift assigned, assume default weekday work (Mon-Fri)
        if (targetWeekday !== 'SATURDAY' && targetWeekday !== 'SUNDAY') {
          workingStaffCount++;
          workingStaffIds.push(sa.staffProfile.id);
        }
      }
    }

    const isWorkingDay = workingStaffCount > 0;

    // Count approved leaves among working staff for this date
    let onLeaveStaff = 0;
    if (workingStaffIds.length > 0) {
      onLeaveStaff = await prisma.leaveRequest.count({
        where: {
          organizationId: auth.organization.id,
          staffProfileId: { in: workingStaffIds },
          status: 'APPROVED',
          startDate: { lte: endOfDay },
          endDate: { gte: startOfDay },
        },
      });
    }

    const availableStaff = Math.max(0, workingStaffCount - onLeaveStaff);
    const isUnderstaffed = isWorkingDay && availableStaff < minRequired;
    const shortageCount = isUnderstaffed ? minRequired - availableStaff : 0;

    if (isUnderstaffed) understaffedBranchesCount++;

    branchResults.push({
      branchId: b.id,
      branchName: b.name,
      shiftName: shiftName || 'Standard Shift',
      isWorkingDay,
      totalStaff: b.staffAssignments.length,
      workingStaff: workingStaffCount,
      onLeaveStaff,
      availableStaff,
      minRequired,
      isUnderstaffed,
      shortageCount,
    });
  }

  return {
    date: dateStr,
    weekday: targetWeekday,
    overallStatus: understaffedBranchesCount > 0 ? 'UNDERSTAFFED' : 'OK',
    understaffedBranchesCount,
    branches: branchResults,
  };
}

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

    const todayObj = new Date();
    const tomorrowObj = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const todayCoverage = await getCoverageForDate(auth, todayObj);
    const tomorrowCoverage = await getCoverageForDate(auth, tomorrowObj);

    return NextResponse.json({
      success: true,
      today: todayCoverage,
      tomorrow: tomorrowCoverage,
      // Backward compatibility fields for legacy clients
      overallStatus: todayCoverage.overallStatus,
      understaffedBranchesCount: todayCoverage.understaffedBranchesCount,
      branches: todayCoverage.branches,
    });
  } catch (error: any) {
    console.error('Error calculating branch staffing coverage:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to calculate staffing coverage.' },
      { status: 500 }
    );
  }
}
