'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Filter,
  Search,
  ShieldCheck,
  Loader2,
  Check,
  X,
  ArrowRight,
} from 'lucide-react';
import { OrgAdminSidebar } from '@/components/layout/org-admin-sidebar';
import { OrgAdminMobileNav } from '@/components/layout/org-admin-mobile-nav';
import { OrgAdminHeader } from '@/components/layout/org-admin-header';
import { useToast } from '@/components/feedback/toast-provider';
import styles from './Corrections.module.css';

interface CorrectionRequest {
  id: string;
  date: string;
  type: string;
  requestedClockIn: string | null;
  requestedClockOut: string | null;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  staff: {
    id: string;
    name: string;
    staffId: string;
  };
}

export default function AdminAttendanceCorrectionsPage() {
  const params = useParams();
  const organizationCode = (params.organizationCode as string)?.toUpperCase() || '';
  const router = useRouter();
  const toast = useToast();

  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const [search, setSearch] = useState<string>('');
  const [showMobileFilters, setShowMobileFilters] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<CorrectionRequest[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [orgData, setOrgData] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/org/${organizationCode}/branding`)
      .then((r) => r.json())
      .then((data) => {
        if (data.organization) setOrgData(data.organization);
      })
      .catch(() => {});
  }, [organizationCode]);

  const fetchCorrections = async () => {
    setLoading(true);
    try {
      let url = `/api/org/${organizationCode}/attendance/admin/corrections?status=${statusFilter}`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok && data.success) {
        setRequests(data.requests || []);
      } else {
        toast.error(data.error || 'Failed to load correction requests.');
      }
    } catch {
      toast.error('Network error loading corrections.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCorrections();
  }, [organizationCode, statusFilter]);

  const handleAction = async (requestId: string, action: 'approve' | 'reject') => {
    setProcessingId(requestId);
    try {
      const res = await fetch(
        `/api/org/${organizationCode}/attendance/admin/corrections/${requestId}/${action}`,
        { method: 'POST' }
      );
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Correction request ${action}d successfully.`);
        fetchCorrections();
      } else {
        toast.error(data.error || `Failed to ${action} correction.`);
      }
    } catch {
      toast.error(`Network error during ${action}.`);
    } finally {
      setProcessingId(null);
    }
  };

  const pendingCount = requests.filter((r) => r.status === 'PENDING').length;
  const approvedCount = requests.filter((r) => r.status === 'APPROVED').length;
  const rejectedCount = requests.filter((r) => r.status === 'REJECTED').length;

  const filteredRequests = requests.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.staff.name.toLowerCase().includes(q) ||
      r.staff.staffId.toLowerCase().includes(q) ||
      r.reason?.toLowerCase().includes(q) ||
      r.type?.toLowerCase().includes(q)
    );
  });

  return (
    <div className={styles.container}>
      <OrgAdminSidebar
        organizationCode={organizationCode}
        organizationName={orgData?.name || 'ShiftGuard'}
        logoUrl={orgData?.logoUrl}
      />

      <div className={styles.mainContent}>
        <OrgAdminHeader
          panelTitle="Attendance Correction Requests"
          panelSubtitle="Review staff-reported punch issues, missed clock-ins, and approve time corrections."
          organizationCode={organizationCode}
          organizationName={orgData?.name}
          logoUrl={orgData?.logoUrl}
        />

        {/* Main Content Body */}
        <main className="pageMainContent" style={{ maxWidth: '1280px' }}>
          {/* Metrics Grid */}
          <div className={styles.metricsGrid}>
            <div className={styles.metricCard} style={{ borderLeft: '3px solid #fbbf24' }}>
              <div className={styles.metricLabel}>Pending Corrections</div>
              <div className={styles.metricValue} style={{ color: '#fbbf24' }}>{pendingCount}</div>
            </div>
            <div className={styles.metricCard} style={{ borderLeft: '3px solid #34d399' }}>
              <div className={styles.metricLabel}>Approved Corrections</div>
              <div className={styles.metricValue} style={{ color: '#34d399' }}>{approvedCount}</div>
            </div>
            <div className={styles.metricCard} style={{ borderLeft: '3px solid #f87171' }}>
              <div className={styles.metricLabel}>Rejected Requests</div>
              <div className={styles.metricValue} style={{ color: '#f87171' }}>{rejectedCount}</div>
            </div>
          </div>

          {/* Filter and Search Bar */}
          <div className={styles.filterSearchRow}>
            <div className={styles.searchInputWrapper}>
              <Search size={16} className={styles.searchIcon} />
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Search by staff name, ID, or reason..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <button
              type="button"
              className={styles.filterToggleBtn}
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              aria-label="Toggle filters"
            >
              <Filter size={18} />
            </button>

            <div className={`${styles.tabsGroup} ${showMobileFilters ? styles.tabsGroupOpen : ''}`}>
              {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st === 'ALL' ? '' : st)}
                  className={`${styles.tabButton} ${
                    (st === 'ALL' && !statusFilter) || statusFilter === st ? styles.tabButtonActive : ''
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Request Queue Container */}
          <div className={styles.tableCard}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <Loader2 size={32} className="animate-spin" style={{ color: '#818cf8', margin: '0 auto 12px auto' }} />
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading correction requests...</p>
              </div>
            ) : filteredRequests.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                <ShieldCheck size={36} color="var(--text-muted)" style={{ margin: '0 auto 12px auto' }} />
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', margin: '0 0 4px 0' }}>
                  No correction requests found
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                  No requests match the current search or status filter.
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
                        <th className={styles.th}>Affected Date</th>
                        <th className={styles.th}>Problem Type</th>
                        <th className={styles.th}>Requested Time</th>
                        <th className={styles.th}>Reason</th>
                        <th className={styles.th} style={{ textAlign: 'right' }}>Status / Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRequests.map((item) => {
                        const isPending = item.status === 'PENDING';
                        const isProcessing = processingId === item.id;

                        return (
                          <tr key={item.id} className={styles.tr}>
                            <td
                              className={styles.td}
                              onClick={() => router.push(`/${organizationCode}/admin/staff/${item.staff.id}`)}
                              style={{ cursor: 'pointer' }}
                              title="View Staff Profile"
                            >
                              <div className={styles.staffName} style={{ color: '#818cf8', textDecoration: 'underline', textUnderlineOffset: '3px' }}>{item.staff.name}</div>
                              <div className={styles.staffId}>ID: {item.staff.staffId}</div>
                            </td>
                            <td className={styles.td} style={{ fontWeight: 700, color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
                              {item.date}
                            </td>
                            <td className={styles.td}>
                              <span className={`${styles.badge} ${styles.badgePENDING}`}>
                                {item.type}
                              </span>
                            </td>
                            <td className={styles.td} style={{ fontSize: '12.5px', fontFamily: 'var(--font-mono)' }}>
                              In: <span style={{ color: '#34d399', fontWeight: 700 }}>{item.requestedClockIn || '—'}</span> &bull; Out:{' '}
                              <span style={{ color: '#fbbf24', fontWeight: 700 }}>{item.requestedClockOut || '—'}</span>
                            </td>
                            <td className={styles.td} style={{ fontSize: '12.5px', color: '#94a3b8', fontStyle: 'italic', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              &ldquo;{item.reason}&rdquo;
                            </td>
                            <td className={styles.td} style={{ textAlign: 'right' }}>
                              {isPending ? (
                                <div style={{ display: 'inline-flex', gap: '8px', justifyContent: 'flex-end' }}>
                                  <Link
                                    href={`/${organizationCode}/admin/attendance/corrections/${item.id}`}
                                    className="btn btn-secondary btn-sm"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 10px', fontSize: '12px', borderRadius: '8px' }}
                                  >
                                    <ArrowRight size={13} />
                                    <span>Review</span>
                                  </Link>
                                  <button
                                    onClick={() => handleAction(item.id, 'approve')}
                                    disabled={isProcessing}
                                    className="btn btn-success btn-sm"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 12px', fontSize: '12px', borderRadius: '8px' }}
                                  >
                                    {isProcessing ? <Loader2 size={12} className="animate-spin" /> : <Check size={14} />}
                                    <span>Approve</span>
                                  </button>
                                  <button
                                    onClick={() => handleAction(item.id, 'reject')}
                                    disabled={isProcessing}
                                    className="btn btn-danger btn-sm"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 12px', fontSize: '12px', borderRadius: '8px' }}
                                  >
                                    {isProcessing ? <Loader2 size={12} className="animate-spin" /> : <X size={14} />}
                                    <span>Reject</span>
                                  </button>
                                </div>
                              ) : (
                                <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-end' }}>
                                  <Link
                                    href={`/${organizationCode}/admin/attendance/corrections/${item.id}`}
                                    className="btn btn-secondary btn-sm"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 10px', fontSize: '12px', borderRadius: '8px' }}
                                  >
                                    <ArrowRight size={13} />
                                    <span>Details</span>
                                  </Link>
                                  <span className={`${styles.badge} ${styles[`badge${item.status}`]}`}>
                                    {item.status}
                                  </span>
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
                  {filteredRequests.map((item) => {
                    const isPending = item.status === 'PENDING';
                    const isProcessing = processingId === item.id;

                    return (
                      <div key={item.id} className={styles.requestCard}>
                        <div className={styles.cardHeader}>
                          <div
                            onClick={() => router.push(`/${organizationCode}/admin/staff/${item.staff.id}`)}
                            style={{ cursor: 'pointer' }}
                          >
                            <div className={styles.staffName} style={{ color: '#818cf8' }}>{item.staff.name}</div>
                            <div className={styles.staffId}>ID: {item.staff.staffId}</div>
                          </div>
                          <span className={`${styles.badge} ${styles[`badge${item.status}`]}`}>
                            {item.status}
                          </span>
                        </div>

                        <div className={styles.stackedGrid}>
                          <div className={styles.stackedCol}>
                            <span className={styles.colLabel}>Date &amp; Type</span>
                            <span className={styles.colVal}>{item.date}</span>
                            <span className={styles.typeSub}>{item.type}</span>
                          </div>
                          <div className={styles.stackedCol}>
                            <span className={styles.colLabel}>Requested Time</span>
                            <span className={styles.colValTime}>In: <strong style={{ color: '#34d399' }}>{item.requestedClockIn || '—'}</strong></span>
                            <span className={styles.colValTime}>Out: <strong style={{ color: '#fbbf24' }}>{item.requestedClockOut || '—'}</strong></span>
                          </div>
                        </div>

                        {item.reason && (
                          <div className={styles.reasonQuote}>
                            &ldquo;{item.reason}&rdquo;
                          </div>
                        )}

                        <div className={styles.cardActions}>
                          <Link
                            href={`/${organizationCode}/admin/attendance/corrections/${item.id}`}
                            className="btn btn-secondary btn-sm"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 12px', fontSize: '12px', borderRadius: '8px' }}
                          >
                            <ArrowRight size={13} />
                            <span>Review Details</span>
                          </Link>

                          {isPending && (
                            <div style={{ display: 'inline-flex', gap: '6px', marginLeft: 'auto' }}>
                              <button
                                onClick={() => handleAction(item.id, 'approve')}
                                disabled={isProcessing}
                                className="btn btn-success btn-sm"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 10px', fontSize: '12px', borderRadius: '8px' }}
                              >
                                {isProcessing ? <Loader2 size={12} className="animate-spin" /> : <Check size={14} />}
                                <span>Approve</span>
                              </button>
                              <button
                                onClick={() => handleAction(item.id, 'reject')}
                                disabled={isProcessing}
                                className="btn btn-danger btn-sm"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 10px', fontSize: '12px', borderRadius: '8px' }}
                              >
                                {isProcessing ? <Loader2 size={12} className="animate-spin" /> : <X size={14} />}
                                <span>Reject</span>
                              </button>
                            </div>
                          )}
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

