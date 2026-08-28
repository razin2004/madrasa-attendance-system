import { prisma } from '@/lib/prisma';
import { LeaveType, LeaveRequestStatus } from '@prisma/client';
import { sendEmail } from '@/services/email.service';
import {
  templateLeaveRequestSubmitted,
  templateLeaveApproved,
  templateLeaveRejected,
  templateAdminManualLeave,
} from '@/services/email-templates';

// Helper to normalize Date to UTC Midnight (YYYY-MM-DD 00:00:00.000Z)
export function normalizeDate(d: Date | string): Date {
  const dateObj = typeof d === 'string' ? new Date(d) : d;
  return new Date(Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate(), 0, 0, 0, 0));
}

export function formatUtcDateString(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function countDaysBetween(startDate: Date, endDate: Date): number {
  const start = normalizeDate(startDate).getTime();
  const end = normalizeDate(endDate).getTime();
  const diffTime = end - start;
  return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

// -----------------------------------------------------------------------------
// 1. Leave Balances Management (Section 26, 27, 28, 29)
// -----------------------------------------------------------------------------
export async function getOrCreateStaffLeaveBalances(
  staffProfileId: string,
  organizationId: string,
  year: number = new Date().getUTCFullYear()
) {
  const defaultTypes: Array<{ type: LeaveType; entitlement: number }> = [
    { type: 'ANNUAL', entitlement: 12 },
    { type: 'SICK', entitlement: 12 },
    { type: 'OTHER', entitlement: 0 },
    { type: 'DUTY', entitlement: 0 },
  ];

  const existing = await prisma.leaveBalance.findMany({
    where: {
      staffProfileId,
      organizationId,
      year,
    },
  });

  const existingMap = new Map(existing.map((b) => [b.leaveType, b]));
  const balances = [];

  for (const def of defaultTypes) {
    if (existingMap.has(def.type)) {
      const b = existingMap.get(def.type)!;
      balances.push({
        ...b,
        remaining: Math.max(0, b.entitlement - b.used),
      });
    } else {
      const created = await prisma.leaveBalance.create({
        data: {
          staffProfileId,
          organizationId,
          year,
          leaveType: def.type,
          entitlement: def.entitlement,
          used: 0,
        },
      });
      balances.push({
        ...created,
        remaining: created.entitlement,
      });
    }
  }

  return balances;
}

// -----------------------------------------------------------------------------
// 2. Overlap & Existing Attendance Detection (Section 31, 32, 34)
// -----------------------------------------------------------------------------
export async function checkLeaveOverlap(
  staffProfileId: string,
  startDate: Date,
  endDate: Date,
  excludeRequestId?: string
): Promise<{ hasOverlap: boolean; overlappingRequest?: any }> {
  const normStart = normalizeDate(startDate);
  const normEnd = normalizeDate(endDate);

  const overlapping = await prisma.leaveRequest.findFirst({
    where: {
      staffProfileId,
      status: { in: ['PENDING', 'APPROVED'] },
      id: excludeRequestId ? { not: excludeRequestId } : undefined,
      startDate: { lte: normEnd },
      endDate: { gte: normStart },
    },
  });

  return {
    hasOverlap: !!overlapping,
    overlappingRequest: overlapping,
  };
}

export async function checkRetroactiveAttendance(
  staffProfileId: string,
  startDate: Date,
  endDate: Date
): Promise<{ hasAttendance: boolean; recordsCount: number }> {
  const normStart = normalizeDate(startDate);
  const normEnd = normalizeDate(endDate);
  normEnd.setUTCHours(23, 59, 59, 999);

  const count = await prisma.attendanceRecord.count({
    where: {
      staffProfileId,
      verificationStatus: 'VERIFIED',
      timestamp: {
        gte: normStart,
        lte: normEnd,
      },
    },
  });

  return {
    hasAttendance: count > 0,
    recordsCount: count,
  };
}

// -----------------------------------------------------------------------------
// 3. Staffing Picture & Minimum Threshold Engine (Section 13, 14, 15, 16, 20)
// -----------------------------------------------------------------------------
export interface DayStaffingPicture {
  date: string; // YYYY-MM-DD
  dayOfWeek: string;
  isHoliday: boolean;
  branchName: string | null;
  shiftName: string | null;
  shiftHours: string | null;
  totalAssignedStaff: number;
  alreadyOnLeaveStaff: number;
  afterApprovalAvailable: number;
  minimumStaffingThreshold: number;
  status: 'GREEN' | 'AMBER' | 'RED' | 'HOLIDAY' | 'NO_SHIFT';
  statusMessage: string;

  // Frontend & API Aliases
  totalScheduled?: number;
  onLeaveCount?: number;
  onLeaveWithThis?: number;
  remainingStaff?: number;
  minRequired?: number;
  isShortage?: boolean;
}

export async function calculateStaffingImpact(
  organizationId: string,
  staffProfileId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  days: DayStaffingPicture[];
  hasShortage: boolean;
  totalShortageDays: number;
}> {
  const normStart = normalizeDate(startDate);
  const normEnd = normalizeDate(endDate);
  const totalDays = countDaysBetween(normStart, normEnd);

  // Load staff profile with branch assignments & active shift assignments
  const staff = await prisma.staffProfile.findUnique({
    where: { id: staffProfileId },
    include: {
      branchAssignments: { include: { branch: true } },
      shiftAssignments: {
        include: {
          shiftPattern: {
            include: { weeklyDays: true },
          },
        },
        orderBy: { effectiveFrom: 'desc' },
      },
    },
  });

  if (!staff) {
    throw new Error('Staff profile not found.');
  }

  const daysResult: DayStaffingPicture[] = [];
  let totalShortageDays = 0;
  const branchId = staff.branchAssignments[0]?.branchId;

  const weekdaysMap = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as const;

  for (let i = 0; i < totalDays; i++) {
    const currDate = new Date(normStart.getTime() + i * 24 * 60 * 60 * 1000);
    const dateStr = formatUtcDateString(currDate);
    const dayOfWeek = weekdaysMap[currDate.getUTCDay()];

    // 1. Check staff-specific override for this date
    const override = await prisma.staffShiftOverride.findUnique({
      where: {
        staffProfileId_date: {
          staffProfileId,
          date: currDate,
        },
      },
    });

    // 2. Find active shift assignment on this date
    const activeAssignment = staff.shiftAssignments.find(
      (a) =>
        a.effectiveFrom <= currDate &&
        (!a.effectiveTo || a.effectiveTo >= currDate)
    );

    const shiftPattern = activeAssignment?.shiftPattern;
    const weeklyDay = shiftPattern?.weeklyDays.find((d) => d.weekday === dayOfWeek);

    const isHoliday = override ? override.isHoliday : weeklyDay ? weeklyDay.isHoliday : false;

    if (isHoliday) {
      const minReq = shiftPattern?.minimumStaffingThreshold || 3;
      daysResult.push({
        date: dateStr,
        dayOfWeek,
        isHoliday: true,
        branchName: staff.branchAssignments[0]?.branch.name || null,
        shiftName: shiftPattern?.name || null,
        shiftHours: 'Holiday',
        totalAssignedStaff: 0,
        alreadyOnLeaveStaff: 0,
        afterApprovalAvailable: 0,
        minimumStaffingThreshold: minReq,
        status: 'HOLIDAY',
        statusMessage: 'Scheduled Holiday',
        totalScheduled: 0,
        onLeaveCount: 0,
        onLeaveWithThis: 1,
        remainingStaff: 0,
        minRequired: minReq,
        isShortage: false,
      });
      continue;
    }

    let totalAssignedStaff = 0;
    let approvedLeavesOnDate = 0;
    let minimum = 3;
    let shiftName: string | null = null;
    let shiftHours: string | null = null;

    if (shiftPattern && weeklyDay) {
      shiftName = shiftPattern.name;
      shiftHours = override
        ? `${override.startTime || '09:00'} - ${override.endTime || '17:00'}`
        : `${weeklyDay.startTime || '09:00'} - ${weeklyDay.endTime || '17:00'}`;

      totalAssignedStaff = await prisma.shiftAssignment.count({
        where: {
          shiftPatternId: shiftPattern.id,
          effectiveFrom: { lte: currDate },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: currDate } }],
          staffProfile: {
            organizationId,
            user: { status: 'ACTIVE' },
          },
        },
      });

      approvedLeavesOnDate = await prisma.leaveRequest.count({
        where: {
          organizationId,
          status: 'APPROVED',
          staffProfileId: { not: staffProfileId },
          startDate: { lte: currDate },
          endDate: { gte: currDate },
          staffProfile: {
            shiftAssignments: {
              some: {
                shiftPatternId: shiftPattern.id,
                effectiveFrom: { lte: currDate },
                OR: [{ effectiveTo: null }, { effectiveTo: { gte: currDate } }],
              },
            },
          },
        },
      });

      minimum = shiftPattern.minimumStaffingThreshold || 3;
    } else {
      // Branch / Org level staffing fallback
      totalAssignedStaff = await prisma.staffProfile.count({
        where: {
          organizationId,
          user: { status: 'ACTIVE' },
          ...(branchId ? { branchAssignments: { some: { branchId } } } : {}),
        },
      });

      approvedLeavesOnDate = await prisma.leaveRequest.count({
        where: {
          organizationId,
          status: 'APPROVED',
          staffProfileId: { not: staffProfileId },
          startDate: { lte: currDate },
          endDate: { gte: currDate },
          ...(branchId ? { staffProfile: { branchAssignments: { some: { branchId } } } } : {}),
        },
      });

      minimum = 3;
    }

    const afterApprovalAvailable = Math.max(0, totalAssignedStaff - approvedLeavesOnDate - 1);
    const isShortage = afterApprovalAvailable < minimum;

    let status: 'GREEN' | 'AMBER' | 'RED' = 'GREEN';
    let statusMessage = 'Meets minimum staffing threshold';

    if (isShortage) {
      status = 'RED';
      statusMessage = `Below minimum (${afterApprovalAvailable} / ${minimum} required)`;
      totalShortageDays++;
    } else if (afterApprovalAvailable === minimum) {
      status = 'AMBER';
      statusMessage = `Exactly at minimum (${afterApprovalAvailable} / ${minimum})`;
    }

    daysResult.push({
      date: dateStr,
      dayOfWeek,
      isHoliday: false,
      branchName: staff.branchAssignments[0]?.branch.name || null,
      shiftName,
      shiftHours,
      totalAssignedStaff,
      alreadyOnLeaveStaff: approvedLeavesOnDate,
      afterApprovalAvailable,
      minimumStaffingThreshold: minimum,
      status,
      statusMessage,

      // Aliases for Frontend & API
      totalScheduled: totalAssignedStaff,
      onLeaveCount: approvedLeavesOnDate,
      onLeaveWithThis: approvedLeavesOnDate + 1,
      remainingStaff: afterApprovalAvailable,
      minRequired: minimum,
      isShortage,
    });
  }

  return {
    days: daysResult,
    hasShortage: totalShortageDays > 0,
    totalShortageDays,
  };
}

