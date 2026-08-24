import { AttendanceReportRow } from './reports.service';

/**
 * Escapes a single string field for CSV format (RFC 4180 compliance)
 */
export function escapeCsvField(val: string | number | boolean | null | undefined): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates CSV string for Attendance Report rows (Section 39, 40, 66)
 */
export function generateAttendanceReportCsv(params: {
  organizationName: string;
  reportType: 'DAILY' | 'MONTHLY';
  rows: AttendanceReportRow[];
}): string {
  const headers = [
    'Organization',
    'Staff ID',
    'Staff Name',
    'Date',
    'Day',
    'Branch',
    'Shift Pattern',
    'Scheduled Start',
    'Scheduled End',
    'Clock In',
    'Clock Out',
    'Status',
    'Source',
    'Leave Type',
    'Reason / Justification',
  ];

  const csvLines: string[] = [];
  csvLines.push(headers.map(escapeCsvField).join(','));

  for (const row of params.rows) {
    const line = [
      params.organizationName,
      row.staffId,
      row.staffName,
      row.date,
      row.dayOfWeek,
      row.branchName,
      row.shiftPatternName,
      row.scheduledStart || '—',
      row.scheduledEnd || '—',
      row.clockInTime || '—',
      row.clockOutTime || '—',
      row.status,
      row.source,
      row.leaveTypeName || '—',
      row.leaveReason || row.manualReason || row.adjustmentReason || row.conflictDetails || '—',
    ];

    csvLines.push(line.map(escapeCsvField).join(','));
  }

  // Prepend UTF-8 BOM so Excel opens special characters correctly
  return '\uFEFF' + csvLines.join('\n');
}
