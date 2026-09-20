'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Calendar,
  Filter,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  Clock,
  MapPin,
  CheckCircle2,
  FileText,
  Loader2,
  X,
  Menu,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { OrgAdminSidebar } from '../../../../components/layout/org-admin-sidebar';
import { OrgAdminMobileNav } from '../../../../components/layout/org-admin-mobile-nav';
import { OrgAdminHeader } from '@/components/layout/org-admin-header';
import { BreakPopover } from '@/components/attendance/break-popover';
import { formatTimeInTimezone, getTodayInTimezone } from '@/lib/timezone';
import { cleanStaffJustification } from '@/lib/reason-parser';
import { useToast } from '../../../../components/feedback/toast-provider';
import styles from './AdminAttendance.module.css';

interface BranchOption {
  id: string;
  name: string;
}

interface StaffOption {
  id: string;
  name: string;
  staffId: string;
}

export default function AdminAttendancePage() {
  const params = useParams();
  const organizationCode = (params.organizationCode as string)?.toUpperCase() || '';
  const router = useRouter();
  const toast = useToast();

  const todayStr = getTodayInTimezone();
  const [date, setDate] = useState(todayStr);
  const [branchId, setBranchId] = useState('');
  const [staffId, setStaffId] = useState('');
  const [status, setStatus] = useState('');
  const [source, setSource] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const [report, setReport] = useState<any>(null);
  const [branchList, setBranchList] = useState<BranchOption[]>([]);
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [pendingCorrectionsCount, setPendingCorrectionsCount] = useState<number>(0);
  const [orgData, setOrgData] = useState<any>(null);

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

    if (organizationCode) {
      fetch(`/api/org/${organizationCode}/attendance/admin/corrections?status=PENDING`)
        .then((r) => r.json())
        .then((data) => {
          if (data.success && Array.isArray(data.requests)) {
            setPendingCorrectionsCount(data.requests.length);
          }
        })
        .catch(() => {});
    }
  }, [organizationCode]);

  // Compute available staff options filtered by branch selection
  const availableStaffOptions = React.useMemo(() => {
    if (!branchId) return staffList;
    return staffList.filter((s: any) => {
      if (s.branchAssignments && s.branchAssignments.length > 0) {
        return s.branchAssignments.some((ba: any) => ba.branchId === branchId || ba.branch?.id === branchId);
      }
      if (s.branches && s.branches.length > 0) {
        return s.branches.some((b: any) => b.id === branchId);
      }
      return true;
    });
  }, [staffList, branchId]);

  // Reset selected staffId if not present in branch
  useEffect(() => {
    if (staffId) {
      const exists = availableStaffOptions.some(
        (s: any) => s.id === staffId || s.staffId === staffId
      );
      if (!exists) {
        setStaffId('');
      }
    }
  }, [availableStaffOptions, staffId]);

  const fetchData = async () => {
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
        toast.error(data.error || 'Failed to load daily attendance.');
      }
    } catch {
      toast.error('Network error loading attendance.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [organizationCode, date, branchId, staffId, status, source]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData();
  };

  return (
    <div className={styles.container}>
      <OrgAdminSidebar
        organizationCode={organizationCode}
        organizationName={orgData?.name || 'ShiftGuard'}
        logoUrl={orgData?.logoUrl}
      />

      <div className={styles.mainContent}>
        {/* Org Admin Header Component */}
        <OrgAdminHeader
          organizationCode={organizationCode}
          logoUrl={orgData?.logoUrl}
          panelTitle="Daily Attendance"
          panelSubtitle={`Detailed attendance records, working hours, and breaks for ${date}`}
          headerMenuOpen={headerMenuOpen}
          onToggleHeaderMenu={() => setHeaderMenuOpen(!headerMenuOpen)}
        >
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
                <Link
                  href={`/${organizationCode}/admin/attendance/manual`}
                  onClick={() => setHeaderMenuOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    color: '#ffffff',
                    textDecoration: 'none',
                    fontSize: '13px',
                    fontWeight: 600,
                    backgroundColor: 'rgba(99, 102, 241, 0.15)',
                  }}
                >
                  <Plus size={15} color="#818cf8" />
                  <span>Record Manual Attendance</span>
                </Link>

                <Link
                  href={`/${organizationCode}/admin/attendance/corrections`}
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
                  <ShieldCheck size={15} color="#38bdf8" />
                  <span>Correction Requests</span>
                </Link>

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
                  <FileText size={15} color="#34d399" />
                  <span>Reports &amp; Analytics</span>
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setHeaderMenuOpen(false);
                    fetchData();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    color: '#cbd5e1',
                    border: 'none',
                    background: 'none',
                    width: '100%',
                    textAlign: 'left',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  <RefreshCw size={15} color="#34d399" className={loading ? 'animate-spin' : ''} />
                  <span>Refresh Logs</span>
                </button>
              </div>
            </>
          )}
        </OrgAdminHeader>

        {/* Main Content Body */}
        <main className="pageMainContent" style={{ maxWidth: '1280px' }}>
          {/* Minimal Warning Notification Bar */}
          {pendingCorrectionsCount > 0 && (
            <div
              style={{
                marginBottom: '20px',
                padding: '12px 18px',
                borderRadius: '12px',
                backgroundColor: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                boxShadow: '0 4px 15px -3px rgba(245, 158, 11, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#f8fafc' }}>
                <div style={{ padding: '6px', borderRadius: '8px', backgroundColor: 'rgba(245, 158, 11, 0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertTriangle size={16} color="#fbbf24" />
                </div>
                <span>
                  <strong>{pendingCorrectionsCount}</strong> {pendingCorrectionsCount === 1 ? 'attendance correction request is' : 'attendance correction requests are'} pending administrator review.
                </span>
              </div>
              <Link
                href={`/${organizationCode}/admin/attendance/corrections`}
                className="btn btn-warning btn-xs"
                style={{
                  borderRadius: '8px',
                  fontSize: '12px',
                  padding: '5px 12px',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontWeight: 700,
                }}
              >
                <span>Review Corrections ({pendingCorrectionsCount})</span>
                <ArrowRight size={12} />
              </Link>
            </div>
          )}

          {/* Top Metrics Cards */}
          <div className={styles.metricsGrid} style={{ margin: '0 0 20px 0' }}>
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

          {/* Search Field & Filters */}
          <div style={{ marginBottom: '16px', width: '100%', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <form onSubmit={handleSearchSubmit} className={styles.searchInputWrapper} style={{ flex: 1, minWidth: '240px' }}>
              <Search size={15} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search staff name or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={styles.searchInput}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    fetchData();
                  }}
                  style={{
                    position: 'absolute',
                    right: '40px',
                    top: '10px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '2px',
                  }}
                >
                  <X size={14} />
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowMobileFilters(!showMobileFilters)}
                className={`${styles.filterToggleBtn} ${(branchId || staffId || status || source || (date && date !== todayStr)) ? styles.filterToggleBtnActive : ''}`}
                title="Toggle Filters"
              >
                <Filter size={15} color={(branchId || staffId || status || source || (date && date !== todayStr)) ? '#818cf8' : 'currentColor'} />
              </button>
            </form>

            {/* Desktop Inline Filters */}
            <div className={styles.desktopFilterGroup}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>Date:</span>
                <input
                  type="date"
                  className="form-input"
                  style={{
                    height: '38px',
                    fontSize: '12.5px',
                    backgroundColor: '#131b2e',
                    color: '#ffffff',
                    colorScheme: 'dark',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    padding: '0 10px',
                  }}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>Branch:</span>
                <select
                  className="form-input"
                  style={{
                    height: '38px',
                    fontSize: '12.5px',
                    backgroundColor: '#131b2e',
                    color: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    padding: '0 10px',
                  }}
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

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>Staff:</span>
                <select
                  className="form-input"
                  style={{
                    height: '38px',
                    fontSize: '12.5px',
                    backgroundColor: '#131b2e',
                    color: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    padding: '0 10px',
                    maxWidth: '180px',
                  }}
                  value={staffId}
                  onChange={(e) => setStaffId(e.target.value)}
                >
                  <option value="">All Staff ({availableStaffOptions.length})</option>
                  {availableStaffOptions.map((s: any) => (
                    <option key={s.id || s.staffId} value={s.id}>
                      {s.name} ({s.staffId})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>Status:</span>
                <select
                  className="form-input"
                  style={{
                    height: '38px',
                    fontSize: '12.5px',
                    backgroundColor: '#131b2e',
                    color: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    padding: '0 10px',
                  }}
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

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>Type:</span>
                <select
                  className="form-input"
                  style={{
                    height: '38px',
                    fontSize: '12.5px',
                    backgroundColor: '#131b2e',
                    color: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    padding: '0 10px',
                  }}
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
          </div>

          {/* Filter Modal Sheet (Mobile) */}
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
                zIndex: 1100,
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
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  boxSizing: 'border-box',
                  maxHeight: '85vh',
                  overflowY: 'auto',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontWeight: 800, fontSize: '14px', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Filter size={16} color="#818cf8" />
                    <span>Filter Attendance Logs</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowMobileFilters(false)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: 'none',
                      borderRadius: '50%',
                      width: '26px',
                      height: '26px',
                      color: 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%', minWidth: 0 }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>Target Date</label>
                    <input
                      type="date"
                      className="form-input"
                      style={{
                        height: '40px',
                        fontSize: '13px',
                        backgroundColor: '#131b2e',
                        color: '#ffffff',
                        colorScheme: 'dark',
                        width: '100%',
                        maxWidth: '100%',
                        boxSizing: 'border-box',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        padding: '0 12px',
                      }}
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>Branch</label>
                    <select
                      className="form-input"
                      style={{
                        height: '40px',
                        fontSize: '13px',
                        backgroundColor: '#131b2e',
                        color: '#ffffff',
                        width: '100%',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        padding: '0 12px',
                      }}
                      value={branchId}
                      onChange={(e) => setBranchId(e.target.value)}
                    >
                      <option value="">All Branches</option>
                      {branchList.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>Staff Member</label>
                    <select
                      className="form-input"
                      style={{
                        height: '40px',
                        fontSize: '13px',
                        backgroundColor: '#131b2e',
                        color: '#ffffff',
                        width: '100%',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        padding: '0 12px',
                      }}
                      value={staffId}
                      onChange={(e) => setStaffId(e.target.value)}
                    >
                      <option value="">All Staff ({availableStaffOptions.length})</option>
                      {availableStaffOptions.map((s: any) => (
                        <option key={s.id || s.staffId} value={s.id}>
                          {s.name} ({s.staffId})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>Status</label>
                    <select
                      className="form-input"
                      style={{
                        height: '40px',
                        fontSize: '13px',
                        backgroundColor: '#131b2e',
                        color: '#ffffff',
                        width: '100%',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        padding: '0 12px',
                      }}
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

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>Type</label>
                    <select
                      className="form-input"
                      style={{
                        height: '40px',
                        fontSize: '13px',
                        backgroundColor: '#131b2e',
                        color: '#ffffff',
                        width: '100%',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        padding: '0 12px',
                      }}
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

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setDate(todayStr);
                      setBranchId('');
                      setStaffId('');
                      setStatus('');
                      setSource('');
                      setShowMobileFilters(false);
                    }}
                    className="btn btn-secondary btn-xs"
                    style={{ borderRadius: '6px', fontSize: '11px', padding: '6px 12px' }}
                  >
                    Reset Filters
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowMobileFilters(false)}
                    className="btn btn-primary btn-sm"
                    style={{ borderRadius: '8px', padding: '6px 16px', fontSize: '12.5px', fontWeight: 700 }}
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Attendance Table */}
          <div className={styles.tableCard} style={{ margin: 0 }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <Loader2 size={32} className="animate-spin" style={{ color: '#818cf8', margin: '0 auto 12px auto' }} />
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading attendance data...</p>
              </div>
            ) : !report?.rows || report.rows.length === 0 ? (
              <div
                style={{
                  padding: '48px 24px',
                  textAlign: 'center',
                  borderRadius: '16px',
                  margin: '12px 0',
                  border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
                  backgroundColor: 'rgba(17, 24, 39, 0.6)',
                }}
              >
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    border: '1px solid rgba(99, 102, 241, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px auto',
                  }}
                >
                  <Clock size={28} color="#818cf8" />
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff', margin: '0 0 6px 0' }}>
                  No Attendance Logs Found
                </h3>
                <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 auto 18px auto', maxWidth: '380px', lineHeight: '1.5' }}>
                  {search || branchId || staffId || status || source || (date && date !== todayStr)
                    ? 'No attendance records match your current date selection, search query, or verification filters.'
                    : 'No staff members have recorded attendance logs for today yet.'}
                </p>
                {(search || branchId || staffId || status || source || (date && date !== todayStr)) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setDate(todayStr);
                      setBranchId('');
                      setStaffId('');
                      setStatus('');
                      setSource('');
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ borderRadius: '8px', fontSize: '12px' }}
                  >
                    Clear All Filters
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* DESKTOP ATTENDANCE TABLE WITH ALL REPORT COLUMNS */}
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.th}>Staff Member</th>
                      <th className={styles.th}>Branch</th>
                      <th className={styles.th}>Clock In</th>
                      <th className={styles.th}>Late In</th>
                      <th className={styles.th}>Clock Out</th>
                      <th className={styles.th}>Early Out</th>
                      <th className={styles.th}>Break Time</th>
                      <th className={styles.th}>Total Working Hours</th>
                      <th className={styles.th}>Status</th>
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
                          style={{ borderBottom: '1px solid var(--border-subtle)' }}
                        >
                          <td className={styles.td}>
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                if (row.staffProfileId || row.staffId) {
                                  router.push(`/${organizationCode}/admin/staff/${row.staffProfileId || row.staffId}`);
                                }
                              }}
                              style={{ cursor: 'pointer', display: 'inline-block' }}
                              title="View staff profile"
                            >
                              <div style={{ fontWeight: 700, color: '#ffffff', display: 'inline-block' }}>{row.staffName}</div>
                              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#818cf8' }}>ID: {row.staffId}</div>
                            </div>
                          </td>

                          <td className={styles.td}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <MapPin size={13} color="#38bdf8" />
                              <span style={{ color: '#f8fafc' }}>{row.branchName}</span>
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

                          <td className={styles.td} style={{ fontSize: '12px' }}>
                            {row.leaveTypeName && (
                              <div style={{ color: '#38bdf8', fontWeight: 600 }}>
                                {row.leaveTypeName}
                              </div>
                            )}
                            {cleanStaffJustification(row.manualReason) && (
                              <div style={{ color: '#fbbf24', fontStyle: 'italic' }}>
                                &ldquo;{cleanStaffJustification(row.manualReason)}&rdquo;
                              </div>
                            )}
                            {cleanStaffJustification(row.adjustmentReason) && (
                              <div style={{ color: '#38bdf8', fontStyle: 'italic' }}>
                                &ldquo;{cleanStaffJustification(row.adjustmentReason)}&rdquo;
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* MOBILE FEED CARDS */}
                <div className={styles.feedCardsContainer} style={{ marginBottom: '16px' }}>
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
                        className={styles.feedCard}
                        style={{ flexDirection: 'column', gap: '10px', alignItems: 'stretch' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              if (row.staffProfileId || row.staffId) {
                                router.push(`/${organizationCode}/admin/staff/${row.staffProfileId || row.staffId}`);
                              }
                            }}
                            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
                            title="View staff profile"
                          >
                            <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'rgba(99, 102, 241, 0.2)', border: '1px solid rgba(99, 102, 241, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8', fontWeight: 800, fontSize: '13px' }}>
                              {row.staffName ? row.staffName.slice(0, 2).toUpperCase() : 'ST'}
                            </div>
                            <div>
                              <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>{row.staffName}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1px' }}>
                                <MapPin size={11} color="#38bdf8" />
                                <span>{row.branchName || 'Unassigned'}</span>
                              </div>
                            </div>
                          </div>

                          <span className={`${styles.statusBadge} ${styles[`status${statusKey}`]}`}>
                            {row.status}
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '10px', borderRadius: '8px', backgroundColor: 'rgba(15, 23, 42, 0.8)' }}>
                          <div>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Clock In</span>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: '#34d399' }}>
                              {row.displayClockInTime || row.clockInTime || '—'}
                            </div>
                          </div>

                          <div>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Clock Out</span>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: '#fbbf24' }}>
                              {row.displayClockOutTime || row.clockOutTime || '—'}
                            </div>
                          </div>

                          <div>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Late / Early Out</span>
                            <div style={{ fontSize: '11px', color: '#f87171' }}>
                              {row.lateInMinutes > 0 ? `Late: ${row.lateInFormatted}` : ''}
                              {row.lateInMinutes > 0 && row.earlyOutMinutes > 0 ? ' | ' : ''}
                              {row.earlyOutMinutes > 0 ? `Early: ${row.earlyOutFormatted}` : ''}
                              {!row.lateInMinutes && !row.earlyOutMinutes ? 'On Time' : ''}
                            </div>
                          </div>

                          <div>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Working Hours</span>
                            <div style={{ fontSize: '12px', fontWeight: 800, color: '#818cf8' }}>
                              {row.totalWorkingHoursFormatted || '0h'}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8' }}>
                          <BreakPopover totalBreakMinutes={row.totalBreakMinutes || 0} breaks={breaksList} />
                          {row.leaveTypeName && <span style={{ color: '#38bdf8' }}>{row.leaveTypeName}</span>}
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