// -----------------------------------------------------------------------------
// 4. Alternative Date Suggestions Algorithm (Section 22, 23, 24, 25)
// -----------------------------------------------------------------------------
export interface AlternativeSuggestion {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  daysCount: number;
  shortageDaysCount: number;
  overlapCount: number;
  impactLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
}

export async function suggestAlternativeDateRanges(
  organizationId: string,
  staffProfileId: string,
  originalStartDate: Date,
  originalEndDate: Date,
  daysCount: number
): Promise<AlternativeSuggestion[]> {
  const normStart = normalizeDate(originalStartDate);
  const candidates: AlternativeSuggestion[] = [];

  // Search window ±14 days (excluding offset 0 which is original)
  const offsets = [-7, 7, -3, 3, -14, 14];

  for (const offset of offsets) {
    const candStart = new Date(normStart.getTime() + offset * 24 * 60 * 60 * 1000);
    const candEnd = new Date(candStart.getTime() + (daysCount - 1) * 24 * 60 * 60 * 1000);

    // Skip candidate windows in the past
    if (candStart < normalizeDate(new Date())) continue;

    // Check overlap for this candidate window
    const overlap = await checkLeaveOverlap(staffProfileId, candStart, candEnd);
    const overlapCount = overlap.hasOverlap ? 1 : 0;

    // Calculate staffing impact for this window
    const impact = await calculateStaffingImpact(organizationId, staffProfileId, candStart, candEnd);

    let impactLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (impact.totalShortageDays > 1 || overlapCount > 0) {
      impactLevel = 'HIGH';
    } else if (impact.totalShortageDays === 1) {
      impactLevel = 'MEDIUM';
    }

    let desc = 'Meets minimum staffing';
    if (impact.totalShortageDays > 0) {
      desc = `${impact.totalShortageDays} day(s) below threshold`;
    } else if (overlapCount > 0) {
      desc = 'Overlaps existing requested leave';
    }

    candidates.push({
      startDate: formatUtcDateString(candStart),
      endDate: formatUtcDateString(candEnd),
      daysCount,
      shortageDaysCount: impact.totalShortageDays,
      overlapCount,
      impactLevel,
      description: desc,
    });
  }

  // Sort candidates by:
  // 1. Least overlap
  // 2. Least shortage days
  // 3. Closeness to original date
  candidates.sort((a, b) => {
    if (a.overlapCount !== b.overlapCount) return a.overlapCount - b.overlapCount;
    if (a.shortageDaysCount !== b.shortageDaysCount) return a.shortageDaysCount - b.shortageDaysCount;
    return 0;
  });

  // Return top 3 distinct suggestions
  return candidates.slice(0, 3);
}

