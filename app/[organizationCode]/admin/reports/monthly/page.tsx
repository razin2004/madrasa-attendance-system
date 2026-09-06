'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Download,
  Filter,
  Printer,
  RefreshCw,
  Search,
  User,
  MapPin,
  FileText,
  Loader2,
  Menu,
  X,
  ChevronRight,
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
  const [showMobileFilters, setShowMobileFilters] = useState<boolean>(false);

  // Header Menu Dropdown & Click Outside Ref
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const headerMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node)) {
        setHeaderMenuOpen(false);
      }
    };
    if (headerMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [headerMenuOpen]);

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
        {/* Sticky Mobile Header */}
        <header className={styles.headerBar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#10b981',
                boxShadow: '0 0 8px rgba(16, 185, 129, 0.6)',
                flexShrink: 0,
              }}
            />
            <div>
              <h1 className={styles.title}>Employee Monthly Report</h1>
              <p className={styles.subtitle}>
                Monthly breakdown for{' '}
                <strong
                  onClick={() => selectedStaffId && router.push(`/${organizationCode}/admin/staff/${selectedStaffId}`)}
                  style={{ cursor: 'pointer', color: '#818cf8', textDecoration: 'underline' }}
                  title="View Staff Profile"
                >
                  {report?.staff?.name || 'Selected Employee'}
                </strong>{' '}
                ({report?.staff?.staffId || '—'})
              </p>
            </div>
          </div>

          <div style={{ position: 'relative' }} ref={headerMenuRef}>
            <button
              onClick={() => setHeaderMenuOpen(!headerMenuOpen)}
              className="btn btn-secondary btn-sm"
              style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '8px' }}
              aria-label="Toggle Monthly Report Menu"
            >
              {headerMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>

            {headerMenuOpen && (
              <div
                className={styles.headerMenuDropdown}
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 8px)',
                  width: '220px',
                  backgroundColor: '#0f172a',
                  border: '1px solid var(--border-medium, rgba(255,255,255,0.15))',
                  borderRadius: '12px',
                  padding: '8px',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                  zIndex: 100,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setHeaderMenuOpen(false);
                    handlePayrollCsvExport();
                  }}
                  disabled={exportingPayroll}
                  className="btn btn-ghost btn-sm"
                  style={{ justifyContent: 'flex-start', gap: '8px', width: '100%', color: '#34d399', fontSize: '12.5px' }}
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
                  className="btn btn-ghost btn-sm"
                  style={{ justifyContent: 'flex-start', gap: '8px', width: '100%', color: '#f8fafc', fontSize: '12.5px' }}
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
                  className="btn btn-ghost btn-sm"
                  style={{ justifyContent: 'flex-start', gap: '8px', width: '100%', color: '#f8fafc', fontSize: '12.5px' }}
                >
                  <Printer size={15} color="#38bdf8" />
                  <span>{exportingPdf ? 'Preparing PDF...' : 'Print / Save PDF'}</span>
                </button>

                <Link
                  href={`/${organizationCode}/admin/reports`}
                  className="btn btn-ghost btn-sm"
                  style={{ justifyContent: 'flex-start', gap: '8px', width: '100%', textDecoration: 'none', color: '#f8fafc', fontSize: '12.5px' }}
                  onClick={() => setHeaderMenuOpen(false)}
                >
                  <ArrowLeft size={15} color="#818cf8" />
                  <span>Reports Dashboard</span>
                </Link>
              </div>
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
              <div className={styles.metricLabel}>Present</div>
              <div className={styles.metricValue} style={{ color: '#34d399' }}>
                {metrics?.presentDaysCount || 0}
              </div>
            </div>

            <div className={styles.metricCard} style={{ borderLeft: '3px solid #f59e0b' }}>
              <div className={styles.metricLabel}>Partial</div>
              <div className={styles.metricValue} style={{ color: '#fbbf24' }}>
                {metrics?.partialDaysCount || 0}
              </div>
            </div>

            <div className={styles.metricCard} style={{ borderLeft: '3px solid #38bdf8' }}>
              <div className={styles.metricLabel}>Leave</div>
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
              <div className={styles.metricLabel}>Absent</div>
              <div className={styles.metricValue} style={{ color: '#f87171' }}>
                {metrics?.absentDaysCount || 0}
              </div>
            </div>

            <div className={styles.metricCard} style={{ borderLeft: '3px solid #059669' }}>
              <div className={styles.metricLabel}>Normal</div>
              <div className={styles.metricValue} style={{ color: '#34d399' }}>
                {metrics?.normalEntriesCount || 0}
              </div>
            </div>

            <div className={styles.metricCard} style={{ borderLeft: '3px solid #d97706' }}>
              <div className={styles.metricLabel}>Manual / Adjust</div>
              <div className={styles.metricValue} style={{ color: '#fbbf24' }}>
                {(metrics?.manualEntriesCount || 0) + (metrics?.adjustedEntriesCount || 0)}
              </div>
            </div>
          </div>

          {/* Payroll Hours Breakdown Banner */}
          {payrollSummary && (
            <div className={styles.payrollGrid}>
              <div style={{ background: 'rgba(52, 211, 153, 0.08)', border: '1px solid rgba(52, 211, 153, 0.25)', borderRadius: '10px', padding: '12px 14px' }}>
                <div style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#34d399', fontWeight: 700 }}>Total Hours Worked</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', marginTop: '3px' }}>
                  {payrollSummary.hoursMetrics.actualWorkedFormatted}
                  <span style={{ fontSize: '11.5px', fontWeight: 500, color: 'var(--text-secondary)', marginLeft: '6px' }}>({payrollSummary.hoursMetrics.actualHoursWorked} hrs)</span>
                </div>
              </div>

              <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '10px', padding: '12px 14px' }}>
                <div style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#38bdf8', fontWeight: 700 }}>Scheduled Shift Hours</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', marginTop: '3px' }}>
                  {payrollSummary.hoursMetrics.scheduledHours} hrs
                </div>
              </div>

              <div style={{ background: 'rgba(251, 191, 36, 0.08)', border: '1px solid rgba(251, 191, 36, 0.25)', borderRadius: '10px', padding: '12px 14px' }}>
                <div style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#fbbf24', fontWeight: 700 }}>Overtime Worked</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', marginTop: '3px' }}>
                  {payrollSummary.hoursMetrics.overtimeFormatted}
                </div>
              </div>
            </div>
          )}

          {/* Filter Bar */}
          <div className={styles.filterBar}>
            {/* Desktop Filter Group */}
            <div className={`${styles.filterGroup} ${styles.desktopFilterGroup}`}>
              <div className={styles.filterItem} style={{ gridColumn: 'span 2' }}>
                <span className={styles.filterLabel}>Select Employee</span>
                <select
                  className={styles.select}
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  style={{ width: '100%' }}
                >
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.staffId})
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.filterItem}>
                <span className={styles.filterLabel}>Month</span>
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
                <span className={styles.filterLabel}>Year</span>
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
                <span className={styles.filterLabel}>Branch</span>
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
            </div>

            {/* Action Bar (Employee Quick Dropdown, Filter Button, Refresh) */}
            <div style={{ display: 'flex', gap: '8px', flex: 1, minWidth: '180px', alignItems: 'center' }}>
              <div className={styles.mobileStaffSelector} style={{ flex: 1, position: 'relative' }}>
                <select
                  className="form-input"
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  style={{
                    width: '100%',
                    height: '36px',
                    fontSize: '12.5px',
                    padding: '0 10px',
                    backgroundColor: 'rgba(15, 23, 42, 0.85)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: '8px',
                    color: '#ffffff',
                  }}
                >
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id} style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                      {s.name} ({s.staffId})
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => setShowMobileFilters(!showMobileFilters)}
                className={`btn btn-secondary btn-sm ${styles.mobileFilterBtn}`}
                style={{
                  height: '36px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  borderColor: (branchId || status || source) ? '#6366f1' : undefined,
                  color: (branchId || status || source) ? '#818cf8' : undefined,
                }}
              >
                {showMobileFilters ? <X size={15} /> : <Filter size={15} />}
                <span>{showMobileFilters ? 'Close' : (branchId || status || source) ? 'Filter (*)' : 'Filter'}</span>
              </button>

              <button
                type="button"
                onClick={fetchReport}
                className="btn btn-secondary btn-sm"
                style={{ padding: '0 10px', height: '36px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                title="Refresh Report"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Mobile Filter Sheet Modal */}
          {showMobileFilters && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.65)',
                backdropFilter: 'blur(4px)',
                zIndex: 999,
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
              }}
              onClick={() => setShowMobileFilters(false)}
            >
              <div
                style={{
                  width: '100%',
                  maxWidth: '500px',
                  backgroundColor: '#0f172a',
                  borderTopLeftRadius: '20px',
                  borderTopRightRadius: '20px',
                  border: '1px solid var(--border-medium)',
                  borderBottom: 'none',
                  padding: '20px',
                  boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
                  maxHeight: '85vh',
                  overflowY: 'auto',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Filter size={16} color="#818cf8" />
                    <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff', margin: 0 }}>Monthly Report Filters</h3>
                  </div>
                  <button
                    onClick={() => setShowMobileFilters(false)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                  >
                    <X size={18} />
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                      Select Employee
                    </label>
                    <select
                      value={selectedStaffId}
                      onChange={(e) => setSelectedStaffId(e.target.value)}
                      className="form-input"
                      style={{
                        width: '100%',
                        height: '40px',
                        padding: '0 12px',
                        fontSize: '13px',
                        color: '#ffffff',
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        border: '1px solid var(--border-medium)',
                        borderRadius: '10px',
                      }}
                    >
                      {staffList.map((s) => (
                        <option key={s.id} value={s.id} style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                          {s.name} ({s.staffId})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                        Month
                      </label>
                      <select
                        value={month}
                        onChange={(e) => setMonth(parseInt(e.target.value, 10))}
                        className="form-input"
                        style={{
                          width: '100%',
                          height: '40px',
                          padding: '0 10px',
                          fontSize: '12.5px',
                          color: '#ffffff',
                          backgroundColor: 'rgba(255,255,255,0.05)',
                          border: '1px solid var(--border-medium)',
                          borderRadius: '10px',
                        }}
                      >
                        {months.map((m) => (
                          <option key={m.num} value={m.num} style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                        Year
                      </label>
                      <select
                        value={year}
                        onChange={(e) => setYear(parseInt(e.target.value, 10))}
                        className="form-input"
                        style={{
                          width: '100%',
                          height: '40px',
                          padding: '0 10px',
                          fontSize: '12.5px',
                          color: '#ffffff',
                          backgroundColor: 'rgba(255,255,255,0.05)',
                          border: '1px solid var(--border-medium)',
                          borderRadius: '10px',
                        }}
                      >
                        {[2025, 2026, 2027].map((y) => (
                          <option key={y} value={y} style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                            {y}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                      Branch Location
                    </label>
                    <select
                      value={branchId}
                      onChange={(e) => setBranchId(e.target.value)}
                      className="form-input"
                      style={{
                        width: '100%',
                        height: '40px',
                        padding: '0 12px',
                        fontSize: '13px',
                        color: '#ffffff',
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        border: '1px solid var(--border-medium)',
                        borderRadius: '10px',
                      }}
                    >
                      <option value="" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>All Branches</option>
                      {branchList.map((b) => (
                        <option key={b.id} value={b.id} style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => {
                      setBranchId('');
                      setStatus('');
                      setSource('');
                      setShowMobileFilters(false);
                    }}
                    className="btn btn-secondary"
                    style={{ flex: 1, height: '42px', borderRadius: '10px', fontSize: '13px' }}
                  >
                    Reset Filters
                  </button>
                  <button
                    onClick={() => setShowMobileFilters(false)}
                    className="btn btn-primary"
                    style={{ flex: 1, height: '42px', borderRadius: '10px', fontSize: '13px' }}
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Monthly Log Container */}
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
              <>
                {/* Desktop Table View */}
                <div className={styles.desktopTableView}>
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
                        const statusKey = (row.status || '').replace(/ /g, '_');
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
                </div>

                {/* Mobile Card Feed View */}
                <div className={styles.mobileCardFeed}>
                  {report.daysRows.map((row: any, idx: number) => {
                    const statusKey = row.status.replace(/ /g, '_');
                    return (
                      <div key={idx} className={styles.reportCardItem}>
                        {/* Header: Date & Day + Status */}
                        <div className={styles.cardHeader}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <strong style={{ color: '#ffffff', fontSize: '15px' }}>{row.date}</strong>
                              <span style={{ fontSize: '12px', color: '#818cf8', fontWeight: 700 }}>({row.dayOfWeek})</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                              <MapPin size={11} color="#38bdf8" />
                              <span>{row.branchName}</span>
                              <span style={{ margin: '0 2px' }}>&bull;</span>
                              <span>{row.shiftPatternName}</span>
                            </div>
                          </div>

                          <span className={`${styles.statusBadge} ${styles[`status${statusKey}`]}`}>
                            {row.status}
                          </span>
                        </div>

                        {/* Clock In / Out Box */}
                        <div className={styles.clockGrid}>
                          <div>
                            <span className={styles.clockLabel}>Clock In</span>
                            <span className={styles.clockVal} style={{ color: '#34d399' }}>{row.clockInTime || '—'}</span>
                          </div>
                          <div>
                            <span className={styles.clockLabel}>Clock Out</span>
                            <span className={styles.clockVal} style={{ color: '#fbbf24' }}>{row.clockOutTime || '—'}</span>
                          </div>
                          <div>
                            <span className={styles.clockLabel}>Source</span>
                            <span className={styles.clockVal}>
                              {row.source !== '—' ? (
                                <span className={`${styles.sourceBadge} ${styles[`source${row.source}`]}`}>
                                  {row.source}
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>—</span>
                              )}
                            </span>
                          </div>
                        </div>

                        {(row.leaveTypeName || row.manualReason || row.adjustmentReason) && (
                          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                            {row.leaveTypeName && <span style={{ color: '#38bdf8', fontWeight: 600, marginRight: '6px' }}>{row.leaveTypeName}</span>}
                            {(row.manualReason || row.adjustmentReason) && (
                              <span style={{ fontStyle: 'italic', color: '#fbbf24' }}>
                                &ldquo;{row.manualReason || row.adjustmentReason}&rdquo;
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </main>
      </div>
      <OrgAdminMobileNav organizationCode={organizationCode} />
    </div>
  );
}

