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
        {/* Header Bar */}
        <header className={styles.headerBar}>
          <div>
            <h1 className={styles.title}>Daily Attendance Overview</h1>
            <p className={styles.subtitle}>
              Monitor 3-layer verified punches, manual entries, and corrections for <strong>{date}</strong>.
            </p>
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
              title="Attendance Actions Menu"
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
          </div>
        </header>

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

          {/* Filter Bar */}
          <div className={styles.filterBar} style={{ padding: 0, margin: '0 0 20px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12.5px', color: 'var(--text-muted)', fontWeight: 600 }}>Date:</span>
              <input
                type="date"
                className="form-input"
                style={{ height: '36px', fontSize: '13px' }}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12.5px', color: 'var(--text-muted)', fontWeight: 600 }}>Source:</span>
              <select
                className="form-input"
                style={{ height: '36px', fontSize: '13px', backgroundColor: '#0d121f', color: '#ffffff' }}
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                <option value="" style={{ backgroundColor: '#0d121f', color: '#ffffff' }}>All Sources</option>
                <option value="NORMAL" style={{ backgroundColor: '#0d121f', color: '#ffffff' }}>NORMAL (3-Layer Verified)</option>
                <option value="MANUAL" style={{ backgroundColor: '#0d121f', color: '#ffffff' }}>MANUAL (Admin Created)</option>
                <option value="ADJUSTED" style={{ backgroundColor: '#0d121f', color: '#ffffff' }}>ADJUSTED (Correction Approved)</option>
              </select>
            </div>

            <form
              onSubmit={handleSearchSubmit}
              style={{ display: 'flex', gap: '8px', flex: 1, minWidth: '220px' }}
            >
              <input
                type="text"
                className="form-input"
                style={{ flex: 1, height: '36px', fontSize: '13px' }}
                placeholder="Search staff name or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button type="submit" className="btn btn-secondary btn-sm" style={{ padding: '8px 12px' }}>
                <Search size={14} />
              </button>
            </form>

            <button
              onClick={fetchData}
              className="btn btn-secondary btn-sm"
              style={{ padding: '8px 12px' }}
              title="Refresh"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

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
          )}
        </div>
        </main>
      </div>
      <OrgAdminMobileNav organizationCode={organizationCode} />
    </div>
  );
}