// -----------------------------------------------------------------------------
// 5. Submit Staff Leave Request (Section 4, 5, 30, 31, 37)
// -----------------------------------------------------------------------------
export async function submitStaffLeaveRequest(params: {
  organizationId: string;
  staffProfileId: string;
  userId: string;
  type: LeaveType;
  startDate: Date | string;
  endDate: Date | string;
  reason: string;
  originUrl?: string;
}) {
  const normStart = normalizeDate(params.startDate);
  const normEnd = normalizeDate(params.endDate);

  if (normStart > normEnd) {
    throw new Error('Start date cannot be after end date.');
  }

  const daysCount = countDaysBetween(normStart, normEnd);
  const year = normStart.getUTCFullYear();

  // 1. Verify staff belongs to organization and is active
  const staff = await prisma.staffProfile.findFirst({
    where: {
      id: params.staffProfileId,
      organizationId: params.organizationId,
      user: { status: 'ACTIVE' },
    },
    include: {
      organization: true,
      user: true,
    },
  });

  if (!staff) {
    throw new Error('Staff profile not found or inactive.');
  }

  // 2. Check overlap
  const overlap = await checkLeaveOverlap(params.staffProfileId, normStart, normEnd);
  if (overlap.hasOverlap) {
    throw new Error('These dates overlap an existing pending or approved leave request.');
  }

  // 3. Balance verification (for ANNUAL & SICK)
  if (params.type === 'ANNUAL' || params.type === 'SICK') {
    const balances = await getOrCreateStaffLeaveBalances(params.staffProfileId, params.organizationId, year);
    const balance = balances.find((b) => b.leaveType === params.type);
    if (!balance || balance.remaining < daysCount) {
      throw new Error(`Insufficient ${params.type.toLowerCase()} leave balance. Available: ${balance?.remaining || 0} days, Requested: ${daysCount} days.`);
    }
  }

  // 4. Check retroactive attendance
  const retro = await checkRetroactiveAttendance(params.staffProfileId, normStart, normEnd);

  // 5. Create Leave Request
  const leaveRequest = await prisma.leaveRequest.create({
    data: {
      organizationId: params.organizationId,
      staffProfileId: params.staffProfileId,
      type: params.type,
      startDate: normStart,
      endDate: normEnd,
      daysCount,
      reason: params.reason.trim(),
      status: 'PENDING',
    },
  });

  // 6. Audit Log
  await prisma.auditLog.create({
    data: {
      organizationId: params.organizationId,
      actorUserId: params.userId,
      action: 'LEAVE_REQUESTED',
      entityType: 'LeaveRequest',
      entityId: leaveRequest.id,
      metadata: {
        leaveType: params.type,
        startDate: formatUtcDateString(normStart),
        endDate: formatUtcDateString(normEnd),
        daysCount,
        hasRetroactiveAttendance: retro.hasAttendance,
      },
    },
  });

  // 7. Dispatch Email Notification to Org Admin (Non-blocking)
  try {
    const orgAdmin = await prisma.user.findFirst({
      where: {
        organizationId: params.organizationId,
        role: 'ORG_ADMIN',
        status: 'ACTIVE',
      },
    });

    if (orgAdmin?.email) {
      const reviewUrl = `${params.originUrl || 'https://shiftguard.app'}/${staff.organization.organizationCode}/admin/leave/${leaveRequest.id}`;
      const payload = templateLeaveRequestSubmitted({
        orgName: staff.organization.name,
        staffName: staff.name,
        staffId: staff.staffId,
        leaveType: params.type,
        dateRange: `${formatUtcDateString(normStart)} to ${formatUtcDateString(normEnd)}`,
        daysCount,
        reason: params.reason,
        reviewUrl,
      });

      sendEmail({
        organizationId: params.organizationId,
        recipient: orgAdmin.email,
        type: 'LEAVE_REQUEST_SUBMITTED',
        subject: payload.subject,
        htmlContent: payload.html,
        textContent: payload.text,
      }).catch((emailErr) => {
        console.error('Non-blocking leave request email delivery error:', emailErr);
      });
    }
  } catch (emailErr) {
    console.error('Non-blocking leave request email preparation error:', emailErr);
  }

  return {
    leaveRequest,
    retroactiveWarning: retro.hasAttendance ? 'Attendance records exist for these dates. Admin approval is required.' : null,
  };
}

