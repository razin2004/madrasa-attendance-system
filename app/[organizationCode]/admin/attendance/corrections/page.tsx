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
  CheckCircle2,
  XCircle,
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
  staffProfileId?: string;
  staffProfile?: {
    id: string;
    name: string;
    staffId: string;
  };
  staff?: {
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
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [showMobileFilters, setShowMobileFilters] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<CorrectionRequest[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [orgData, setOrgData] = useState<any>(null);

  // Approval Modal State
  const [approveModal, setApproveModal] = useState<{
    isOpen: boolean;
    requestIds: string[];
    staffName?: string;
  }>({ isOpen: false, requestIds: [] });

  // Rejection Modal State
  const [rejectModal, setRejectModal] = useState<{
    isOpen: boolean;
    requestIds: string[];
    reason: string;
    staffName?: string;
  }>({ isOpen: false, requestIds: [], reason: '' });

  const [modalActionLoading, setModalActionLoading] = useState(false);

  const getStaffName = (item: CorrectionRequest) =>
    item.staffProfile?.name || item.staff?.name || 'Staff Member';

  const getStaffId = (item: CorrectionRequest) =>
    item.staffProfile?.staffId || item.staff?.staffId || '—';

  const getStaffProfileId = (item: CorrectionRequest) =>
    item.staffProfile?.id || item.staff?.id || item.staffProfileId || '';

  const formatDateString = (rawDate?: string | null) => {
    if (!rawDate) return '—';
    if (typeof rawDate === 'string' && rawDate.length >= 10) {
      return rawDate.slice(0, 10);
    }
    try {
      return new Date(rawDate).toISOString().slice(0, 10);
    } catch {
      return String(rawDate);
    }
  };

  const formatPunchTime = (iso?: string | null) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  };

  const parseReasonAndFailures = (rawReason?: string | null) => {
    if (!rawReason || !rawReason.trim()) {
      return { staffReason: null, securityFailures: [] };
    }

    let text = rawReason.trim();
    let staffReason: string | null = null;
    let securityFailures: string[] = [];

    const reasonMatch = text.match(/Reason:\s*["']?([^"(|)]+)["']?/i);
    if (reasonMatch && reasonMatch[1]) {
      const matched = reasonMatch[1].trim();
      if (matched && !matched.toLowerCase().startsWith('failures:')) {
        staffReason = matched;
      }
    }

    const failureMatch = text.match(/Failures:\s*([^)]+)/i);
    if (failureMatch && failureMatch[1]) {
      const rawFailuresStr = failureMatch[1].trim();
      securityFailures = rawFailuresStr
        .split(';')
        .map((s) => s.trim().replace(/^\./, '').replace(/\.$/, ''))
        .filter(Boolean);
    }

    if (!staffReason) {
      if (text.includes('Failures:')) {
        const parts = text.split(/Failures:/i);
        const before = parts[0].replace(/Unverified punch\.?/i, '').replace(/Reason:\s*/i, '').trim();
        if (before && before !== 'Unverified punch') {
          staffReason = before;
        }
      } else {
        staffReason = text;
      }
    }

    return { staffReason, securityFailures };
  };

  useEffect(() => {
    if (!organizationCode) return;
    fetch(`/api/org/${organizationCode}/branding`)
      .then((r) => r.json())
      .then((data) => {
        if (data.organization) setOrgData(data.organization);
      })
      .catch(() => {});
  }, [organizationCode]);

  const fetchCorrections = async () => {
    if (!organizationCode) return;
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
    if (!organizationCode) return;
    fetchCorrections();
    setSelectedIds([]);
  }, [organizationCode, statusFilter]);

  // Open Approval Confirmation Modal
  const openSingleApprove = (item: CorrectionRequest) => {
    setApproveModal({
      isOpen: true,
      requestIds: [item.id],
      staffName: getStaffName(item),
    });
  };

  const openBulkApprove = () => {
    if (selectedIds.length === 0) return;
    const singleItem = selectedIds.length === 1 ? requests.find((r) => r.id === selectedIds[0]) : null;
    setApproveModal({
      isOpen: true,
      requestIds: selectedIds,
      staffName: singleItem ? getStaffName(singleItem) : undefined,
    });
  };

  const confirmApproval = async () => {
    if (approveModal.requestIds.length === 0) return;
    setModalActionLoading(true);

    try {
      if (approveModal.requestIds.length === 1) {
        const requestId = approveModal.requestIds[0];
        const res = await fetch(
          `/api/org/${organizationCode}/attendance/admin/corrections/${requestId}/approve`,
          { method: 'POST' }
        );
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to approve correction request.');
        }
        toast.success('Attendance correction approved.');
      } else {
        const res = await fetch(
          `/api/org/${organizationCode}/attendance/admin/corrections/bulk-approve`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requestIds: approveModal.requestIds }),
          }
        );
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to bulk approve requests.');
        }
        toast.success(data.message || `Successfully approved ${approveModal.requestIds.length} request(s)!`);
        setSelectedIds([]);
      }

      setApproveModal({ isOpen: false, requestIds: [] });
      fetchCorrections();
    } catch (err: any) {
      toast.error(err.message || 'Error executing approval.');
    } finally {
      setModalActionLoading(false);
    }
  };

  // Open Rejection Confirmation Modal
  const openSingleReject = (item: CorrectionRequest) => {
    setRejectModal({
      isOpen: true,
      requestIds: [item.id],
      reason: '',
      staffName: getStaffName(item),
    });
  };

  const openBulkReject = () => {
    if (selectedIds.length === 0) return;
    const singleItem = selectedIds.length === 1 ? requests.find((r) => r.id === selectedIds[0]) : null;
    setRejectModal({
      isOpen: true,
      requestIds: selectedIds,
      reason: '',
      staffName: singleItem ? getStaffName(singleItem) : undefined,
    });
  };

  const confirmRejection = async () => {
    const cleanReason = rejectModal.reason.trim();
    if (cleanReason.length < 2) {
      toast.error('Rejection reason must be at least 2 characters long.');
      return;
    }
    if (rejectModal.requestIds.length === 0) return;

    setModalActionLoading(true);
    try {
      if (rejectModal.requestIds.length === 1) {
        const requestId = rejectModal.requestIds[0];
        const res = await fetch(
          `/api/org/${organizationCode}/attendance/admin/corrections/${requestId}/reject`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rejectionReason: cleanReason }),
          }
        );
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to reject correction request.');
        }
        toast.info('Attendance correction request rejected.');
      } else {
        const res = await fetch(
          `/api/org/${organizationCode}/attendance/admin/corrections/bulk-reject`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              requestIds: rejectModal.requestIds,
              rejectionReason: cleanReason,
            }),
          }
        );
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to bulk reject requests.');
        }
        toast.info(data.message || `Rejected ${rejectModal.requestIds.length} request(s).`);
        setSelectedIds([]);
      }

      setRejectModal({ isOpen: false, requestIds: [], reason: '' });
      fetchCorrections();
    } catch (err: any) {
      toast.error(err.message || 'Error executing rejection.');
    } finally {
      setModalActionLoading(false);
    }
  };

  const pendingCount = requests.filter((r) => r.status === 'PENDING').length;
  const approvedCount = requests.filter((r) => r.status === 'APPROVED').length;
  const rejectedCount = requests.filter((r) => r.status === 'REJECTED').length;

  const filteredRequests = requests.filter((r) => {
    // Problem / Punch Type Filter
    if (typeFilter === 'UNVERIFIED_IN') {
      if (r.type !== 'MISSING_CLOCK_IN' && r.type !== 'INCORRECT_CLOCK_IN') return false;
    } else if (typeFilter === 'UNVERIFIED_OUT') {
      if (r.type !== 'MISSING_CLOCK_OUT' && r.type !== 'INCORRECT_CLOCK_OUT') return false;
    } else if (typeFilter === 'MANUAL') {
      if (r.type !== 'MANUAL_ENTRY') return false;
    } else if (typeFilter !== 'ALL') {
      if (r.type !== typeFilter) return false;
    }

    // Search query filter
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const sName = getStaffName(r).toLowerCase();
    const sId = getStaffId(r).toLowerCase();
    return (
      sName.includes(q) ||
      sId.includes(q) ||
      r.reason?.toLowerCase().includes(q) ||
      r.type?.toLowerCase().includes(q)
    );
  });

  const pendingFilteredRequests = filteredRequests.filter((r) => r.status === 'PENDING');
  const isAllSelected =
    pendingFilteredRequests.length > 0 &&
    pendingFilteredRequests.every((r) => selectedIds.includes(r.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pendingFilteredRequests.map((r) => r.id));
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const renderTypeBadge = (type: string) => {
    if (type === 'MISSING_CLOCK_IN' || type === 'INCORRECT_CLOCK_IN') {
      return (
        <span
          className={styles.badge}
          style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' }}
        >
          🔴 Unverified Clock In
        </span>
      );
    }
    if (type === 'MISSING_CLOCK_OUT' || type === 'INCORRECT_CLOCK_OUT') {
      return (
        <span
          className={styles.badge}
          style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)' }}
        >
          🟡 Unverified Clock Out
        </span>
      );
    }
    return (
      <span
        className={styles.badge}
        style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)' }}
      >
        🔵 Manual Entry
      </span>
    );
  };

  const isRejectButtonEnabled = rejectModal.reason.trim().length >= 2;

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

            {/* Problem / Unverified Type Filter */}
            <select
              className={styles.typeSelect}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              title="Filter by Punch Issue Type"
            >
              <option value="ALL">All Problem Types</option>
              <option value="UNVERIFIED_IN">🔴 Unverified Clock In</option>
              <option value="UNVERIFIED_OUT">🟡 Unverified Clock Out</option>
              <option value="MANUAL">🔵 Manual Entry Request</option>
            </select>

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
                  No requests match the current search, status, or problem type filter.
                </p>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className={styles.desktopTableView}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th className={styles.th} style={{ width: '40px', textAlign: 'center' }}>
                          {statusFilter === 'PENDING' || !statusFilter ? (
                            <input
                              type="checkbox"
                              className={styles.checkbox}
                              checked={isAllSelected}
                              onChange={toggleSelectAll}
                              title="Select All Pending Requests"
                            />
                          ) : null}
                        </th>
                        <th className={styles.th}>Staff Member</th>
                        <th className={styles.th}>Affected Date</th>
                        <th className={styles.th}>Problem / Punch Type</th>
                        <th className={styles.th}>Requested Time</th>
                        <th className={styles.th}>Outage Reason / Justification</th>
                        <th className={styles.th} style={{ textAlign: 'right' }}>Status / Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRequests.map((item) => {
                        const isPending = item.status === 'PENDING';
                        const isSelected = selectedIds.includes(item.id);
                        const profileId = getStaffProfileId(item);

                        return (
                          <tr
                            key={item.id}
                            className={styles.tr}
                            style={{ background: isSelected ? 'rgba(99, 102, 241, 0.1)' : undefined }}
                          >
                            <td className={styles.td} style={{ textAlign: 'center' }}>
                              {isPending ? (
                                <input
                                  type="checkbox"
                                  className={styles.checkbox}
                                  checked={isSelected}
                                  onChange={() => toggleSelect(item.id)}
                                />
                              ) : null}
                            </td>
                            <td
                              className={styles.td}
                              onClick={() => {
                                if (profileId) router.push(`/${organizationCode}/admin/staff/${profileId}`);
                              }}
                              style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}
                              title="View Staff Profile"
                            >
                              <div className={styles.staffName} style={{ color: '#818cf8', textDecoration: 'underline', textUnderlineOffset: '3px' }}>
                                {getStaffName(item)}
                              </div>
                              <div className={styles.staffId}>ID: {getStaffId(item)}</div>
                            </td>
                            <td className={styles.td} style={{ fontWeight: 700, color: '#ffffff', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                              {formatDateString(item.date)}
                            </td>
                            <td className={styles.td} style={{ whiteSpace: 'nowrap' }}>
                              {renderTypeBadge(item.type)}
                            </td>
                            <td className={styles.td} style={{ fontSize: '12.5px', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                              In: <span style={{ color: '#34d399', fontWeight: 700 }}>{formatPunchTime(item.requestedClockIn)}</span> &bull; Out:{' '}
                              <span style={{ color: '#fbbf24', fontWeight: 700 }}>{formatPunchTime(item.requestedClockOut)}</span>
                            </td>
                             <td className={styles.td} style={{ fontSize: '12px', maxWidth: '300px' }}>
                               {(() => {
                                 const parsed = parseReasonAndFailures(item.reason);
                                 return (
                                   <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                     {parsed.staffReason ? (
                                       <div style={{ fontWeight: 700, color: '#818cf8', fontSize: '12.5px' }}>
                                         💬 &ldquo;{parsed.staffReason}&rdquo;
                                       </div>
                                     ) : null}
                                     {parsed.securityFailures.length > 0 ? (
                                       <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '11px', color: '#fb7185' }}>
                                         {parsed.securityFailures.map((f, i) => (
                                           <div key={i} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                             • Point {i + 1}: {f}
                                           </div>
                                         ))}
                                       </div>
                                     ) : !parsed.staffReason ? (
                                       <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>&ldquo;{item.reason}&rdquo;</span>
                                     ) : null}
                                   </div>
                                 );
                               })()}
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
                                    onClick={() => openSingleApprove(item)}
                                    className="btn btn-success btn-sm"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 12px', fontSize: '12px', borderRadius: '8px' }}
                                  >
                                    <Check size={14} />
                                    <span>Approve</span>
                                  </button>
                                  <button
                                    onClick={() => openSingleReject(item)}
                                    className="btn btn-danger btn-sm"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 12px', fontSize: '12px', borderRadius: '8px' }}
                                  >
                                    <X size={14} />
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
                    const isSelected = selectedIds.includes(item.id);
                    const profileId = getStaffProfileId(item);

                    return (
                      <div
                        key={item.id}
                        className={styles.requestCard}
                        style={{ borderLeft: isSelected ? '3px solid #6366f1' : undefined }}
                      >
                        <div className={styles.cardHeader}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {isPending && (
                              <input
                                type="checkbox"
                                className={styles.checkbox}
                                checked={isSelected}
                                onChange={() => toggleSelect(item.id)}
                              />
                            )}
                            <div
                              onClick={() => {
                                if (profileId) router.push(`/${organizationCode}/admin/staff/${profileId}`);
                              }}
                              style={{ cursor: 'pointer' }}
                            >
                              <div className={styles.staffName} style={{ color: '#818cf8' }}>{getStaffName(item)}</div>
                              <div className={styles.staffId}>ID: {getStaffId(item)}</div>
                            </div>
                          </div>
                          <span className={`${styles.badge} ${styles[`badge${item.status}`]}`}>
                            {item.status}
                          </span>
                        </div>

                        <div className={styles.stackedGrid}>
                          <div className={styles.stackedCol}>
                            <span className={styles.colLabel}>Date &amp; Problem Type</span>
                            <span className={styles.colVal}>{formatDateString(item.date)}</span>
                            <div style={{ marginTop: '4px' }}>{renderTypeBadge(item.type)}</div>
                          </div>
                          <div className={styles.stackedCol}>
                            <span className={styles.colLabel}>Requested Time</span>
                            <span className={styles.colValTime}>In: <strong style={{ color: '#34d399' }}>{formatPunchTime(item.requestedClockIn)}</strong></span>
                            <span className={styles.colValTime}>Out: <strong style={{ color: '#fbbf24' }}>{formatPunchTime(item.requestedClockOut)}</strong></span>
                          </div>
                        </div>

                        {item.reason && (() => {
                          const parsed = parseReasonAndFailures(item.reason);
                          return (
                            <div className={styles.reasonQuote} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {parsed.staffReason ? (
                                <div style={{ fontWeight: 700, color: '#818cf8', fontSize: '13px' }}>
                                  💬 Justification: &ldquo;{parsed.staffReason}&rdquo;
                                </div>
                              ) : null}
                              {parsed.securityFailures.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px' }}>
                                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#fb7185', textTransform: 'uppercase' }}>
                                    Security Failure Points ({parsed.securityFailures.length}):
                                  </div>
                                  {parsed.securityFailures.map((f, i) => (
                                    <div key={i} style={{ fontSize: '11.5px', color: '#f8fafc', paddingLeft: '6px', borderLeft: '2px solid rgba(244, 63, 94, 0.4)' }}>
                                      <strong>Point {i + 1}:</strong> {f}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })()}

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
                                onClick={() => openSingleApprove(item)}
                                className="btn btn-success btn-sm"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 10px', fontSize: '12px', borderRadius: '8px' }}
                              >
                                <Check size={14} />
                                <span>Approve</span>
                              </button>
                              <button
                                onClick={() => openSingleReject(item)}
                                className="btn btn-danger btn-sm"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 10px', fontSize: '12px', borderRadius: '8px' }}
                              >
                                <X size={14} />
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

      {/* Floating / Sticky Bulk Actions Toolbar */}
      {selectedIds.length > 0 && (
        <div className={styles.bulkActionBar}>
          <div className={styles.bulkInfo}>
            <span className={styles.bulkCount}>{selectedIds.length}</span>
            <span>request(s) selected</span>
          </div>
          <div className={styles.bulkButtons}>
            <button
              type="button"
              onClick={openBulkApprove}
              disabled={modalActionLoading}
              className="btn btn-success btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', fontWeight: 600 }}
            >
              <CheckCircle2 size={15} />
              <span>Approve Selected ({selectedIds.length})</span>
            </button>

            <button
              type="button"
              onClick={openBulkReject}
              disabled={modalActionLoading}
              className="btn btn-danger btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', fontWeight: 600 }}
            >
              <XCircle size={15} />
              <span>Reject Selected ({selectedIds.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="btn btn-secondary btn-sm"
              style={{ padding: '8px 12px', borderRadius: '8px' }}
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* Approval Confirmation Modal */}
      {approveModal.isOpen && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#34d399' }}>
                <CheckCircle2 size={20} />
                <span>Confirm Attendance Approval</span>
              </h3>
              <button
                type="button"
                onClick={() => setApproveModal({ isOpen: false, requestIds: [] })}
                disabled={modalActionLoading}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '20px' }}>
              <p style={{ fontSize: '14px', color: '#e2e8f0', marginBottom: '20px', lineHeight: 1.5 }}>
                {approveModal.requestIds.length === 1
                  ? `Are you sure you want to approve the attendance correction request for ${approveModal.staffName || 'this staff member'}?`
                  : `Are you sure you want to BULK APPROVE ${approveModal.requestIds.length} selected attendance correction request(s)?`}
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setApproveModal({ isOpen: false, requestIds: [] })}
                  disabled={modalActionLoading}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmApproval}
                  disabled={modalActionLoading}
                  className="btn btn-success btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 18px', fontWeight: 600 }}
                >
                  {modalActionLoading ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}
                  <span>
                    {modalActionLoading
                      ? 'Approving...'
                      : approveModal.requestIds.length === 1
                      ? 'Confirm Approval'
                      : `Approve (${approveModal.requestIds.length}) Requests`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Confirmation Modal */}
      {rejectModal.isOpen && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f87171' }}>
                <XCircle size={20} />
                <span>Confirm Attendance Rejection</span>
              </h3>
              <button
                type="button"
                onClick={() => setRejectModal({ isOpen: false, requestIds: [], reason: '' })}
                disabled={modalActionLoading}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '20px' }}>
              <p style={{ fontSize: '13.5px', color: '#cbd5e1', marginBottom: '12px', lineHeight: 1.5 }}>
                {rejectModal.requestIds.length === 1
                  ? `Please enter a rejection reason for ${rejectModal.staffName || 'this staff member'}'s request:`
                  : `Please enter a rejection reason for ${rejectModal.requestIds.length} selected request(s):`}
              </p>

              <textarea
                rows={3}
                value={rejectModal.reason}
                onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })}
                placeholder="Enter rejection reason..."
                className="form-control"
                style={{
                  width: '100%',
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  resize: 'none',
                  marginBottom: '8px',
                  borderColor: isRejectButtonEnabled ? '#10b981' : '#334155',
                }}
              />

              <div style={{ fontSize: '11.5px', marginBottom: '20px', fontWeight: 600 }}>
                {rejectModal.reason.trim().length === 0 ? (
                  <span style={{ color: '#ef4444' }}>⚠️ Rejection reason is required.</span>
                ) : rejectModal.reason.trim().length === 1 ? (
                  <span style={{ color: '#fbbf24' }}>⚠️ Minimum 2 letters required (1/2).</span>
                ) : (
                  <span style={{ color: '#34d399' }}>✓ Valid rejection reason.</span>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setRejectModal({ isOpen: false, requestIds: [], reason: '' })}
                  disabled={modalActionLoading}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmRejection}
                  disabled={!isRejectButtonEnabled || modalActionLoading}
                  className="btn btn-danger btn-sm"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 18px',
                    fontWeight: 600,
                    opacity: !isRejectButtonEnabled || modalActionLoading ? 0.5 : 1,
                    cursor: !isRejectButtonEnabled || modalActionLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {modalActionLoading ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <XCircle size={16} />
                  )}
                  <span>
                    {modalActionLoading
                      ? 'Rejecting...'
                      : rejectModal.requestIds.length === 1
                      ? 'Confirm Rejection'
                      : `Reject (${rejectModal.requestIds.length}) Requests`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <OrgAdminMobileNav organizationCode={organizationCode} />
    </div>
  );
}
