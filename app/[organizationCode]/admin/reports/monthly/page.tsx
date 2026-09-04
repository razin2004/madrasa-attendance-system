import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Download,
  Printer,
  RefreshCw,
  Search,
  User,
  MapPin,
  FileText,
  Loader2,
  Menu,
} from 'lucide-react';
import { OrgAdminSidebar } from '@/components/layout/org-admin-sidebar';
import { OrgAdminMobileNav } from '@/components/layout/org-admin-mobile-nav';
import { useToast } from '@/components/feedback/toast-provider';
import styles from './MonthlyReport.module.css';

interface StaffOption {
  id: string;
  name: string;
  staffId: string;
}

interface BranchOption {
  id: string;
  name: string;
}

export default function MonthlyReportPage() {
  const params = useParams();
  const organizationCode = (params.organizationCode as string)?.toUpperCase() || '';
  const router = useRouter();
  const toast = useToast();

  const now = new Date();
  const [year, setYear] = useState<number>(now.getUTCFullYear());
  const [month, setMonth] = useState<number>(now.getUTCMonth() + 1);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [branchId, setBranchId] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [source, setSource] = useState<string>('');
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);

  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [branchList, setBranchList] = useState<BranchOption[]>([]);
  const [orgData, setOrgData] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [report, setReport] = useState<any>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/org/${organizationCode}/branding`).then((r) => r.json()),
      fetch(`/api/org/${organizationCode}/branches`).then((r) => r.json()),
      fetch(`/api/org/${organizationCode}/staff`).then((r) => r.json()),
    ])
      .then(([metaRes, branchRes, staffRes]) => {
        if (metaRes.organization) setOrgData(metaRes.organization);
        if (branchRes.branches) setBranchList(branchRes.branches);
        if (staffRes.staffMembers) {
          setStaffList(staffRes.staffMembers);
          if (staffRes.staffMembers.length > 0) {
            setSelectedStaffId(staffRes.staffMembers[0].id);
          }
        }
      })
      .catch((err) => console.error('Error fetching metadata:', err));
  }, [organizationCode]);

  const fetchReport = async () => {
    if (!selectedStaffId) return;

    try {
      setLoading(true);
      let url = `/api/org/${organizationCode}/reports/monthly?year=${year}&month=${month}&staffId=${selectedStaffId}`;
      if (branchId) url += `&branchId=${branchId}`;
      if (status) url += `&status=${status}`;
      if (source) url += `&source=${source}`;

      const res = await fetch(url);
      const data = await res.json();

      if (res.ok && data.success) {
        setReport(data.report);
      } else {
        toast.error(data.error || 'Failed to load monthly report.');
      }
    } catch {
      toast.error('Network error loading report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedStaffId) {
      fetchReport();
    }
  }, [organizationCode, year, month, selectedStaffId, branchId, status, source]);

  const months = [
    { num: 1, name: 'January' },
    { num: 2, name: 'February' },
    { num: 3, name: 'March' },
    { num: 4, name: 'April' },
    { num: 5, name: 'May' },
    { num: 6, name: 'June' },
    { num: 7, name: 'July' },
    { num: 8, name: 'August' },
    { num: 9, name: 'September' },
    { num: 10, name: 'October' },
    { num: 11, name: 'November' },
    { num: 12, name: 'December' },
  ];

  const buildExportQuery = () => {
    let q = `reportType=MONTHLY&year=${year}&month=${month}&staffId=${selectedStaffId}`;
    if (branchId) q += `&branchId=${branchId}`;
    if (status) q += `&status=${status}`;
    if (source) q += `&source=${source}`;
    return q;
  };

  const handleCsvExport = () => {
    setExportingCsv(true);
    const url = `/api/org/${organizationCode}/reports/export/csv?${buildExportQuery()}`;
    window.open(url, '_blank');
    setTimeout(() => setExportingCsv(false), 2000);
    toast.success('CSV export initiated.');
  };

  const handlePdfExport = () => {
    setExportingPdf(true);
    const url = `/api/org/${organizationCode}/reports/export/pdf?print=true&${buildExportQuery()}`;
    window.open(url, '_blank');
    setTimeout(() => setExportingPdf(false), 2000);
    toast.success('PDF print/export initiated.');
  };

  const metrics = report?.monthlyMetrics;

  const [payrollSummary, setPayrollSummary] = useState<any>(null);
  const [exportingPayroll, setExportingPayroll] = useState(false);

  const fetchPayroll = async () => {
    if (!selectedStaffId) return;
    try {
      const res = await fetch(`/api/org/${organizationCode}/reports/payroll?year=${year}&month=${month}&staffId=${selectedStaffId}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setPayrollSummary(data.summary);
      }
    } catch (e) {
      console.error('Error fetching payroll summary:', e);
    }
  };

  useEffect(() => {
    if (selectedStaffId) {
      fetchPayroll();
    }
  }, [organizationCode, year, month, selectedStaffId]);

  const handlePayrollCsvExport = () => {
    if (!selectedStaffId) return;
    setExportingPayroll(true);
    const url = `/api/org/${organizationCode}/reports/export/payroll-csv?year=${year}&month=${month}&staffId=${selectedStaffId}`;
    window.open(url, '_blank');
    setTimeout(() => setExportingPayroll(false), 2000);
    toast.success('Payroll & Hours CSV export initiated.');
  };

  return (
    <div className={styles.container}>
      <OrgAdminSidebar
        organizationCode={organizationCode}
        organizationName={orgData?.name || 'ShiftGuard'}
        logoUrl={orgData?.logoUrl}
      />

      <div className={styles.mainContent}>
        <header className={styles.headerBar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <Link href={`/${organizationCode}/admin/reports`} className="btn btn-secondary btn-sm" style={{ padding: '8px' }}>
              <ArrowLeft size={16} />
            </Link>
            <div>
              <h1 className={styles.title}>Employee Monthly Attendance Report</h1>
              <p className={styles.subtitle}>
                Monthly calendar breakdown &amp; metrics for{' '}
                <strong
                  onClick={() => selectedStaffId && router.push(`/${organizationCode}/admin/staff/${selectedStaffId}`)}
                  style={{ cursor: 'pointer', color: '#818cf8', textDecoration: 'underline' }}
                  title="View Staff Profile"
                >
                  {report?.staff?.name || 'Selected Employee'}
                </strong>{' '}
                (ID: {report?.staff?.staffId || '—'})
              </p>
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setHeaderMenuOpen(!headerMenuOpen)}
              className="btn btn-secondary btn-sm"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '38px',
                height: '38px',
                padding: 0,
                borderRadius: '10px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-medium)',
                color: '#ffffff',
                cursor: 'pointer',
              }}
              title="Monthly Report Actions"
            >
              <Menu size={18} />
            </button>

            {headerMenuOpen && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 999 }}
                  onClick={() => setHeaderMenuOpen(false)}
                />
                <div
                  className="glass-card"
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 'calc(100% + 8px)',
                    zIndex: 1000,
                    minWidth: '220px',
                    padding: '6px',
                    backgroundColor: '#0d121f',
                    border: '1px solid var(--border-medium)',
                    borderRadius: '12px',
                    boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.8)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setHeaderMenuOpen(false);
                      handlePayrollCsvExport();
                    }}
                    disabled={exportingPayroll}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      color: '#34d399',
                      border: 'none',
                      background: 'none',
                      width: '100%',
                      textAlign: 'left',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <FileText size={15} color="#34d399" />
                    <span>{exportingPayroll ? 'Preparing Payroll...' : 'Export Payroll CSV'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setHeaderMenuOpen(false);
                      handleCsvExport();
                    }}
                    disabled={exportingCsv}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      color: '#ffffff',
                      border: 'none',
                      background: 'none',
                      width: '100%',
                      textAlign: 'left',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <Download size={15} color="#34d399" />
                    <span>{exportingCsv ? 'Preparing CSV...' : 'Export CSV'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setHeaderMenuOpen(false);
                      handlePdfExport();
                    }}
                    disabled={exportingPdf}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      color: '#ffffff',
                      border: 'none',
                      background: 'none',
                      width: '100%',
                      textAlign: 'left',
                      fontSize: '13px',
                      fontWeight: 600,
                    }}
                  >
                    <Printer size={15} color="#38bdf8" />
                    <span>{exportingPdf ? 'Preparing PDF...' : 'Print / Save PDF'}</span>
                  </button>

                  <Link
                    href={`/${organizationCode}/admin/reports`}
                    onClick={() => setHeaderMenuOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      color: '#cbd5e1',
                      textDecoration: 'none',
                      fontSize: '13px',
                      fontWeight: 500,
                    }}
                  >
                    <ArrowLeft size={15} color="#818cf8" />
                    <span>Reports Dashboard</span>
                  </Link>
                </div>
              </>
            )}
          </div>
        </header>

        <main className="pageMainContent" style={{ maxWidth: '1280px' }}>

        {/* Monthly Summary Metrics Bar */}
        <div className={styles.metricsGrid}>
          <div className={styles.metricCard} style={{ borderLeft: '3px solid #3b82f6' }}>
            <div className={styles.metricLabel}>Working Days</div>
            <div className={styles.metricValue}>{metrics?.workingDaysCount || 0}</div>
          </div>

          <div className={styles.metricCard} style={{ borderLeft: '3px solid #10b981' }}>
            <div className={styles.metricLabel}>Present Days</div>
            <div className={styles.metricValue} style={{ color: '#34d399' }}>
              {metrics?.presentDaysCount || 0}
            </div>
          </div>

          <div className={styles.metricCard} style={{ borderLeft: '3px solid #f59e0b' }}>
            <div className={styles.metricLabel}>Partial Days</div>
            <div className={styles.metricValue} style={{ color: '#fbbf24' }}>
              {metrics?.partialDaysCount || 0}
            </div>
          </div>

          <div className={styles.metricCard} style={{ borderLeft: '3px solid #38bdf8' }}>
            <div className={styles.metricLabel}>Approved Leave</div>
            <div className={styles.metricValue} style={{ color: '#38bdf8' }}>
              {metrics?.leaveDaysCount || 0}
            </div>
          </div>

          <div className={styles.metricCard} style={{ borderLeft: '3px solid #818cf8' }}>
            <div className={styles.metricLabel}>Holidays</div>
            <div className={styles.metricValue} style={{ color: '#818cf8' }}>
              {metrics?.holidayDaysCount || 0}
            </div>
          </div>

          <div className={styles.metricCard} style={{ borderLeft: '3px solid #ef4444' }}>
            <div className={styles.metricLabel}>Absent Days</div>
            <div className={styles.metricValue} style={{ color: '#f87171' }}>
              {metrics?.absentDaysCount || 0}
            </div>
          </div>

          <div className={styles.metricCard} style={{ borderLeft: '3px solid #059669' }}>
            <div className={styles.metricLabel}>Normal Verified</div>
            <div className={styles.metricValue} style={{ color: '#34d399' }}>
              {metrics?.normalEntriesCount || 0}
            </div>
          </div>

          <div className={styles.metricCard} style={{ borderLeft: '3px solid #d97706' }}>
            <div className={styles.metricLabel}>Manual / Adjusted</div>
            <div className={styles.metricValue} style={{ color: '#fbbf24' }}>
              {(metrics?.manualEntriesCount || 0) + (metrics?.adjustedEntriesCount || 0)}
            </div>
          </div>
        </div>

        {/* Payroll Hours Breakdown Banner */}
        {payrollSummary && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', margin: '0 32px 24px 32px' }}>
            <div style={{ background: 'rgba(52, 211, 153, 0.08)', border: '1px solid rgba(52, 211, 153, 0.25)', borderRadius: '10px', padding: '14px 18px' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#34d399', fontWeight: 700 }}>Total Hours Worked</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', marginTop: '4px' }}>
                {payrollSummary.hoursMetrics.actualWorkedFormatted}
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginLeft: '6px' }}>({payrollSummary.hoursMetrics.actualHoursWorked} hrs)</span>
              </div>
            </div>

            <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '10px', padding: '14px 18px' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#38bdf8', fontWeight: 700 }}>Total Scheduled Shift Hours</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', marginTop: '4px' }}>
                {payrollSummary.hoursMetrics.scheduledHours} hrs
              </div>
            </div>

            <div style={{ background: 'rgba(251, 191, 36, 0.08)', border: '1px solid rgba(251, 191, 36, 0.25)', borderRadius: '10px', padding: '14px 18px' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#fbbf24', fontWeight: 700 }}>Total Overtime Worked</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', marginTop: '4px' }}>
                {payrollSummary.hoursMetrics.overtimeFormatted}
              </div>
            </div>
          </div>
        )}

        {/* Filter Bar */}
        <div className={styles.filterBar}>
          <div className={styles.filterItem}>
            <span className={styles.filterLabel}>Select Staff:</span>
            <select
              className={styles.select}
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
            >
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.staffId})
                </option>
              ))}
            </select>
          </div>

          <div className={styles.filterItem}>
            <span className={styles.filterLabel}>Month:</span>
            <select
              className={styles.select}
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value, 10))}
            >
              {months.map((m) => (
                <option key={m.num} value={m.num}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.filterItem}>
            <span className={styles.filterLabel}>Year:</span>
            <select
              className={styles.select}
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10))}
            >
              {[2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.filterItem}>
            <span className={styles.filterLabel}>Branch:</span>
            <select
              className={styles.select}
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
            >
              <option value="">All Branches</option>
              {branchList.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={fetchReport}
            className="btn btn-secondary btn-sm"
            style={{ padding: '8px 12px' }}
            title="Refresh"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Monthly Log Table */}
        <div className={styles.tableCard}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <Loader2 size={32} className="animate-spin" style={{ color: '#818cf8', margin: '0 auto 12px auto' }} />
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Calculating monthly report...</p>
            </div>
          ) : !report?.daysRows || report.daysRows.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <Calendar size={36} color="var(--text-muted)" style={{ margin: '0 auto 12px auto' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', margin: '0 0 4px 0' }}>
                No attendance data available for this month
              </h3>
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Date</th>
                  <th className={styles.th}>Day</th>
                  <th className={styles.th}>Shift Pattern</th>
                  <th className={styles.th}>Branch</th>
                  <th className={styles.th}>Clock In</th>
                  <th className={styles.th}>Clock Out</th>
                  <th className={styles.th}>Status</th>
                  <th className={styles.th}>Source</th>
                  <th className={styles.th}>Leave / Reason Details</th>
                </tr>
              </thead>
              <tbody>
                {report.daysRows.map((row: any, idx: number) => {
                  const statusKey = row.status.replace(/ /g, '_');
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td className={styles.td}>
                        <strong style={{ color: '#ffffff' }}>{row.date.slice(8, 10)}</strong>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '4px' }}>
                          ({row.date.slice(0, 7)})
                        </span>
                      </td>

                      <td className={styles.td}>
                        <span style={{ color: '#cbd5e1' }}>{row.dayOfWeek}</span>
                      </td>

                      <td className={styles.td}>
                        <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                          {row.shiftPatternName}
                        </span>
                      </td>

                      <td className={styles.td}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <MapPin size={12} color="#38bdf8" />
                          <span style={{ color: '#f8fafc' }}>{row.branchName}</span>
                        </span>
                      </td>

                      <td className={styles.td}>
                        <strong style={{ color: '#34d399', fontFamily: 'var(--font-mono)' }}>{row.clockInTime || '—'}</strong>
                      </td>

                      <td className={styles.td}>
                        <strong style={{ color: '#fbbf24', fontFamily: 'var(--font-mono)' }}>{row.clockOutTime || '—'}</strong>
                      </td>

                      <td className={styles.td}>
                        <span className={`${styles.statusBadge} ${styles[`status${statusKey}`]}`}>
                          {row.status}
                        </span>
                      </td>

                      <td className={styles.td}>
                        {row.source !== '—' ? (
                          <span className={`${styles.sourceBadge} ${styles[`source${row.source}`]}`}>
                            {row.source}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>

                      <td className={styles.td} style={{ fontSize: '12px' }}>
                        {row.leaveTypeName && (
                          <span style={{ color: '#38bdf8', fontWeight: 600 }}>
                            {row.leaveTypeName}
                          </span>
                        )}
                        {row.manualReason && (
                          <span style={{ color: '#fbbf24', fontStyle: 'italic', marginLeft: '6px' }}>
                            &ldquo;{row.manualReason}&rdquo;
                          </span>
                        )}
                        {row.adjustmentReason && (
                          <span style={{ color: '#38bdf8', fontStyle: 'italic', marginLeft: '6px' }}>
                            &ldquo;{row.adjustmentReason}&rdquo;
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        </main>
      </div>
      <OrgAdminMobileNav organizationCode={organizationCode} />
    </div>
  );
}
