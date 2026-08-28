'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
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
  const toast = useToast();

  const todayStr = new Date().toISOString().slice(0, 10);
  const sevenDaysAgoStr = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(sevenDaysAgoStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [branchId, setBranchId] = useState('');
  const [staffId, setStaffId] = useState('');
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [search, setSearch] = useState('');

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
      let url = `/api/org/${organizationCode}/reports/export/pdf?reportType=RANGE&startDate=${startDate}&endDate=${endDate}`;
      if (branchId) url += `&branchId=${branchId}`;
      if (staffId) url += `&staffId=${staffId}`;
      if (status) url += `&status=${status}`;
      if (source) url += `&source=${source}`;
      if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;

      // Query PDF endpoint for range report data or CSV route fallback
      const csvUrl = `/api/org/${organizationCode}/reports/export/csv?reportType=RANGE&startDate=${startDate}&endDate=${endDate}` +
        (branchId ? `&branchId=${branchId}` : '') +
        (staffId ? `&staffId=${staffId}` : '') +
        (status ? `&status=${status}` : '') +
        (source ? `&source=${source}` : '') +
        (search.trim() ? `&search=${encodeURIComponent(search.trim())}` : '');

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
    <div className={styles.pageContainer}>
      <OrgAdminSidebar
        organizationCode={organizationCode}
        organizationName={orgData?.name || 'ShiftGuard'}
        logoUrl={orgData?.logoUrl}
      />

      <div className={styles.mainContent}>
        <div style={{ padding: '16px 32px 0 32px' }}>
          <Link href={`/${organizationCode}/admin/reports`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '13px', textDecoration: 'none' }}>
            <ArrowLeft size={16} /> Back to Reports Dashboard
          </Link>
        </div>

        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>Custom Date Range Attendance Report</h1>
            <p className={styles.subtitle}>
              Export &amp; review attendance from <strong>{startDate}</strong> to <strong>{endDate}</strong>
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="button" onClick={handleCsvExport} disabled={exportingCsv} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Download size={15} color="#34d399" />
              <span>{exportingCsv ? 'Preparing CSV...' : 'Export Range CSV'}</span>
            </button>

            <button type="button" onClick={handlePdfExport} disabled={exportingPdf} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Printer size={15} color="#ffffff" />
              <span>{exportingPdf ? 'Preparing PDF...' : 'Print / Save Range PDF'}</span>
            </button>
          </div>
        </header>

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
            style={{ display: 'flex', gap: '8px', flex: 1, minWidth: '180px' }}
          >
            <input
              type="text"
              className={styles.input}
              style={{ flex: 1 }}
              placeholder="Search staff name or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
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

        {/* Report Data Table */}
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
                  const statusKey = row.status.replace(/ /g, '_');
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
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
          )}
        </div>
      </div>
      <OrgAdminMobileNav organizationCode={organizationCode} />
    </div>
  );
}