// -----------------------------------------------------------------------------
// 6. Approve Leave Request (Section 12, 21, 38, 50, 51)
// -----------------------------------------------------------------------------
export async function approveLeaveRequest(params: {
  organizationId: string;
  requestId: string;
  reviewerUserId: string;
  reviewerComment?: string;
  originUrl?: string;
}) {
  return await prisma.$transaction(async (tx) => {
    // 1. Fetch & lock leave request
    const request = await tx.leaveRequest.findUnique({
      where: { id: params.requestId },
      include: {
        staffProfile: {
          include: {
            user: true,
            organization: true,
          },
        },
      },
    });

    if (!request || request.organizationId !== params.organizationId) {
      throw new Error('Leave request not found.');
    }

    if (request.status !== 'PENDING') {
      throw new Error(`This leave request is already ${request.status.toLowerCase()}.`);
    }

    const year = request.startDate.getUTCFullYear();

    // 2. If ANNUAL or SICK, check & update balance transactionally
    if (request.type === 'ANNUAL' || request.type === 'SICK') {
      let balance = await tx.leaveBalance.findUnique({
        where: {
          staffProfileId_year_leaveType: {
            staffProfileId: request.staffProfileId,
            year,
            leaveType: request.type,
          },
        },
      });

      if (!balance) {
        balance = await tx.leaveBalance.create({
          data: {
            organizationId: params.organizationId,
            staffProfileId: request.staffProfileId,
            year,
            leaveType: request.type,
            entitlement: 12,
            used: 0,
          },
        });
      }

      const remaining = balance.entitlement - balance.used;
      if (remaining < request.daysCount) {
        throw new Error(`Cannot approve: insufficient ${request.type.toLowerCase()} balance. Available: ${remaining}, Required: ${request.daysCount}.`);
      }

      // Deduct used balance
      await tx.leaveBalance.update({
        where: { id: balance.id },
        data: {
          used: { increment: request.daysCount },
        },
      });
    }

    // 3. Update Leave Request
    const updated = await tx.leaveRequest.update({
      where: { id: request.id },
      data: {
        status: 'APPROVED',
        reviewerUserId: params.reviewerUserId,
        reviewedAt: new Date(),
        reviewerComment: params.reviewerComment?.trim() || null,
      },
    });

    // 4. Create Audit Log
    await tx.auditLog.create({
      data: {
        organizationId: params.organizationId,
        actorUserId: params.reviewerUserId,
        action: 'LEAVE_APPROVED',
        entityType: 'LeaveRequest',
        entityId: updated.id,
        metadata: {
          staffProfileId: request.staffProfileId,
          leaveType: request.type,
          startDate: formatUtcDateString(request.startDate),
          endDate: formatUtcDateString(request.endDate),
          daysCount: request.daysCount,
          reviewerComment: params.reviewerComment || null,
        },
      },
    });

    // 5. Send Staff Email Notification (isolated execution outside transaction failure)
    setTimeout(async () => {
      try {
        if (request.staffProfile.user.email) {
          const loginUrl = `${params.originUrl || 'https://shiftguard.app'}/${request.staffProfile.organization.organizationCode}/login`;
          const payload = templateLeaveApproved({
            orgName: request.staffProfile.organization.name,
            staffName: request.staffProfile.name,
            leaveType: request.type,
            dateRange: `${formatUtcDateString(request.startDate)} to ${formatUtcDateString(request.endDate)}`,
            daysCount: request.daysCount,
            reviewerComment: params.reviewerComment,
            loginUrl,
          });

          await sendEmail({
            organizationId: params.organizationId,
            recipient: request.staffProfile.user.email,
            type: 'LEAVE_APPROVED',
            subject: payload.subject,
            htmlContent: payload.html,
            textContent: payload.text,
          });
        }
      } catch (err) {
        console.error('Non-blocking approval email error:', err);
      }
    }, 0);

    return updated;
  }, { timeout: 30000, maxWait: 15000 });
}

