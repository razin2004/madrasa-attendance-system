'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  MapPin,
  AlertTriangle,
  FileText,
  UserCheck,
  Loader2,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';
import { OrgAdminSidebar } from '@/components/layout/org-admin-sidebar';
import { OrgAdminMobileNav } from '@/components/layout/org-admin-mobile-nav';
import { useToast } from '@/components/feedback/toast-provider';
import styles from './DailyReport.module.css';

interface StaffOption {
  id: string;
  name: string;
  staffId: string;
}

interface BranchOption {
  id: string;
  name: string;
}

export default function DailyReportPage() {
  const params = useParams();
  const organizationCode = (params.organizationCode as string)?.toUpperCase() || '';
  const router = useRouter();
  const toast = useToast();

  const todayStr = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(todayStr);
  const [branchId, setBranchId] = useState('');
  const [staffId, setStaffId] = useState('');
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [search, setSearch] = useState('');

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
        if (staffRes.staffMembers) setStaffList(staffRes.staffMembers);
      })
      .catch((err) => console.error('Error fetching metadata:', err));
  }, [organizationCode]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      let url = `/api/org/${organizationCode}/reports/daily?date=${date}`;
      if (branchId) url += `&branchId=${branchId}`;
      if (staffId) url += `&staffId=${staffId}`;
      if (status) url += `&status=${status}`;
      if (source) url += `&source=${source}`;
      if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;

      const res = await fetch(url);
      const data = await res.json();

      if (res.ok && data.success) {
        setReport(data.report);
      } else {
        toast.error(data.error || 'Failed to load daily report.');
      }
    } catch {
      toast.error('Network error loading report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [organizationCode, date, branchId, staffId, status, source]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchReport();
  };

  const buildExportQuery = () => {
    let q = `date=${date}`;
    if (branchId) q += `&branchId=${branchId}`;
    if (staffId) q += `&staffId=${staffId}`;
    if (status) q += `&status=${status}`;
    if (source) q += `&source=${source}`;
    if (search.trim()) q += `&search=${encodeURIComponent(search.trim())}`;
    return q;
  };

  const handleCsvExport = () => {
    setExportingCsv(true);
    const url = `/api/org/${organizationCode}/reports/export/csv?reportType=DAILY&${buildExportQuery()}`;
    window.open(url, '_blank');
    setTimeout(() => setExportingCsv(false), 2000);
    toast.success('CSV export initiated.');
  };

  const handlePdfExport = () => {
    setExportingPdf(true);
    const url = `/api/org/${organizationCode}/reports/export/pdf?reportType=DAILY&print=true&${buildExportQuery()}`;
    window.open(url, '_blank');
    setTimeout(() => setExportingPdf(false), 2000);
    toast.success('PDF print/export initiated.');
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
              <h1 className={styles.title}>Daily Attendance Report</h1>
              <p className={styles.subtitle}>
                Breakdown for <strong>{date}</strong> ({report?.dayOfWeek || ''})
              </p>
            </div>
          </div>

          <div style={{ position: 'relative' }} ref={headerMenuRef}>
            <button
              onClick={() => setHeaderMenuOpen(!headerMenuOpen)}
              className="btn btn-secondary btn-sm"
              style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '8px' }}
              aria-label="Toggle Daily Report Menu"
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
          {/* Metrics Grid */}
          <div className={styles.metricsGrid}>
            <div className={styles.metricCard} style={{ borderLeft: '3px solid #3b82f6' }}>
              <div className={styles.metricLabel}>Total Staff</div>
              <div className={styles.metricValue}>{report?.metrics?.totalCount || 0}</div>
            </div>

            <div className={styles.metricCard} style={{ borderLeft: '3px solid #10b981' }}>
              <div className={styles.metricLabel}>Present</div>
              <div className={styles.metricValue} style={{ color: '#34d399' }}>
                {report?.metrics?.presentCount || 0}
              </div>
            </div>

            <div className={styles.metricCard} style={{ borderLeft: '3px solid #f59e0b' }}>
              <div className={styles.metricLabel}>Partial</div>
              <div className={styles.metricValue} style={{ color: '#fbbf24' }}>
                {report?.metrics?.partialCount || 0}
              </div>
            </div>

            <div className={styles.metricCard} style={{ borderLeft: '3px solid #38bdf8' }}>
              <div className={styles.metricLabel}>Leave</div>
              <div className={styles.metricValue} style={{ color: '#38bdf8' }}>
                {report?.metrics?.leaveCount || 0}
              </div>
            </div>

            <div className={styles.metricCard} style={{ borderLeft: '3px solid #818cf8' }}>
              <div className={styles.metricLabel}>Holiday</div>
              <div className={styles.metricValue} style={{ color: '#818cf8' }}>
                {report?.metrics?.holidayCount || 0}
              </div>
            </div>

            <div className={styles.metricCard} style={{ borderLeft: '3px solid #ef4444' }}>
              <div className={styles.metricLabel}>Absent</div>
              <div className={styles.metricValue} style={{ color: '#f87171' }}>
                {report?.metrics?.absentCount || 0}
              </div>
            </div>
          </div>

          {/* Responsive Filter Bar */}
          <div className={styles.filterBar}>
            <div className={styles.filterGroup}>
              <div className={styles.filterItem}>
                <span className={styles.filterLabel}>Date</span>
                <input
                  type="date"
                  className={styles.dateInput}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
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
                <span className={styles.filterLabel}>Source</span>
                <select
                  className={styles.sourceSelect}
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                >
                  <option value="">All Sources</option>
                  <option value="NORMAL">NORMAL (3-Layer)</option>
                  <option value="MANUAL">MANUAL (Admin)</option>
                  <option value="ADJUSTED">ADJUSTED (Corr.)</option>
                </select>
              </div>
            </div>

            <form
              onSubmit={handleSearchSubmit}
              style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1, minWidth: '200px', position: 'relative' }}
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
                  placeholder="Search staff name or ID..."
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
                style={{ padding: '0 12px', height: '36px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}
                title="Search"
              >
                <Search size={14} />
              </button>
              <button
                type="button"
                onClick={fetchReport}
                className="btn btn-secondary btn-sm"
                style={{ padding: '0 12px', height: '36px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}
                title="Refresh"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
            </form>
          </div>

          {/* Report Data Container */}
          <div className={styles.tableCard}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <Loader2 size={32} className="animate-spin" style={{ color: '#818cf8', margin: '0 auto 12px auto' }} />
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Calculating daily report...</p>
              </div>
            ) : !report?.rows || report.rows.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                <Clock size={36} color="var(--text-muted)" style={{ margin: '0 auto 12px auto' }} />
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', margin: '0 0 4px 0' }}>
                  No attendance records found for the selected filters
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                  Adjust your date or filter options above.
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
                        <th className={styles.th}>Branch</th>
                        <th className={styles.th}>Shift Roster</th>
                        <th className={styles.th}>Scheduled</th>
                        <th className={styles.th}>Clock In</th>
                        <th className={styles.th}>Clock Out</th>
                        <th className={styles.th}>Status</th>
                        <th className={styles.th}>Source</th>
                        <th className={styles.th}>Details &amp; Justification</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.rows.map((row: any, idx: number) => {
                        const statusKey = (row.status || '').replace(/ /g, '_');
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
                              <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                                {row.scheduledStart ? `${row.scheduledStart} - ${row.scheduledEnd}` : '—'}
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
                                <div style={{ color: '#38bdf8', fontWeight: 600 }}>
                                  {row.leaveTypeName}
                                </div>
                              )}
                              {row.manualReason && (
                                <div style={{ color: '#fbbf24', fontStyle: 'italic' }}>
                                  &ldquo;{row.manualReason}&rdquo;
                                </div>
                              )}
                              {row.adjustmentReason && (
                                <div style={{ color: '#38bdf8', fontStyle: 'italic' }}>
                                  &ldquo;{row.adjustmentReason}&rdquo;
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
                    const statusKey = row.status.replace(/ /g, '_');
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
                        {/* Header: Name + Staff ID + Status */}
                        <div className={styles.cardHeader}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <strong style={{ color: '#ffffff', fontSize: '14px' }}>{row.staffName}</strong>
                              <span
                                style={{
                                  fontFamily: 'var(--font-mono)',
                                  fontSize: '10.5px',
                                  fontWeight: 800,
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  backgroundColor: 'rgba(99, 102, 241, 0.15)',
                                  color: '#818cf8',
                                  border: '1px solid rgba(99, 102, 241, 0.25)',
                                }}
                              >
                                {row.staffId}
                              </span>
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
                            <span className={styles.clockLabel}>Scheduled</span>
                            <span className={styles.clockVal} style={{ color: '#94a3b8' }}>
                              {row.scheduledStart ? `${row.scheduledStart} - ${row.scheduledEnd}` : '—'}
                            </span>
                          </div>
                        </div>

                        {/* Footer: Source & Reasons */}
                        <div className={styles.cardFooter}>
                          <div>
                            {row.source !== '—' && (
                              <span className={`${styles.sourceBadge} ${styles[`source${row.source}`]}`}>
                                {row.source}
                              </span>
                            )}
                            {row.leaveTypeName && (
                              <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 600, marginLeft: '6px' }}>
                                {row.leaveTypeName}
                              </span>
                            )}
                          </div>

                          <ChevronRight size={14} color="#818cf8" />
                        </div>
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

