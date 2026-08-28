import { prisma } from '@/lib/prisma';
import { calculateStaffDaySchedule } from './roster.service';
import { parseIsoDateString } from './reports.service';

export interface AbsenceCronResult {
  success: boolean;
  targetDate: string;
  processedOrgs: number;
  totalAbsencesMarked: number;
  details: Array<{
    organizationId: string;
    organizationName: string;
    staffId: string;
    staffName: string;
    date: string;
  }>;
}

export async function runMidnightAbsenceCron(targetDateStr?: string): Promise<AbsenceCronResult> {
  // If target date is not provided, evaluate yesterday's completed workday in UTC
  let dateStr = targetDateStr;
  if (!dateStr) {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    dateStr = yesterday.toISOString().slice(0, 10);
  }

  const targetDateObj = parseIsoDateString(dateStr);
  const startOfDay = new Date(targetDateObj.getTime());
  const endOfDay = new Date(targetDateObj.getTime() + 24 * 60 * 60 * 1000 - 1);

  const organizations = await prisma.organization.findMany({
    select: { id: true, name: true, organizationCode: true },
  });

  let totalAbsencesMarked = 0;
  const details: AbsenceCronResult['details'] = [];

  for (const org of organizations) {
    const staffProfiles = await prisma.staffProfile.findMany({
      where: {
        organizationId: org.id,
        user: { status: 'ACTIVE' },
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        branchAssignments: { include: { branch: true } },
        shiftAssignments: {
          include: {
            shiftPattern: { include: { weeklyDays: true } },
          },
        },
        shiftOverrides: {
          where: { date: { gte: startOfDay, lte: endOfDay } },
        },
      },
    });

    const staffIds = staffProfiles.map((s) => s.id);

    // Fetch attendance records for the date
    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where: {
        organizationId: org.id,
        staffProfileId: { in: staffIds },
        timestamp: { gte: startOfDay, lte: endOfDay },
        verificationStatus: 'VERIFIED',
      },
      select: { staffProfileId: true },
    });

    const punchedStaffIds = new Set(attendanceRecords.map((r) => r.staffProfileId));

    // Fetch approved leave requests for the date
    const approvedLeaves = await prisma.leaveRequest.findMany({
      where: {
        organizationId: org.id,
        staffProfileId: { in: staffIds },
        status: 'APPROVED',
        startDate: { lte: endOfDay },
        endDate: { gte: startOfDay },
      },
      select: { staffProfileId: true },
    });

    const leaveStaffIds = new Set(approvedLeaves.map((l) => l.staffProfileId));

    for (const staff of staffProfiles) {
      // 1. Calculate schedule for the date
      const schedule = calculateStaffDaySchedule(
        targetDateObj,
        staff.shiftAssignments,
        staff.shiftOverrides
      );

      // Check if scheduled to work and not a holiday
      const isScheduledWorkday = schedule.isScheduled && !schedule.isHoliday;
      if (!isScheduledWorkday) continue;

      // Check if staff clocked in or has approved leave
      if (punchedStaffIds.has(staff.id) || leaveStaffIds.has(staff.id)) continue;

      // Check if an audit log for this date already exists to prevent duplicate logs
      const existingAudit = await prisma.auditLog.findFirst({
        where: {
          organizationId: org.id,
          action: 'AUTOMATED_ABSENCE_MARKED',
          entityId: staff.id,
          createdAt: { gte: startOfDay, lte: endOfDay },
        },
      });

      if (existingAudit) continue;

      // Create automated absence audit log record
      await prisma.auditLog.create({
        data: {
          organizationId: org.id,
          action: 'AUTOMATED_ABSENCE_MARKED',
          entityType: 'StaffProfile',
          entityId: staff.id,
          metadata: {
            actorType: 'SYSTEM',
            actorName: 'Automated Midnight Cron Engine',
            date: dateStr,
            staffId: staff.staffId,
            staffName: staff.name,
            organizationCode: org.organizationCode,
            branchName: staff.branchAssignments[0]?.branch.name || 'Unassigned',
            reason: 'Scheduled workday passed with no clock-in punch recorded',
          },
        },
      });

      totalAbsencesMarked++;
      details.push({
        organizationId: org.id,
        organizationName: org.name,
        staffId: staff.staffId,
        staffName: staff.name,
        date: dateStr,
      });
    }
  }

  return {
    success: true,
    targetDate: dateStr,
    processedOrgs: organizations.length,
    totalAbsencesMarked,
    details,
  };
}
