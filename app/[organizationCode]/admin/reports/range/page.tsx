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
  FileText,
  Loader2,
  Menu,
  X,
} from 'lucide-react';
import { OrgAdminSidebar } from '@/components/layout/org-admin-sidebar';
import { OrgAdminMobileNav } from '@/components/layout/org-admin-mobile-nav';
import { useToast } from '@/components/feedback/toast-provider';
import styles from '../daily/DailyReport.module.css';

interface StaffOption {
  id: string;
  name: string;
  staffId: string;
}

interface BranchOption {
  id: string;
  name: string;
}

export default function DateRangeReportPage() {
  const params = useParams();
  const organizationCode = (params.organizationCode as string)?.toUpperCase() || '';
  const router = useRouter();
  const toast = useToast();
  const headerMenuRef = useRef<HTMLDivElement>(null);

  const todayStr = new Date().toISOString().slice(0, 10);
  const sevenDaysAgoStr = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(sevenDaysAgoStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [branchId, setBranchId] = useState('');
  const [staffId, setStaffId] = useState('');
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [search, setSearch] = useState('');
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);

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
      const dailyUrl = `/api/org/${organizationCode}/reports/daily?date=${endDate}` +
        (branchId ? `&branchId=${branchId}` : '') +
        (staffId ? `&staffId=${staffId}` : '') +
        (status ? `&status=${status}` : '') +
        (source ? `&source=${source}` : '') +
        (search.trim() ? `&search=${encodeURIComponent(search.trim())}` : '');

      const res = await fetch(dailyUrl);
      const data = await res.json();

      if (res.ok && data.success) {
        setReport(data.report);
      } else {
        toast.error(data.error || 'Failed to load report for selected date range.');
      }
    } catch {
      toast.error('Network error loading report.');
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
        <header className={styles.headerBar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ color: '#38bdf8', fontSize: '14px', lineHeight: 1 }}>●</span>
            <div>
              <h1 className={styles.title}>Custom Date Range Attendance Report</h1>
              <p className={styles.subtitle}>
                Export &amp; review attendance from <strong>{startDate}</strong> to <strong>{endDate}</strong>
              </p>
            </div>
          </div>

          <div style={{ position: 'relative' }} ref={headerMenuRef}>
            <button
              type="button"
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
              title="Custom Range Actions"
            >
              {headerMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>

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
          </div>
        </header>

        <main className="pageMainContent" style={{ maxWidth: '1280px' }}>

        {/* Filter Bar */}
        <div className={styles.filterBar}>
          <div className={styles.filterItem}>
            <span className={styles.filterLabel}>From Date:</span>
            <input
              type="date"
              className={styles.input}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className={styles.filterItem}>
            <span className={styles.filterLabel}>To Date:</span>
            <input
              type="date"
              className={styles.input}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
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

          <div className={styles.filterItem}>
            <span className={styles.filterLabel}>Staff:</span>
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
            <span className={styles.filterLabel}>Status:</span>
            <select
              className={styles.select}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="PRESENT">PRESENT</option>
              <option value="PARTIAL">PARTIAL</option>
              <option value="HOLIDAY">HOLIDAY</option>
              <option value="LEAVE">APPROVED LEAVE</option>
              <option value="ABSENT">ABSENT</option>
            </select>
          </div>

          <form
            onSubmit={handleSearchSubmit}
            style={{ display: 'flex', gap: '6px', flex: 1, minWidth: '180px' }}
          >
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type="text"
                className={styles.input}
                style={{ width: '100%', paddingRight: search ? '28px' : '10px' }}
                placeholder="Search staff..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  style={{
                    position: 'absolute',
                    right: '6px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                  }}
                  title="Clear search"
                >
                  <X size={13} />
                </button>
              )}
            </div>
            <button type="submit" className="btn btn-secondary btn-sm" style={{ padding: '8px 12px' }}>
              <Search size={14} />
            </button>
          </form>

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
                Click Export CSV or Export PDF above to generate the full multi-day report bundle.
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
                      <th className={styles.th}>Clock Out</th>
                      <th className={styles.th}>Status</th>
                      <th className={styles.th}>Source</th>
                      <th className={styles.th}>Details</th>
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
                            <div style={{ fontSize: '12.5px', color: '#f8fafc' }}>{row.date}</div>
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
                            {row.clockInTime || '—'}
                          </div>
                        </div>
                        <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '6px 10px', borderRadius: '6px' }}>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Clock Out</div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#fbbf24', fontFamily: 'var(--font-mono)' }}>
                            {row.clockOutTime || '—'}
                          </div>
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
