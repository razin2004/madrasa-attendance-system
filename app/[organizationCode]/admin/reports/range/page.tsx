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
  MapPin,
  FileText,
  Loader2,
  Menu,
  X,
} from 'lucide-react';
import { OrgAdminSidebar } from '@/components/layout/org-admin-sidebar';
import { OrgAdminMobileNav } from '@/components/layout/org-admin-mobile-nav';
import { BreakPopover } from '@/components/attendance/break-popover';
import { useToast } from '@/components/feedback/toast-provider';
import styles from '../daily/DailyReport.module.css';
import { OrgAdminHeader } from '@/components/layout/org-admin-header';

interface StaffOption {
  id: string;
  name: string;
  staffId: string;
}

interface BranchOption {
  id: string;
  name: string;
}

import { getTodayInTimezone, formatDateInTimezone } from '@/lib/timezone';

export default function DateRangeReportPage() {
  const params = useParams();
  const organizationCode = (params.organizationCode as string)?.toUpperCase() || '';
  const router = useRouter();
  const toast = useToast();
  const headerMenuRef = useRef<HTMLDivElement>(null);

  const todayStr = getTodayInTimezone('Asia/Kolkata');
  const sevenDaysAgoStr = formatDateInTimezone(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), 'Asia/Kolkata');

  const [startDate, setStartDate] = useState(sevenDaysAgoStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [branchId, setBranchId] = useState('');
  const [staffId, setStaffId] = useState('');
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [search, setSearch] = useState('');
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(event.target as Node)) {
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
        if (staffRes.staffMembers) setStaffList(staffRes.staffMembers);
      })
      .catch((err) => console.error('Error fetching metadata:', err));
  }, [organizationCode]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const rangeUrl = `/api/org/${organizationCode}/reports/range?startDate=${startDate}&endDate=${endDate}` +
        (branchId ? `&branchId=${branchId}` : '') +
        (staffId ? `&staffId=${staffId}` : '') +
        (status ? `&status=${status}` : '') +
        (source ? `&source=${source}` : '') +
        (search.trim() ? `&search=${encodeURIComponent(search.trim())}` : '');

      const res = await fetch(rangeUrl);
      const data = await res.json();

      if (res.ok && data.success) {
        setReport(data.report);
      } else {
        toast.error(data.error || 'Failed to load report for selected date range.');
      }
    } catch {
      toast.error('Network error loading date range report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [organizationCode, startDate, endDate, branchId, staffId, status, source]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchReport();
  };

  const buildExportQuery = () => {
    let q = `startDate=${startDate}&endDate=${endDate}`;
    if (branchId) q += `&branchId=${branchId}`;
    if (staffId) q += `&staffId=${staffId}`;
    if (status) q += `&status=${status}`;
    if (source) q += `&source=${source}`;
    if (search.trim()) q += `&search=${encodeURIComponent(search.trim())}`;
    return q;
  };

  const handleCsvExport = () => {
    setExportingCsv(true);
    const url = `/api/org/${organizationCode}/reports/export/csv?reportType=RANGE&${buildExportQuery()}`;
    window.open(url, '_blank');
    setTimeout(() => setExportingCsv(false), 2000);
    toast.success('Range CSV export initiated.');
  };

  const handlePdfExport = () => {
    setExportingPdf(true);
    const url = `/api/org/${organizationCode}/reports/export/pdf?reportType=RANGE&print=true&${buildExportQuery()}`;
    window.open(url, '_blank');
    setTimeout(() => setExportingPdf(false), 2000);
    toast.success('Range PDF print/export initiated.');
  };

  return (
    <div className={styles.container}>
      <OrgAdminSidebar
        organizationCode={organizationCode}
        organizationName={orgData?.name || 'ShiftGuard'}
        logoUrl={orgData?.logoUrl}
      />

      <div className={styles.mainContent}>
        <OrgAdminHeader
          organizationCode={organizationCode}
          logoUrl={orgData?.logoUrl}
          panelTitle="Custom Date Range Attendance Report"
          panelSubtitle={`Export & review attendance from ${startDate} to ${endDate}`}
          headerMenuOpen={headerMenuOpen}
          onToggleHeaderMenu={() => setHeaderMenuOpen(!headerMenuOpen)}
        >
          {headerMenuOpen && (
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
                <span>{exportingCsv ? 'Preparing CSV...' : 'Export Range CSV'}</span>
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
                  cursor: 'pointer',
                }}
              >
                <Printer size={15} color="#38bdf8" />
                <span>{exportingPdf ? 'Preparing PDF...' : 'Print / Save Range PDF'}</span>
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
          )}
        </OrgAdminHeader>

        <main className="pageMainContent" style={{ maxWidth: '1280px' }}>

          {/* Date Range Metrics Overview Cards */}
          {report?.metrics && (
            <div className={styles.metricsGrid} style={{ margin: '0 0 24px 0' }}>
              <div className={styles.metricCard} style={{ borderLeft: '3px solid #3b82f6' }}>
                <div className={styles.metricLabel}>Total Evaluated</div>
                <div className={styles.metricValue}>{report.metrics.totalCount}</div>
              </div>

              <div className={styles.metricCard} style={{ borderLeft: '3px solid #10b981' }}>
                <div className={styles.metricLabel}>Present</div>
                <div className={styles.metricValue} style={{ color: '#34d399' }}>
                  {report.metrics.presentCount}
                </div>
              </div>

              <div className={styles.metricCard} style={{ borderLeft: '3px solid #38bdf8' }}>
                <div className={styles.metricLabel}>Approved Leave</div>
                <div className={styles.metricValue} style={{ color: '#38bdf8' }}>
                  {report.metrics.leaveCount}
                </div>
              </div>

              <div className={styles.metricCard} style={{ borderLeft: '3px solid #ef4444' }}>
                <div className={styles.metricLabel}>Absent</div>
                <div className={styles.metricValue} style={{ color: '#f87171' }}>
                  {report.metrics.absentCount}
                </div>
              </div>

              <div className={styles.metricCard} style={{ borderLeft: '3px solid #059669' }}>
                <div className={styles.metricLabel}>Verified (Normal)</div>
                <div className={styles.metricValue} style={{ color: '#34d399' }}>
                  {report.metrics.sourceMetrics?.normalCount || 0}
                </div>
              </div>

              <div className={styles.metricCard} style={{ borderLeft: '3px solid #d97706' }}>
                <div className={styles.metricLabel}>Manual / Adjusted</div>
                <div className={styles.metricValue} style={{ color: '#fbbf24' }}>
                  {(report.metrics.sourceMetrics?.manualCount || 0) +
                    (report.metrics.sourceMetrics?.adjustedCount || 0)}
                </div>
              </div>
            </div>
          )}

          {/* Filter Bar */}
          <div className={styles.filterBar}>
            {/* Desktop Filter Group */}
            <div className={`${styles.filterGroup} ${styles.desktopFilterGroup}`}>
              <div className={styles.filterItem}>
                <span className={styles.filterLabel}>From Date</span>
                <input
                  type="date"
                  className={styles.dateInput}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className={styles.filterItem}>
                <span className={styles.filterLabel}>To Date</span>
                <input
                  type="date"
                  className={styles.dateInput}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
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

              <div className={styles.filterItem}>
                <span className={styles.filterLabel}>Staff</span>
                <select
                  className={styles.select}
                  value={staffId}
                  onChange={(e) => setStaffId(e.target.value)}
                >
                  <option value="">All Staff</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.staffId})
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.filterItem}>
                <span className={styles.filterLabel}>Status</span>
                <select
                  className={styles.select}
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value="PRESENT">PRESENT</option>
                  <option value="PARTIAL">PARTIAL</option>
                  <option value="HOLIDAY">HOLIDAY</option>
                  <option value="LEAVE">LEAVE</option>
                  <option value="ABSENT">ABSENT</option>
                </select>
              </div>

              <div className={styles.filterItem}>
                <span className={styles.filterLabel}>Type</span>
                <select
                  className={styles.sourceSelect}
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                >
                  <option value="">All Types</option>
                  <option value="NORMAL">NORMAL</option>
                  <option value="MANUAL">MANUAL</option>
                  <option value="ADJUSTED">ADJUSTED</option>
                </select>
              </div>
            </div>

            {/* Action Bar (Search, Filter Button, Refresh) */}
            <div style={{ display: 'flex', gap: '8px', flex: 1, minWidth: '180px', alignItems: 'center' }}>
              <form
                onSubmit={handleSearchSubmit}
                style={{ display: 'flex', gap: '6px', flex: 1, position: 'relative' }}
              >
                <div style={{ position: 'relative', width: '100%' }}>
                  <Search
                    size={14}
                    style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                  />
                  <input
                    type="text"
                    className={styles.input}
                    style={{
                      width: '100%',
                      height: '36px',
                      fontSize: '12.5px',
                      paddingLeft: '32px',
                      paddingRight: search ? '28px' : '10px',
                      backgroundColor: 'rgba(15, 23, 42, 0.85)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: '8px',
                      color: '#ffffff',
                    }}
                    placeholder="Search staff..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch('');
                        fetchReport();
                      }}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '2px',
                      }}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '0 10px', height: '36px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                  title="Search"
                >
                  <Search size={14} />
                </button>
              </form>

              <button
                onClick={() => setShowMobileFilters(!showMobileFilters)}
                className={`btn btn-secondary btn-sm ${styles.mobileFilterBtn}`}
                style={{
                  height: '36px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  borderColor: (branchId || staffId || status || source) ? '#6366f1' : undefined,
                  color: (branchId || staffId || status || source) ? '#818cf8' : undefined,
                }}
              >
                {showMobileFilters ? <X size={15} /> : <Filter size={15} />}
                <span>{showMobileFilters ? 'Close' : (branchId || staffId || status || source) ? 'Filter (*)' : 'Filter'}</span>
              </button>

              <button
                type="button"
                onClick={fetchReport}
                className="btn btn-secondary btn-sm"
                style={{ padding: '0 10px', height: '36px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                title="Refresh"
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
                backgroundColor: 'rgba(3, 7, 18, 0.8)',
                backdropFilter: 'blur(4px)',
                zIndex: 99999,
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
              }}
              onClick={() => setShowMobileFilters(false)}
            >
              <div
                className="glass-card"
                style={{
                  width: '100%',
                  maxWidth: '500px',
                  borderBottomLeftRadius: 0,
                  borderBottomRightRadius: 0,
                  borderTopLeftRadius: '20px',
                  borderTopRightRadius: '20px',
                  padding: '20px',
                  backgroundColor: '#0d121f',
                  border: '1px solid var(--border-medium)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 800, color: '#ffffff' }}>
                    <Filter size={16} color="#818cf8" />
                    <span>Filter Date Range Report</span>
                  </div>
                  <button
                    onClick={() => setShowMobileFilters(false)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    <X size={18} />
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                        From Date
                      </label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="form-input"
                        style={{ width: '100%', height: '40px', padding: '0 10px', fontSize: '12.5px' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                        To Date
                      </label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="form-input"
                        style={{ width: '100%', height: '40px', padding: '0 10px', fontSize: '12.5px' }}
                      />
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
                        padding: '0 10px',
                        fontSize: '12.5px',
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

                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                      Staff Member
                    </label>
                    <select
                      value={staffId}
                      onChange={(e) => setStaffId(e.target.value)}
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
                      <option value="" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>All Staff</option>
                      {staffList.map((s) => (
                        <option key={s.id} value={s.id} style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                          {s.name} ({s.staffId})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                      Attendance Status
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
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
                      <option value="" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>All Statuses</option>
                      <option value="PRESENT" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>PRESENT</option>
                      <option value="PARTIAL" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>PARTIAL</option>
                      <option value="HOLIDAY" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>HOLIDAY</option>
                      <option value="LEAVE" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>LEAVE</option>
                      <option value="ABSENT" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>ABSENT</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                      Attendance Type
                    </label>
                    <select
                      value={source}
                      onChange={(e) => setSource(e.target.value)}
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
                      <option value="" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>All Types</option>
                      <option value="NORMAL" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>NORMAL</option>
                      <option value="MANUAL" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>MANUAL</option>
                      <option value="ADJUSTED" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>ADJUSTED</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                  <button
                    onClick={() => {
                      setStartDate(sevenDaysAgoStr);
                      setEndDate(todayStr);
                      setBranchId('');
                      setStaffId('');
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

          {/* Report Data Container */}
          <div className={styles.tableCard}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <Loader2 size={32} className="animate-spin" style={{ color: '#818cf8', margin: '0 auto 12px auto' }} />
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Calculating date range report...</p>
              </div>
            ) : !report?.rows || report.rows.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                <Clock size={36} color="var(--text-muted)" style={{ margin: '0 auto 12px auto' }} />
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', margin: '0 0 4px 0' }}>
                  No attendance records found for selected date range
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                  Adjust your date range or filter options above, or export CSV/PDF.
                </p>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className={styles.desktopTableView}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th className={styles.th}>Staff Member</th>
                        <th className={styles.th}>Date</th>
                        <th className={styles.th}>Branch</th>
                        <th className={styles.th}>Shift Roster</th>
                        <th className={styles.th}>Clock In</th>
                        <th className={styles.th}>Late In</th>
                        <th className={styles.th}>Clock Out</th>
                        <th className={styles.th}>Early Out</th>
                        <th className={styles.th}>Break Time</th>
                        <th className={styles.th}>Total Working Hours</th>
                        <th className={styles.th}>Status</th>
                        <th className={styles.th}>Type</th>
                        <th className={styles.th}>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.rows.map((row: any, idx: number) => {
                        const statusKey = (row.status || '').replace(/ /g, '_');
                        const breaksList = (row.breakDetails || []).map((b: any, bIdx: number) => ({
                          breakNumber: bIdx + 1,
                          startTime: b.clockOutTime,
                          endTime: b.clockInTime,
                          durationMinutes: b.durationMinutes,
                        }));

                        return (
                          <tr
                            key={idx}
                            onClick={() => {
                              if (row.staffProfileId || row.staffId) {
                                router.push(`/${organizationCode}/admin/staff/${row.staffProfileId || row.staffId}`);
                              }
                            }}
                            style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                          >
                            <td className={styles.td}>
                              <div style={{ fontWeight: 700, color: '#ffffff' }}>{row.staffName}</div>
                              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#818cf8' }}>ID: {row.staffId}</div>
                            </td>

                            <td className={styles.td}>
                              <div style={{ fontSize: '12.5px', color: '#f8fafc', fontWeight: 600 }}>{row.date}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{row.dayOfWeek}</div>
                            </td>

                            <td className={styles.td}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <MapPin size={13} color="#38bdf8" />
                                <span style={{ color: '#f8fafc' }}>{row.branchName}</span>
                              </span>
                            </td>

                            <td className={styles.td}>
                              <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                                {row.shiftPatternName}
                              </span>
                            </td>

                            <td className={styles.td}>
                              <strong style={{ color: '#34d399', fontFamily: 'var(--font-mono)' }}>
                                {row.displayClockInTime || row.clockInTime || '—'}
                              </strong>
                            </td>

                            <td className={styles.td}>
                              <span style={{ color: row.lateInMinutes > 0 ? '#f87171' : 'var(--text-muted)', fontWeight: row.lateInMinutes > 0 ? 700 : 400 }}>
                                {row.lateInFormatted || '—'}
                              </span>
                            </td>

                            <td className={styles.td}>
                              <strong style={{ color: '#fbbf24', fontFamily: 'var(--font-mono)' }}>
                                {row.displayClockOutTime || row.clockOutTime || '—'}
                              </strong>
                            </td>

                            <td className={styles.td}>
                              <span style={{ color: row.earlyOutMinutes > 0 ? '#f87171' : 'var(--text-muted)', fontWeight: row.earlyOutMinutes > 0 ? 700 : 400 }}>
                                {row.earlyOutFormatted || '—'}
                              </span>
                            </td>

                            <td className={styles.td}>
                              <BreakPopover totalBreakMinutes={row.totalBreakMinutes || 0} breaks={breaksList} />
                            </td>

                            <td className={styles.td}>
                              <strong style={{ color: '#818cf8', fontWeight: 800 }}>
                                {row.totalWorkingHoursFormatted || '0h'}
                              </strong>
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
                                <div style={{ color: '#38bdf8', fontWeight: 600 }}>
                                  {row.leaveTypeName}
                                </div>
                              )}
                              {row.manualReason && (
                                <div style={{ color: '#fbbf24', fontStyle: 'italic' }}>
                                  &ldquo;{row.manualReason}&rdquo;
                                </div>
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
                  {report.rows.map((row: any, idx: number) => {
                    const statusKey = (row.status || '').replace(/ /g, '_');
                    const breaksList = (row.breakDetails || []).map((b: any, bIdx: number) => ({
                      breakNumber: bIdx + 1,
                      startTime: b.clockOutTime,
                      endTime: b.clockInTime,
                      durationMinutes: b.durationMinutes,
                    }));

                    return (
                      <div
                        key={idx}
                        className={styles.reportCardItem}
                        onClick={() => {
                          if (row.staffProfileId || row.staffId) {
                            router.push(`/${organizationCode}/admin/staff/${row.staffProfileId || row.staffId}`);
                          }
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>{row.staffName}</div>
                            <div style={{ fontSize: '11px', color: '#818cf8', fontFamily: 'var(--font-mono)' }}>
                              ID: {row.staffId} • {row.date} ({row.dayOfWeek})
                            </div>
                          </div>
                          <span className={`${styles.statusBadge} ${styles[`status${statusKey}`]}`}>
                            {row.status}
                          </span>
                        </div>

                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <MapPin size={12} color="#38bdf8" />
                            <span>{row.branchName}</span>
                          </span>
                          <span>•</span>
                          <span>{row.shiftPatternName}</span>
                        </div>

                        <div className={styles.clockGrid}>
                          <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '6px 10px', borderRadius: '6px' }}>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Clock In</div>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#34d399', fontFamily: 'var(--font-mono)' }}>
                              {row.displayClockInTime || row.clockInTime || '—'}
                            </div>
                          </div>
                          <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '6px 10px', borderRadius: '6px' }}>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Clock Out</div>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#fbbf24', fontFamily: 'var(--font-mono)' }}>
                              {row.displayClockOutTime || row.clockOutTime || '—'}
                            </div>
                          </div>
                          <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '6px 10px', borderRadius: '6px' }}>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Hours</div>
                            <div style={{ fontSize: '13px', fontWeight: 800, color: '#818cf8' }}>
                              {row.totalWorkingHoursFormatted || '0h'}
                            </div>
                          </div>
                        </div>

                        <div style={{ marginTop: '8px', display: 'flex', gap: '12px', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                          <div>Late In: <span style={{ color: row.lateInMinutes > 0 ? '#f87171' : 'inherit' }}>{row.lateInFormatted}</span></div>
                          <div>Early Out: <span style={{ color: row.earlyOutMinutes > 0 ? '#f87171' : 'inherit' }}>{row.earlyOutFormatted}</span></div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>Break:</span>
                            <BreakPopover totalBreakMinutes={row.totalBreakMinutes || 0} breaks={breaksList} />
                          </div>
                        </div>

                        {(row.source !== '—' || row.leaveTypeName || row.manualReason) && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed rgba(255, 255, 255, 0.08)', fontSize: '11px' }}>
                            <div>
                              {row.leaveTypeName && <span style={{ color: '#38bdf8', fontWeight: 600 }}>{row.leaveTypeName}</span>}
                              {row.manualReason && <span style={{ color: '#fbbf24', fontStyle: 'italic', marginLeft: '4px' }}>&ldquo;{row.manualReason}&rdquo;</span>}
                            </div>
                            {row.source !== '—' && (
                              <span className={`${styles.sourceBadge} ${styles[`source${row.source}`]}`}>
                                {row.source}
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