// -----------------------------------------------------------------------------
// 7. Reject Leave Request (Section 12, 39, 52)
// -----------------------------------------------------------------------------
export async function rejectLeaveRequest(params: {
  organizationId: string;
  requestId: string;
  reviewerUserId: string;
  reviewerComment?: string;
  originUrl?: string;
}) {
  const request = await prisma.leaveRequest.findUnique({
    where: { id: params.requestId },
    include: {
      staffProfile: {
        include: {
          user: true,
          organization: true,
        },
      },
    },
  });

  if (!request || request.organizationId !== params.organizationId) {
    throw new Error('Leave request not found.');
  }

  if (request.status !== 'PENDING') {
    throw new Error(`This leave request is already ${request.status.toLowerCase()}.`);
  }

  const updated = await prisma.leaveRequest.update({
    where: { id: request.id },
    data: {
      status: 'REJECTED',
      reviewerUserId: params.reviewerUserId,
      reviewedAt: new Date(),
      reviewerComment: params.reviewerComment?.trim() || null,
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId: params.organizationId,
      actorUserId: params.reviewerUserId,
      action: 'LEAVE_REJECTED',
      entityType: 'LeaveRequest',
      entityId: updated.id,
      metadata: {
        staffProfileId: request.staffProfileId,
        leaveType: request.type,
        startDate: formatUtcDateString(request.startDate),
        endDate: formatUtcDateString(request.endDate),
        rejectionReason: params.reviewerComment || null,
      },
    },
  });

  // Send rejection email (Non-blocking)
  try {
    if (request.staffProfile.user.email) {
      const loginUrl = `${params.originUrl || 'https://shiftguard.app'}/${request.staffProfile.organization.organizationCode}/login`;
      const payload = templateLeaveRejected({
        orgName: request.staffProfile.organization.name,
        staffName: request.staffProfile.name,
        leaveType: request.type,
        dateRange: `${formatUtcDateString(request.startDate)} to ${formatUtcDateString(request.endDate)}`,
        rejectionReason: params.reviewerComment,
        loginUrl,
      });

      await sendEmail({
        organizationId: params.organizationId,
        recipient: request.staffProfile.user.email,
        type: 'LEAVE_REJECTED',
        subject: payload.subject,
        htmlContent: payload.html,
        textContent: payload.text,
      });
    }
  } catch (err) {
    console.error('Non-blocking rejection email error:', err);
  }

  return updated;
}

