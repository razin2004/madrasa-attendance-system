import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOrgAdmin } from '@/lib/tenant-auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { organizationCode: string } }
) {
  try {
    const auth = await requireOrgAdmin(params.organizationCode);
    if (!auth.authorized || !auth.organization) {
      return NextResponse.json(
        { success: false, error: auth.errorMessage },
        { status: auth.errorStatus || 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    // Default to current week (Monday to Sunday) if not provided
    const now = new Date();
    const currentDay = now.getDay();
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;

    const defaultStart = new Date(now);
    defaultStart.setDate(now.getDate() + distanceToMonday);
    defaultStart.setUTCHours(0, 0, 0, 0);

    const defaultEnd = new Date(defaultStart);
    defaultEnd.setDate(defaultStart.getDate() + 6);
    defaultEnd.setUTCHours(23, 59, 59, 999);

    const startDate = startDateStr ? new Date(startDateStr) : defaultStart;
    const endDate = endDateStr ? new Date(endDateStr) : defaultEnd;

    // Fetch Organization Branches, Shift Patterns, Staff Profiles, Leaves, Overrides & Swaps
    const [branches, shiftPatterns, staffProfiles, leaveRequests, approvedSwaps, shiftOverrides] =
      await Promise.all([
        prisma.branch.findMany({
          where: { organizationId: auth.organization.id, status: 'ACTIVE' },
          select: { id: true, name: true },
        }),
        prisma.shiftPattern.findMany({
          where: { organizationId: auth.organization.id, isActive: true },
          include: { weeklyDays: true },
        }),
        prisma.staffProfile.findMany({
          where: {
            organizationId: auth.organization.id,
            user: { status: 'ACTIVE' },
            ...(branchId && branchId !== 'ALL'
              ? { branchAssignments: { some: { branchId } } }
              : {}),
          },
          select: {
            id: true,
            staffId: true,
            name: true,
            user: { select: { email: true } },
            branchAssignments: {
              include: { branch: { select: { id: true, name: true } } },
            },
            shiftAssignments: {
              include: {
                shiftPattern: {
                  include: { weeklyDays: true },
                },
              },
            },
          },
          orderBy: { name: 'asc' },
        }),
        prisma.leaveRequest.findMany({
          where: {
            organizationId: auth.organization.id,
            status: 'APPROVED',
            startDate: { lte: endDate },
            endDate: { gte: startDate },
          },
          select: {
            id: true,
            staffProfileId: true,
            type: true,
            startDate: true,
            endDate: true,
            reason: true,
          },
        }),
        prisma.shiftSwapRequest.findMany({
          where: {
            organizationId: auth.organization.id,
            status: 'APPROVED',
            targetDate: { gte: startDate, lte: endDate },
          },
          include: {
            requester: { select: { id: true, name: true, staffId: true } },
            peer: { select: { id: true, name: true, staffId: true } },
            shiftPattern: { select: { id: true, name: true } },
          },
        }),
        prisma.staffShiftOverride.findMany({
          where: {
            staffProfile: { organizationId: auth.organization.id },
            date: { gte: startDate, lte: endDate },
          },
          select: {
            id: true,
            staffProfileId: true,
            date: true,
            reason: true,
          },
        }),
      ]);

    // Build Date Array
    const datesList: Date[] = [];
    let curr = new Date(startDate);
    while (curr <= endDate) {
      datesList.push(new Date(curr));
      curr.setDate(curr.getDate() + 1);
    }

    const weekdayMap: Record<number, string> = {
      0: 'SUNDAY',
      1: 'MONDAY',
      2: 'TUESDAY',
      3: 'WEDNESDAY',
      4: 'THURSDAY',
      5: 'FRIDAY',
      6: 'SATURDAY',
    };

    // Calculate Conflict Alerts
    const conflicts: Array<{
      type: 'UNDER_STAFFED' | 'LEAVE_CONFLICT' | 'BACK_TO_BACK_NIGHT';
      date: string;
      title: string;
      message: string;
      severity: 'HIGH' | 'MEDIUM';
      branchId?: string;
      staffProfileId?: string;
    }> = [];

    // Check Leave Conflicts & Daily Scheduled Coverage
    const dailyCoverageCount: Record<string, number> = {};

    datesList.forEach((d) => {
      const dateIso = d.toISOString().split('T')[0];
      const weekdayStr = weekdayMap[d.getDay()];

      staffProfiles.forEach((staff) => {
        const assignment = staff.shiftAssignments[0];
        const pattern = assignment?.shiftPattern;
        const weeklyDay = pattern?.weeklyDays.find((w) => w.weekday === weekdayStr);

        const isScheduledDay = Boolean(weeklyDay && !weeklyDay.isHoliday);

        // Check if staff has approved leave on this date
        const isOnLeave = leaveRequests.some((lr) => {
          const s = new Date(lr.startDate);
          const e = new Date(lr.endDate);
          s.setUTCHours(0, 0, 0, 0);
          e.setUTCHours(23, 59, 59, 999);
          return lr.staffProfileId === staff.id && d >= s && d <= e;
        });

        if (isScheduledDay) {
          const key = `${dateIso}_${pattern?.id || 'default'}`;
          dailyCoverageCount[key] = (dailyCoverageCount[key] || 0) + (isOnLeave ? 0 : 1);

          if (isOnLeave) {
            conflicts.push({
              type: 'LEAVE_CONFLICT',
              date: dateIso,
              title: `Approved Leave Conflict`,
              message: `${staff.name} is scheduled for ${pattern?.name || 'Shift'} on ${dateIso} but has an approved Leave.`,
              severity: 'HIGH',
              staffProfileId: staff.id,
            });
          }
        }
      });

      // Check Under-Staffing Thresholds per Shift Pattern (Skip holiday/off days)
      shiftPatterns.forEach((sp) => {
        const weeklyDay = sp.weeklyDays?.find((w) => w.weekday === weekdayStr);
        // If the shift pattern does not operate on this day of the week or is marked as a holiday, do not evaluate understaffed threshold
        if (!weeklyDay || weeklyDay.isHoliday) return;

        const key = `${dateIso}_${sp.id}`;
        const activeCount = dailyCoverageCount[key] || 0;
        const threshold = sp.minimumStaffingThreshold || 1;

        if (activeCount < threshold) {
          conflicts.push({
            type: 'UNDER_STAFFED',
            date: dateIso,
            title: `Under-Staffed Shift Alert`,
            message: `${sp.name} has only ${activeCount} active staff available on ${dateIso} (Minimum required: ${threshold}).`,
            severity: 'HIGH',
          });
        }
      });
    });

    return NextResponse.json({
      success: true,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      branches,
      shiftPatterns,
      staffProfiles,
      leaveRequests,
      approvedSwaps,
      shiftOverrides,
      datesList: datesList.map((d) => d.toISOString()),
      conflicts,
      summaryStats: {
        totalStaff: staffProfiles.length,
        totalConflicts: conflicts.length,
        approvedLeavesCount: leaveRequests.length,
        approvedSwapsCount: approvedSwaps.length,
      },
    });
  } catch (error: any) {
    console.error('Fetch roster calendar error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve roster calendar data.' },
      { status: 500 }
    );
  }
}
