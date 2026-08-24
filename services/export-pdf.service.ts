import { AttendanceReportRow, ReportMetricsSummary } from './reports.service';

export interface GeneratePdfParams {
  organizationName: string;
  logoUrl?: string | null;
  reportTitle: string;
  filterSummaryStr: string;
  generatedAt: string;
  metrics?: ReportMetricsSummary | any;
  rows: AttendanceReportRow[];
}

/**
 * Generates printable HTML string for PDF rendering (Section 41, 42, 67)
 */
export function generateAttendanceReportPdfHtml(params: GeneratePdfParams): string {
  const logoHtml = params.logoUrl
    ? `<img src="${params.logoUrl}" alt="${params.organizationName}" style="height: 48px; width: auto; object-fit: contain;" />`
    : `<div style="font-size: 20px; font-weight: 800; color: #3b82f6;">${params.organizationName}</div>`;

  const rowsHtml = params.rows
    .map((r, idx) => {
      const isAlt = idx % 2 === 1;
      const statusColor =
        r.status === 'PRESENT'
          ? '#10b981'
          : r.status === 'PARTIAL'
          ? '#f59e0b'
          : r.status === 'HOLIDAY'
          ? '#818cf8'
          : r.status === 'APPROVED LEAVE'
          ? '#38bdf8'
          : r.status === 'ABSENT'
          ? '#ef4444'
          : '#64748b';

      const sourceColor =
        r.source === 'NORMAL'
          ? '#059669'
          : r.source === 'MANUAL'
          ? '#d97706'
          : r.source === 'ADJUSTED'
          ? '#0284c7'
          : '#64748b';

      return `
        <tr style="background-color: ${isAlt ? '#f8fafc' : '#ffffff'}; border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 10px 12px; font-weight: 600; color: #0f172a;">${r.staffName}<br/><span style="font-size: 11px; font-weight: 400; color: #64748b;">ID: ${r.staffId}</span></td>
          <td style="padding: 10px 12px; color: #334155;">${r.date}<br/><span style="font-size: 11px; color: #64748b;">${r.dayOfWeek}</span></td>
          <td style="padding: 10px 12px; color: #334155;">${r.branchName}</td>
          <td style="padding: 10px 12px; color: #334155;">${r.shiftPatternName}</td>
          <td style="padding: 10px 12px; font-weight: 700; color: #059669;">${r.clockInTime || '—'}</td>
          <td style="padding: 10px 12px; font-weight: 700; color: #d97706;">${r.clockOutTime || '—'}</td>
          <td style="padding: 10px 12px;">
            <span style="display: inline-block; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px; color: ${statusColor}; border: 1px solid ${statusColor}; text-transform: uppercase;">
              ${r.status}
            </span>
          </td>
          <td style="padding: 10px 12px;">
            <span style="font-size: 11px; font-weight: 700; color: ${sourceColor};">
              ${r.source}
            </span>
          </td>
          <td style="padding: 10px 12px; font-size: 11.5px; color: #475569;">
            ${r.leaveTypeName ? `<strong>${r.leaveTypeName}</strong>` : ''}
            ${r.conflictDetails ? `<div style="color: #c2410c;">⚠️ ${r.conflictDetails}</div>` : ''}
            ${r.manualReason ? `<div><em>Manual: ${r.manualReason}</em></div>` : ''}
          </td>
        </tr>
      `;
    })
    .join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${params.reportTitle} — ${params.organizationName}</title>
  <style>
    @page { size: A4 landscape; margin: 15mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 20px; background: #ffffff; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0284c7; padding-bottom: 16px; margin-bottom: 20px; }
    .title { font-size: 22px; font-weight: 800; color: #0f172a; margin: 0 0 4px 0; }
    .subtitle { font-size: 12px; color: #64748b; margin: 0; }
    .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; font-size: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; }
    .table { width: 100%; border-collapse: collapse; text-align: left; font-size: 12px; }
    .th { background: #0f172a; color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 10px 12px; }
    .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 16px; text-align: right;">
    <button onclick="window.print()" style="background: #0284c7; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-weight: 600; cursor: pointer;">
      🖨️ Print / Save as PDF
    </button>
  </div>

  <div class="header">
    <div>
      <h1 class="title">${params.reportTitle}</h1>
      <p class="subtitle">ShiftGuard SaaS — Official Organization Attendance Report</p>
    </div>
    <div>${logoHtml}</div>
  </div>

  <div class="meta-box">
    <div>
      <strong>Organization:</strong> ${params.organizationName}<br/>
      <strong>Applied Filters:</strong> ${params.filterSummaryStr}
    </div>
    <div style="text-align: right;">
      <strong>Generated At:</strong> ${params.generatedAt}<br/>
      <strong>Total Records:</strong> ${params.rows.length}
    </div>
  </div>

  <table class="table">
    <thead>
      <tr>
        <th class="th">Staff Member</th>
        <th class="th">Date</th>
        <th class="th">Branch</th>
        <th class="th">Shift</th>
        <th class="th">Clock In</th>
        <th class="th">Clock Out</th>
        <th class="th">Status</th>
        <th class="th">Source</th>
        <th class="th">Details</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <div class="footer">
    ShiftGuard SaaS Multi-Tenant Rostering &amp; Time-Attendance Platform &bull; Confidential
  </div>

  <script>
    // Auto-trigger print dialog if opened in preview
    if (window.location.search.includes('print=true')) {
      window.onload = function() { window.print(); };
    }
  </script>
</body>
</html>
  `;
}