// -----------------------------------------------------------------------------
// 8. Cancel Staff Leave Request (Section 43)
// -----------------------------------------------------------------------------
export async function cancelStaffLeaveRequest(params: {
  organizationId: string;
  requestId: string;
  staffProfileId: string;
  userId: string;
}) {
  return await prisma.$transaction(async (tx) => {
    const request = await tx.leaveRequest.findUnique({
      where: { id: params.requestId },
    });

    if (!request || request.organizationId !== params.organizationId || request.staffProfileId !== params.staffProfileId) {
      throw new Error('Leave request not found.');
    }

    if (request.status !== 'PENDING' && request.status !== 'APPROVED') {
      throw new Error('This leave request cannot be cancelled.');
    }

    // If request was approved and leave was ANNUAL or SICK, restore used leave balance
    if (request.status === 'APPROVED' && (request.type === 'ANNUAL' || request.type === 'SICK')) {
      const year = request.startDate.getUTCFullYear();
      const balance = await tx.leaveBalance.findUnique({
        where: {
          staffProfileId_year_leaveType: {
            staffProfileId: request.staffProfileId,
            year,
            leaveType: request.type,
          },
        },
      });

      if (balance && balance.used >= request.daysCount) {
        await tx.leaveBalance.update({
          where: { id: balance.id },
          data: {
            used: { decrement: request.daysCount },
          },
        });
      }
    }

    const updated = await tx.leaveRequest.update({
      where: { id: request.id },
      data: { status: 'CANCELLED' },
    });

    await tx.auditLog.create({
      data: {
        organizationId: params.organizationId,
        actorUserId: params.userId,
        action: 'LEAVE_CANCELLED',
        entityType: 'LeaveRequest',
        entityId: updated.id,
        metadata: {
          staffProfileId: params.staffProfileId,
          previousStatus: request.status,
          cancelledAt: new Date().toISOString(),
        },
      },
    });

    return updated;
  });
}

