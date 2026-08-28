import { getMonthlyEmployeeAttendanceReport } from './reports.service';
import { escapeCsvField } from './export-csv.service';
import { prisma } from '@/lib/prisma';

export interface MonthlyPayrollSummary {
  staff: {
    id: string;
    staffId: string;
    name: string;
    phone: string;
    email: string;
    defaultBranch: string;
  };
  period: {
    year: number;
    month: number;
    monthName: string;
    daysInMonth: number;
  };
  hoursMetrics: {
    scheduledHours: number;
    actualHoursWorked: number;
    actualMinutesWorked: number;
    actualWorkedFormatted: string; // e.g. "164h 30m"
    totalLateMinutes: number;
    totalLateFormatted: string; // e.g. "45m"
    totalEarlyDepartureMinutes: number;
    totalEarlyDepartureFormatted: string; // e.g. "15m"
    overtimeMinutes: number;
    overtimeFormatted: string; // e.g. "4h 15m"
  };
  attendanceCounts: {
    workingDaysCount: number;
    presentDaysCount: number;
    partialDaysCount: number;
    leaveDaysCount: number;
    absentDaysCount: number;
    holidayDaysCount: number;
  };
  dailyDetails: Array<{
    date: string;
    dayOfWeek: string;
    branchName: string;
    shiftName: string;
    scheduledStart: string | null;
    scheduledEnd: string | null;
    clockInTime: string | null;
    clockOutTime: string | null;
    status: string;
    workedMinutes: number;
    workedFormatted: string;
    lateMinutes: number;
    overtimeMinutes: number;
  }>;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export async function getStaffMonthlyPayrollSummary(params: {
  organizationId: string;
  year: number;
  month: number;
  staffId: string;
  branchId?: string;
}): Promise<MonthlyPayrollSummary> {
  const report = await getMonthlyEmployeeAttendanceReport({
    organizationId: params.organizationId,
    year: params.year,
    month: params.month,
    staffId: params.staffId,
    branchId: params.branchId,
  });

  let totalWorkedMinutes = 0;
  let totalScheduledMinutes = 0;
  let totalLateMinutes = 0;
  let totalEarlyDepartureMinutes = 0;
  let totalOvertimeMinutes = 0;

  const dailyDetails: MonthlyPayrollSummary['dailyDetails'] = [];

  for (const row of report.daysRows) {
    let dayWorkedMinutes = 0;
    let dayOvertimeMinutes = 0;

    // Calculate scheduled minutes
    if (row.scheduledStart && row.scheduledEnd) {
      const [sH, sM] = row.scheduledStart.split(':').map((v) => parseInt(v, 10));
      const [eH, eM] = row.scheduledEnd.split(':').map((v) => parseInt(v, 10));
      let startMins = sH * 60 + sM;
      let endMins = eH * 60 + eM;
      if (endMins < startMins) endMins += 24 * 60; // Overnight shift
      totalScheduledMinutes += Math.max(0, endMins - startMins);
    }

    // Calculate actual worked minutes if clock-in and clock-out exist
    if (row.clockInIso && row.clockOutIso) {
      const inTime = new Date(row.clockInIso).getTime();
      const outTime = new Date(row.clockOutIso).getTime();
      if (outTime > inTime) {
        dayWorkedMinutes = Math.floor((outTime - inTime) / (1000 * 60));
        totalWorkedMinutes += dayWorkedMinutes;

        // Check if worked beyond scheduled end time for overtime
        if (row.scheduledEnd) {
          const [eH, eM] = row.scheduledEnd.split(':').map((v) => parseInt(v, 10));
          const outDate = new Date(row.clockOutIso);
          const outMins = outDate.getUTCHours() * 60 + outDate.getUTCMinutes();
          const schedEndMins = eH * 60 + eM;
          if (outMins > schedEndMins) {
            dayOvertimeMinutes = outMins - schedEndMins;
            totalOvertimeMinutes += dayOvertimeMinutes;
          }
        }
      }
    }

    dailyDetails.push({
      date: row.date,
      dayOfWeek: row.dayOfWeek,
      branchName: row.branchName,
      shiftName: row.shiftPatternName,
      scheduledStart: row.scheduledStart,
      scheduledEnd: row.scheduledEnd,
      clockInTime: row.clockInTime,
      clockOutTime: row.clockOutTime,
      status: row.status,
      workedMinutes: dayWorkedMinutes,
      workedFormatted: formatMinutesToHoursStr(dayWorkedMinutes),
      lateMinutes: 0,
      overtimeMinutes: dayOvertimeMinutes,
    });
  }

  const actualHoursWorked = parseFloat((totalWorkedMinutes / 60).toFixed(1));
  const scheduledHours = parseFloat((totalScheduledMinutes / 60).toFixed(1));

  return {
    staff: {
      id: report.staff.id,
      staffId: report.staff.staffId,
      name: report.staff.name,
      phone: report.staff.phone,
      email: '',
      defaultBranch: report.staff.defaultBranch,
    },
    period: {
      year: params.year,
      month: params.month,
      monthName: MONTH_NAMES[params.month - 1] || 'Unknown',
      daysInMonth: report.monthlyMetrics.daysInMonth,
    },
    hoursMetrics: {
      scheduledHours,
      actualHoursWorked,
      actualMinutesWorked: totalWorkedMinutes,
      actualWorkedFormatted: formatMinutesToHoursStr(totalWorkedMinutes),
      totalLateMinutes,
      totalLateFormatted: `${totalLateMinutes}m`,
      totalEarlyDepartureMinutes,
      totalEarlyDepartureFormatted: `${totalEarlyDepartureMinutes}m`,
      overtimeMinutes: totalOvertimeMinutes,
      overtimeFormatted: formatMinutesToHoursStr(totalOvertimeMinutes),
    },
    attendanceCounts: {
      workingDaysCount: report.monthlyMetrics.workingDaysCount,
      presentDaysCount: report.monthlyMetrics.presentDaysCount,
      partialDaysCount: report.monthlyMetrics.partialDaysCount,
      leaveDaysCount: report.monthlyMetrics.leaveDaysCount,
      absentDaysCount: report.monthlyMetrics.absentDaysCount,
      holidayDaysCount: report.monthlyMetrics.holidayDaysCount,
    },
    dailyDetails,
  };
}

function formatMinutesToHoursStr(totalMinutes: number): string {
  if (!totalMinutes || totalMinutes <= 0) return '0h 0m';
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${m}m`;
}

/**
 * Generates CSV string for Payroll Summary export
 */
export function generatePayrollSummaryCsv(params: {
  organizationName: string;
  summary: MonthlyPayrollSummary;
}): string {
  const s = params.summary;
  const lines: string[] = [];

  lines.push(escapeCsvField(`ShiftGuard SaaS — Staff Monthly Payroll & Hours Summary`));
  lines.push(escapeCsvField(`Organization: ${params.organizationName}`));
  lines.push(escapeCsvField(`Staff Member: ${s.staff.name} (ID: ${s.staff.staffId})`));
  lines.push(escapeCsvField(`Period: ${s.period.monthName} ${s.period.year}`));
  lines.push(escapeCsvField(`Total Actual Hours Worked: ${s.hoursMetrics.actualWorkedFormatted} (${s.hoursMetrics.actualHoursWorked} hrs)`));
  lines.push(escapeCsvField(`Total Scheduled Hours: ${s.hoursMetrics.scheduledHours} hrs`));
  lines.push(escapeCsvField(`Total Overtime: ${s.hoursMetrics.overtimeFormatted}`));
  lines.push('');

  const headers = [
    'Date',
    'Day',
    'Branch',
    'Shift',
    'Scheduled Start',
    'Scheduled End',
    'Clock In',
    'Clock Out',
    'Status',
    'Worked Duration',
    'Overtime',
  ];

  lines.push(headers.map(escapeCsvField).join(','));

  for (const day of s.dailyDetails) {
    const line = [
      day.date,
      day.dayOfWeek,
      day.branchName,
      day.shiftName,
      day.scheduledStart || '—',
      day.scheduledEnd || '—',
      day.clockInTime || '—',
      day.clockOutTime || '—',
      day.status,
      day.workedFormatted,
      formatMinutesToHoursStr(day.overtimeMinutes),
    ];
    lines.push(line.map(escapeCsvField).join(','));
  }

  return '\uFEFF' + lines.join('\n');
}
