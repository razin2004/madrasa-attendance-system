'use client';

import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { OrgAdminSidebar } from '../../../../components/layout/org-admin-sidebar';
import { OrgAdminMobileNav } from '../../../../components/layout/org-admin-mobile-nav';
import { OrgAdminHeader } from '@/components/layout/org-admin-header';
import { useToast } from '../../../../components/feedback/toast-provider';
import styles from './AdminAttendance.module.css';

interface DailyAttendanceItem {
  staff: {
    id: string;
    name: string;
    staffId: string;
  };
  branch: {
    name: string;
  } | null;
  clockIn: string | null;
  clockOut: string | null;
  source: 'NORMAL' | 'MANUAL' | 'ADJUSTED';
  isManualEntry: boolean;
  manualReason?: string | null;
  creator?: {
    name: string;
  } | null;
}

export default function AdminAttendancePage() {
  const params = useParams();
  const organizationCode = (params.organizationCode as string)?.toUpperCase() || '';
  const router = useRouter();
  const toast = useToast();

  const todayStr = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(todayStr);
  const [source, setSource] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const [dailyList, setDailyList] = useState<DailyAttendanceItem[]>([]);
  const [metrics, setMetrics] = useState({
    totalPresent: 0,
    normalCount: 0,
    manualCount: 0,
    adjustedCount: 0,
  });

  const [orgData, setOrgData] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/org/${organizationCode}/branding`)
      .then((r) => r.json())
      .then((data) => {
        if (data.organization) setOrgData(data.organization);
      })
      .catch(() => {});
  }, [organizationCode]);

  const fetchData = async () => {
    try {
      setLoading(true);
      let url = `/api/org/${organizationCode}/attendance/admin?date=${date}`;
      if (source) url += `&source=${source}`;
      if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;

      const res = await fetch(url);
      const data = await res.json();

      if (res.ok && data.success) {
        setDailyList(data.dailyList || []);
        if (data.metrics) setMetrics(data.metrics);
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
  }, [organizationCode, date, source]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData();
  };

  const formatTime = (iso?: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
          panelSubtitle={`Monitor 3-layer verified punches, manual entries, and corrections for ${date}`}
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
          {/* Top Metrics Cards */}
          <div className={styles.metricsGrid} style={{ margin: '0 0 20px 0' }}>
            <div className={styles.metricCard} style={{ borderLeft: '3px solid #3b82f6' }}>
              <div className={styles.metricLabel}>Total Present</div>
              <div className={styles.metricValue}>{metrics.totalPresent}</div>
            </div>

            <div className={styles.metricCard} style={{ borderLeft: '3px solid #10b981' }}>
              <div className={styles.metricLabel}>Verified (Normal)</div>
              <div className={styles.metricValue} style={{ color: '#34d399' }}>
                {metrics.normalCount}
              </div>
            </div>

            <div className={styles.metricCard} style={{ borderLeft: '3px solid #f59e0b' }}>
              <div className={styles.metricLabel}>Manual Admin Entries</div>
              <div className={styles.metricValue} style={{ color: '#fbbf24' }}>
                {metrics.manualCount}
              </div>
            </div>

            <div className={styles.metricCard} style={{ borderLeft: '3px solid #38bdf8' }}>
              <div className={styles.metricLabel}>Adjusted Corrections</div>
              <div className={styles.metricValue} style={{ color: '#38bdf8' }}>
                {metrics.adjustedCount}
              </div>
            </div>
          </div>

          {/* Search Field with Pinned Filter Icon (Staff Panel Style) */}
          <div style={{ marginBottom: '16px', width: '100%' }}>
            <div className={styles.searchInputWrapper}>
              <Search size={15} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search staff name or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    fetchData();
                  }
                }}
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
                className={`${styles.filterToggleBtn} ${(source || (date && date !== todayStr)) ? styles.filterToggleBtnActive : ''}`}
                title="Toggle Filters"
              >
                <Filter size={15} color={(source || (date && date !== todayStr)) ? '#818cf8' : 'currentColor'} />
              </button>
            </div>
          </div>

          {/* Filter Bottom Sheet Modal Overlay (Appears when filter icon is clicked) */}
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
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
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

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
                  {/* Target Date Input */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>
                      Target Log Date
                    </label>
                    <input
                      type="date"
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
                        boxSizing: 'border-box',
                      }}
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </div>

                  {/* Verification Source Select */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>
                      Verification Source
                    </label>
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
                        boxSizing: 'border-box',
                      }}
                      value={source}
                      onChange={(e) => setSource(e.target.value)}
                    >
                      <option value="">All Verification Sources</option>
                      <option value="NORMAL">NORMAL (3-Layer Verified)</option>
                      <option value="MANUAL">MANUAL (Admin Created)</option>
                      <option value="ADJUSTED">ADJUSTED (Correction Approved)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                  {(source || (date && date !== todayStr)) ? (
                    <button
                      type="button"
                      onClick={() => {
                        setDate(todayStr);
                        setSource('');
                      }}
                      className="btn btn-secondary btn-xs"
                      style={{ borderRadius: '6px', fontSize: '11px', padding: '6px 12px' }}
                    >
                      Reset Filters
                    </button>
                  ) : <div />}

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
          ) : dailyList.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <Clock size={36} color="var(--text-muted)" style={{ margin: '0 auto 12px auto' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', margin: '0 0 4px 0' }}>
                No attendance logs found
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                No staff attendance recorded for the selected date and filters.
              </p>
            </div>
          ) : (
            <>
              {/* MOBILE FEED CARDS */}
              <div className={styles.feedCardsContainer} style={{ marginBottom: '16px' }}>
                {dailyList.map((item, idx) => (
                  <div
                    key={idx}
                    className={styles.feedCard}
                    onClick={() => router.push(`/${organizationCode}/admin/staff/${item.staff.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'rgba(99, 102, 241, 0.2)', border: '1px solid rgba(99, 102, 241, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8', fontWeight: 800, fontSize: '13px' }}>
                        {item.staff.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>{item.staff.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1px' }}>
                          <MapPin size={11} color="#38bdf8" />
                          <span>{item.branch?.name || 'Unassigned'}</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12.5px', fontWeight: 700, color: '#34d399' }}>
                        {formatTime(item.clockIn)} {item.clockOut ? `– ${formatTime(item.clockOut)}` : ''}
                      </div>
                      <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                        <span className={`${styles.sourceBadge} ${styles[`source${item.source}`]}`}>
                          {item.source}
                        </span>
                        <CheckCircle2 size={13} color="#34d399" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* DESKTOP ATTENDANCE TABLE */}
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>Staff Member</th>
                    <th className={styles.th}>Branch</th>
                    <th className={styles.th}>Clock In</th>
                    <th className={styles.th}>Clock Out</th>
                    <th className={styles.th}>Source</th>
                    <th className={styles.th}>Verification Details</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyList.map((item, idx) => (
                    <tr
                      key={idx}
                      onClick={() => router.push(`/${organizationCode}/admin/staff/${item.staff.id}`)}
                      style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', transition: 'background 0.15s ease' }}
                    >
                      <td className={styles.td}>
                        <div style={{ fontWeight: 700, color: '#ffffff' }}>{item.staff.name}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#818cf8', marginTop: '1px' }}>
                          ID: {item.staff.staffId}
                        </div>
                      </td>

                      <td className={styles.td}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <MapPin size={13} color="#38bdf8" />
                          <span style={{ color: '#f8fafc' }}>{item.branch?.name || 'Unassigned'}</span>
                        </span>
                      </td>

                      <td className={styles.td}>
                        <strong style={{ color: '#34d399', fontFamily: 'var(--font-mono)' }}>{formatTime(item.clockIn)}</strong>
                      </td>

                      <td className={styles.td}>
                        <strong style={{ color: '#fbbf24', fontFamily: 'var(--font-mono)' }}>{formatTime(item.clockOut)}</strong>
                      </td>

                      <td className={styles.td}>
                        <span className={`${styles.sourceBadge} ${styles[`source${item.source}`]}`}>
                          {item.source}
                        </span>
                      </td>

                      <td className={styles.td} style={{ fontSize: '12px' }}>
                        {item.isManualEntry ? (
                          <div>
                            <span style={{ color: '#fbbf24' }}>Manual Entry by Admin</span>
                            {item.creator && <span> ({item.creator.name})</span>}
                            {item.manualReason && (
                              <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '2px' }}>
                                &ldquo;{item.manualReason}&rdquo;
                              </div>
                            )}
                          </div>
                        ) : item.source === 'ADJUSTED' ? (
                          <span style={{ color: '#38bdf8' }}>Approved Adjustment</span>
                        ) : (
                          <span style={{ color: '#34d399', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={13} /> 3-Layer Verified
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
        </main>
      </div>
      <OrgAdminMobileNav organizationCode={organizationCode} />
    </div>
  );
}