// -----------------------------------------------------------------------------
// 9. Admin Manual Leave Creation (Section 8, 9, 40, 45)
// -----------------------------------------------------------------------------
export async function createAdminManualLeave(params: {
  organizationId: string;
  adminUserId: string;
  staffProfileId: string;
  type: LeaveType;
  startDate: Date | string;
  endDate: Date | string;
  reason: string;
  adminComment?: string;
  originUrl?: string;
}) {
  const normStart = normalizeDate(params.startDate);
  const normEnd = normalizeDate(params.endDate);

  if (normStart > normEnd) {
    throw new Error('Start date cannot be after end date.');
  }

  const daysCount = countDaysBetween(normStart, normEnd);
  const year = normStart.getUTCFullYear();

  // Fetch admin and staff
  const [adminUser, staff] = await Promise.all([
    prisma.user.findUnique({ where: { id: params.adminUserId } }),
    prisma.staffProfile.findFirst({
      where: { id: params.staffProfileId, organizationId: params.organizationId },
      include: { user: true, organization: true },
    }),
  ]);

  if (!adminUser || !staff) {
    throw new Error('Admin or Staff profile not found.');
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Balance adjustment if ANNUAL or SICK
    if (params.type === 'ANNUAL' || params.type === 'SICK') {
      let balance = await tx.leaveBalance.findUnique({
        where: {
          staffProfileId_year_leaveType: {
            staffProfileId: params.staffProfileId,
            year,
            leaveType: params.type,
          },
        },
      });

      if (!balance) {
        balance = await tx.leaveBalance.create({
          data: {
            organizationId: params.organizationId,
            staffProfileId: params.staffProfileId,
            year,
            leaveType: params.type,
            entitlement: 12,
            used: 0,
          },
        });
      }

      await tx.leaveBalance.update({
        where: { id: balance.id },
        data: { used: { increment: daysCount } },
      });
    }

    // 2. Create Approved Leave Request with isManualEntry = true
    const leave = await tx.leaveRequest.create({
      data: {
        organizationId: params.organizationId,
        staffProfileId: params.staffProfileId,
        type: params.type,
        startDate: normStart,
        endDate: normEnd,
        daysCount,
        reason: params.reason.trim(),
        status: 'APPROVED',
        isManualEntry: true,
        enteredByAdminId: params.adminUserId,
        reviewerUserId: params.adminUserId,
        reviewedAt: new Date(),
        reviewerComment: params.adminComment?.trim() || 'Manual entry by Administrator',
      },
    });

    // 3. Create Audit Log
    await tx.auditLog.create({
      data: {
        organizationId: params.organizationId,
        actorUserId: params.adminUserId,
        action: 'MANUAL_LEAVE_CREATED',
        entityType: 'LeaveRequest',
        entityId: leave.id,
        metadata: {
          staffProfileId: params.staffProfileId,
          leaveType: params.type,
          startDate: formatUtcDateString(normStart),
          endDate: formatUtcDateString(normEnd),
          daysCount,
          enteredByAdminName: adminUser.name,
          reason: params.reason,
        },
      },
    });

    // 4. Send Staff Email Notification (Non-blocking)
    setTimeout(async () => {
      try {
        if (staff.user.email) {
          const loginUrl = `${params.originUrl || 'https://shiftguard.app'}/${staff.organization.organizationCode}/login`;
          const payload = templateAdminManualLeave({
            orgName: staff.organization.name,
            staffName: staff.name,
            leaveType: params.type,
            dateRange: `${formatUtcDateString(normStart)} to ${formatUtcDateString(normEnd)}`,
            daysCount,
            reason: params.reason,
            adminName: adminUser.name,
            loginUrl,
          });

          await sendEmail({
            organizationId: params.organizationId,
            recipient: staff.user.email,
            type: 'MANUAL_LEAVE_CREATED',
            subject: payload.subject,
            htmlContent: payload.html,
            textContent: payload.text,
          });
        }
      } catch (err) {
        console.error('Non-blocking manual leave email error:', err);
      }
    }, 0);

    return leave;
  }, { timeout: 30000, maxWait: 15000 });
}
