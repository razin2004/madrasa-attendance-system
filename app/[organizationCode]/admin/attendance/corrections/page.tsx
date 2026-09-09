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

const REJECTION_PRESETS = [
  'Unverified location / Outside geofence',
  'Unapproved network / Wi-Fi',
  'Unregistered mobile device',
  'Incorrect punch time submitted',
  'Insufficient explanation provided',
];

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
    item?: CorrectionRequest | null;
    approveClockIn: boolean;
    approveClockOut: boolean;
  }>({ isOpen: false, requestIds: [], approveClockIn: true, approveClockOut: true });

  // Rejection Modal State
  const [rejectModal, setRejectModal] = useState<{
    isOpen: boolean;
    requestIds: string[];
    reason: string;
    staffName?: string;
    item?: CorrectionRequest | null;
    rejectClockIn: boolean;
    rejectClockOut: boolean;
  }>({ isOpen: false, requestIds: [], reason: '', item: null, rejectClockIn: true, rejectClockOut: true });

  const [modalActionLoading, setModalActionLoading] = useState(false);

  const closeRejectModal = () =>
    setRejectModal({
      isOpen: false,
      requestIds: [],
      reason: '',
      item: null,
      rejectClockIn: true,
      rejectClockOut: true,
    });

  const getStaffName = (item: CorrectionRequest) =>
    item.staffProfile?.name || item.staff?.name || 'Staff Member';

  const formatDateStr = (dateInput?: string | Date | null) => {
    if (!dateInput) return '—';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCorrectionType = (type?: string) => {
    if (!type) return 'Correction';
    switch (type) {
      case 'MISSING_CLOCK_IN':
        return 'Missing Clock-In';
      case 'MISSING_CLOCK_OUT':
        return 'Missing Clock-Out';
      case 'INCORRECT_TIME':
        return 'Time Adjustment';
      case 'UNVERIFIED_PUNCH':
        return 'Unverified Punch';
      case 'MANUAL_ENTRY':
        return 'Manual Record Entry';
      default:
        return type.replace(/_/g, ' ');
    }
  };

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

  const getShortFailureLabel = (failure: string): string => {
    if (!failure) return '';
    const f = failure.toLowerCase();
    if (f.includes('device') || f.includes('browser') || f.includes('registered')) {
      return 'Unregistered Device';
    }
    if (f.includes('network') || f.includes('ip') || f.includes('wifi') || f.includes('branch network')) {
      return 'Unapproved Network';
    }
    if (f.includes('geofence') || f.includes('outside') || f.includes('location') || f.includes('gps') || f.includes('radius') || f.includes('perimeter')) {
      return 'Outside Geofence';
    }
    return failure;
  };

  const parseReasonAndFailures = (rawReason?: string | null) => {
    if (!rawReason || !rawReason.trim()) {
      return { staffReason: null, securityFailures: [] };
    }

    let text = rawReason.trim();
    let staffReason: string | null = null;
    let rawFailures: string[] = [];

    // Split by "| Clock Out:" or "Clock Out:" to parse both Clock In & Clock Out parts
    const parts = text.split(/\|\s*Clock Out:/i);
    const inPart = parts[0] || '';
    const outPart = parts[1] || '';

    // Extract In Reason
    let inReason: string | null = null;
    const inMatch = inPart.match(/Reason:\s*["']([^"']+)["']/i) || inPart.match(/Reason:\s*([^(|\n]+)/i);
    if (inMatch && inMatch[1]) {
      const m = inMatch[1].trim();
      if (m && !m.toLowerCase().startsWith('failures:')) inReason = m;
    }

    // Extract Out Reason
    let outReason: string | null = null;
    if (outPart) {
      const outMatch = outPart.match(/Reason:\s*["']([^"']+)["']/i) || outPart.match(/Reason:\s*([^(|\n]+)/i);
      if (outMatch && outMatch[1]) {
        const m = outMatch[1].trim();
        if (m && !m.toLowerCase().startsWith('failures:')) outReason = m;
      }
    }

    // Construct staffReason
    if (inReason && outReason) {
      staffReason = `Clock-In: "${inReason}" • Clock-Out: "${outReason}"`;
    } else if (inReason && outPart) {
      staffReason = `Clock-In: "${inReason}"`;
    } else if (inReason) {
      staffReason = inReason;
    } else if (outReason) {
      staffReason = `Clock-Out: "${outReason}"`;
    }

    // Clean up "Clock Out: Unverified punch" markers
    const cleanFailuresText = text
      .replace(/\|\s*Clock Out:\s*Unverified punch\.?/gi, ';')
      .replace(/Clock Out:\s*Unverified punch\.?/gi, ';')
      .replace(/Unverified punch\.?/gi, '');

    const failuresMatches = cleanFailuresText.matchAll(/Failures:\s*([^()|\n]+(?:\([^)]*\))?)/gi);
    for (const match of failuresMatches) {
      if (match[1]) {
        const items = match[1]
          .split(/;\s*(?![^()]*\))/g)
          .map((s) => s.trim().replace(/^\./, '').replace(/\.$/, ''))
          .filter(Boolean);
        rawFailures.push(...items);
      }
    }

    if (rawFailures.length === 0 && text.includes('Failures:')) {
      const failureParts = text.split(/Failures:/gi);
      for (let i = 1; i < failureParts.length; i++) {
        let segment = failureParts[i].split(/\|/)[0].trim();
        if (segment.endsWith(')')) segment = segment.slice(0, -1).trim();
        const items = segment
          .split(/;\s*(?![^()]*\))/g)
          .map((s) => s.trim().replace(/^\./, '').replace(/\.$/, ''))
          .filter(Boolean);
        rawFailures.push(...items);
      }
    }

    const securityFailures = Array.from(
      new Set(rawFailures.map((f) => getShortFailureLabel(f)))
    );

    if (!staffReason) {
      if (text.includes('Failures:')) {
        const segments = text.split(/Failures:/i);
        const before = segments[0]
          .replace(/Unverified punch\.?/gi, '')
          .replace(/Reason:\s*/gi, '')
          .replace(/[()]/gi, '')
          .trim();
        if (before && before.toLowerCase() !== 'unverified punch') {
          staffReason = before;
        }
      } else if (!text.toLowerCase().startsWith('unverified punch')) {
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
      item,
      approveClockIn: true,
      approveClockOut: true,
    });
  };

  const openBulkApprove = () => {
    if (selectedIds.length === 0) return;
    const singleItem = selectedIds.length === 1 ? requests.find((r) => r.id === selectedIds[0]) : null;
    setApproveModal({
      isOpen: true,
      requestIds: selectedIds,
      staffName: singleItem ? getStaffName(singleItem) : undefined,
      item: singleItem || null,
      approveClockIn: true,
      approveClockOut: true,
    });
  };

  const confirmApproval = async () => {
    if (approveModal.requestIds.length === 0) return;

    if (
      approveModal.requestIds.length === 1 &&
      approveModal.item?.requestedClockIn &&
      approveModal.item?.requestedClockOut &&
      !approveModal.approveClockIn &&
      !approveModal.approveClockOut
    ) {
      toast.error('Please select at least one punch (Clock-In or Clock-Out) to approve.');
      return;
    }

    setModalActionLoading(true);

    try {
      if (approveModal.requestIds.length === 1) {
        const requestId = approveModal.requestIds[0];
        const res = await fetch(
          `/api/org/${organizationCode}/attendance/admin/corrections/${requestId}/approve`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              approveClockIn: approveModal.approveClockIn,
              approveClockOut: approveModal.approveClockOut,
            }),
          }
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

      setApproveModal({ isOpen: false, requestIds: [], approveClockIn: true, approveClockOut: true });
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
      item,
      rejectClockIn: true,
      rejectClockOut: true,
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
      item: singleItem || null,
      rejectClockIn: true,
      rejectClockOut: true,
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

      closeRejectModal();
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

  const renderTypeBadge = (item: CorrectionRequest | string) => {
    const typeStr = typeof item === 'string' ? item : item.type;
    const hasIn = typeof item === 'object' ? Boolean(item.requestedClockIn || typeStr === 'MISSING_CLOCK_IN' || typeStr === 'INCORRECT_CLOCK_IN') : typeStr === 'MISSING_CLOCK_IN' || typeStr === 'INCORRECT_CLOCK_IN';
    const hasOut = typeof item === 'object' ? Boolean(item.requestedClockOut || typeStr === 'MISSING_CLOCK_OUT' || typeStr === 'INCORRECT_CLOCK_OUT') : typeStr === 'MISSING_CLOCK_OUT' || typeStr === 'INCORRECT_CLOCK_OUT';

    if (hasIn && hasOut) {
      return (
        <span
          className={styles.badge}
          style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' }}
        >
          🔴 Unverified Clock In &amp; Out
        </span>
      );
    }
    if (hasIn) {
      return (
        <span
          className={styles.badge}
          style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' }}
        >
          🔴 Unverified Clock In
        </span>
      );
    }
    if (hasOut) {
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
                        <th className={styles.th}>Staff Reason</th>
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
                            onClick={() => router.push(`/${organizationCode}/admin/attendance/corrections/${item.id}`)}
                            style={{ background: isSelected ? 'rgba(99, 102, 241, 0.1)' : undefined }}
                          >
                            <td className={styles.td} style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
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
                              onClick={(e) => {
                                e.stopPropagation();
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
                              {renderTypeBadge(item)}
                            </td>
                            <td className={styles.td} style={{ fontSize: '12.5px', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                              In: <span style={{ color: '#34d399', fontWeight: 700 }}>{formatPunchTime(item.requestedClockIn)}</span> &bull; Out:{' '}
                              <span style={{ color: '#fbbf24', fontWeight: 700 }}>{formatPunchTime(item.requestedClockOut)}</span>
                            </td>
                            <td className={styles.td} style={{ fontSize: '12.5px', maxWidth: '300px' }}>
                              {(() => {
                                const parsed = parseReasonAndFailures(item.reason);
                                return (
                                  <div>
                                    {parsed.staffReason ? (
                                      <div style={{ fontWeight: 700, color: '#818cf8', fontSize: '12.5px' }}>
                                        💬 &ldquo;{parsed.staffReason}&rdquo;
                                      </div>
                                    ) : (
                                      <div style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '11.5px' }}>
                                        No custom reason entered
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </td>
                            <td className={styles.td} style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
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
                        onClick={() => router.push(`/${organizationCode}/admin/attendance/corrections/${item.id}`)}
                        style={{ borderLeft: isSelected ? '3px solid #6366f1' : undefined }}
                      >
                        <div className={styles.cardHeader}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {isPending && (
                              <input
                                type="checkbox"
                                className={styles.checkbox}
                                checked={isSelected}
                                onClick={(e) => e.stopPropagation()}
                                onChange={() => toggleSelect(item.id)}
                              />
                            )}
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
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
                            <div style={{ marginTop: '4px' }}>{renderTypeBadge(item)}</div>
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
                                  💬 Reason: &ldquo;{parsed.staffReason}&rdquo;
                                </div>
                              ) : (
                                <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                                  No custom justification entered by staff.
                                </div>
                              )}
                              {parsed.securityFailures.length > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#fb7185', textTransform: 'uppercase' }}>
                                    Failures:
                                  </span>
                                  {parsed.securityFailures.map((f, i) => (
                                    <span
                                      key={i}
                                      style={{
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        color: '#f87171',
                                        background: 'rgba(239, 68, 68, 0.15)',
                                        border: '1px solid rgba(239, 68, 68, 0.3)',
                                        padding: '2px 8px',
                                        borderRadius: '6px',
                                      }}
                                    >
                                      • {f}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        <div className={styles.cardActions} onClick={(e) => e.stopPropagation()}>
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
              <span>Approve</span>
            </button>

            <button
              type="button"
              onClick={openBulkReject}
              disabled={modalActionLoading}
              className="btn btn-danger btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', fontWeight: 600 }}
            >
              <XCircle size={15} />
              <span>Reject</span>
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
          <div className={styles.approveModalCard}>
            <div className={styles.approveModalHeader}>
              <div className={styles.rejectHeaderTitleGroup}>
                <div className={styles.approveIconBadge}>
                  <CheckCircle2 size={22} color="#10b981" />
                </div>
                <div>
                  <h3 className={styles.approveModalTitle}>Confirm Approval</h3>
                  <p className={styles.approveModalSub}>
                    {approveModal.requestIds.length === 1
                      ? `Approving request for ${approveModal.staffName || 'Staff Member'}`
                      : `Approving ${approveModal.requestIds.length} selected requests`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setApproveModal({ isOpen: false, requestIds: [], approveClockIn: true, approveClockOut: true })}
                disabled={modalActionLoading}
                className={styles.modalCloseBtn}
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.approveModalBody}>
              <p className={styles.modalConfirmText}>
                {approveModal.requestIds.length === 1
                  ? `Are you sure you want to approve the attendance correction request for ${approveModal.staffName || 'this staff member'}?`
                  : `Are you sure you want to BULK APPROVE ${approveModal.requestIds.length} selected attendance correction request(s)?`}
              </p>

              {approveModal.item && approveModal.item.requestedClockIn && approveModal.item.requestedClockOut && (
                <div style={{ marginTop: '12px', marginBottom: '14px', padding: '12px 14px', background: 'rgba(99, 102, 241, 0.12)', borderRadius: '10px', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#818cf8', marginBottom: '8px' }}>
                    Select Punches to Approve (Both checked by default):
                  </div>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12.5px', color: '#ffffff', fontWeight: 600 }}>
                      <input
                        type="checkbox"
                        checked={approveModal.approveClockIn}
                        onChange={(e) => setApproveModal((prev) => ({ ...prev, approveClockIn: e.target.checked }))}
                        style={{ width: '15px', height: '15px', accentColor: '#6366f1', cursor: 'pointer' }}
                      />
                      <span>Approve Clock-In ({formatPunchTime(approveModal.item.requestedClockIn)})</span>
                    </label>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12.5px', color: '#ffffff', fontWeight: 600 }}>
                      <input
                        type="checkbox"
                        checked={approveModal.approveClockOut}
                        onChange={(e) => setApproveModal((prev) => ({ ...prev, approveClockOut: e.target.checked }))}
                        style={{ width: '15px', height: '15px', accentColor: '#6366f1', cursor: 'pointer' }}
                      />
                      <span>Approve Clock-Out ({formatPunchTime(approveModal.item.requestedClockOut)})</span>
                    </label>
                  </div>
                </div>
              )}

              <div className={styles.approveModalFooter}>
                <button
                  type="button"
                  onClick={() => setApproveModal({ isOpen: false, requestIds: [], approveClockIn: true, approveClockOut: true })}
                  disabled={modalActionLoading}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '9px 16px', borderRadius: '10px', fontSize: '13px' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmApproval}
                  disabled={modalActionLoading}
                  className={styles.approveConfirmBtn}
                >
                  {modalActionLoading ? (
                    <Loader2 size={16} className="animate-spin" />
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
          <div className={styles.rejectModalCard}>
            <div className={styles.rejectModalHeader}>
              <div className={styles.rejectHeaderTitleGroup}>
                <div className={styles.rejectIconBadge}>
                  <XCircle size={22} color="#f43f5e" />
                </div>
                <div>
                  <h3 className={styles.rejectModalTitle}>Confirm Rejection</h3>
                  <p className={styles.rejectModalSub}>
                    {rejectModal.requestIds.length === 1
                      ? `Rejecting request for ${rejectModal.staffName || 'Staff Member'}`
                      : `Rejecting ${rejectModal.requestIds.length} selected requests`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeRejectModal}
                disabled={modalActionLoading}
                className={styles.modalCloseBtn}
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.rejectModalBody}>
              <label className={styles.rejectLabel}>
                Reason for Rejection <span style={{ color: '#f43f5e' }}>*</span>
              </label>

              {/* Quick Reason Presets */}
              <div className={styles.presetContainer}>
                <span className={styles.presetHeading}>Quick Reasons:</span>
                <div className={styles.presetBadges}>
                  {REJECTION_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className={styles.presetBadge}
                      onClick={() => {
                        if (!rejectModal.reason) {
                          setRejectModal({ ...rejectModal, reason: preset });
                        } else if (!rejectModal.reason.includes(preset)) {
                          setRejectModal({ ...rejectModal, reason: `${rejectModal.reason}; ${preset}` });
                        }
                      }}
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ position: 'relative' }}>
                <textarea
                  rows={3}
                  value={rejectModal.reason}
                  onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })}
                  placeholder="Type rejection reason or tap quick reasons above..."
                  className={styles.rejectTextarea}
                  style={{
                    borderColor: isRejectButtonEnabled
                      ? 'rgba(16, 185, 129, 0.5)'
                      : rejectModal.reason.length > 0
                      ? 'rgba(245, 158, 11, 0.5)'
                      : 'rgba(239, 68, 68, 0.3)',
                  }}
                />
              </div>

              {rejectModal.item && rejectModal.item.requestedClockIn && rejectModal.item.requestedClockOut && (
                <div style={{ marginTop: '12px', marginBottom: '14px', padding: '12px 14px', background: 'rgba(244, 63, 94, 0.12)', borderRadius: '10px', border: '1px solid rgba(244, 63, 94, 0.3)' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#f43f5e', marginBottom: '8px' }}>
                    Select Punches to Reject (Both checked by default):
                  </div>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12.5px', color: '#ffffff', fontWeight: 600 }}>
                      <input
                        type="checkbox"
                        checked={rejectModal.rejectClockIn}
                        onChange={(e) => setRejectModal((prev) => ({ ...prev, rejectClockIn: e.target.checked }))}
                        style={{ width: '15px', height: '15px', accentColor: '#f43f5e', cursor: 'pointer' }}
                      />
                      <span>Reject Clock-In ({formatPunchTime(rejectModal.item.requestedClockIn)})</span>
                    </label>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12.5px', color: '#ffffff', fontWeight: 600 }}>
                      <input
                        type="checkbox"
                        checked={rejectModal.rejectClockOut}
                        onChange={(e) => setRejectModal((prev) => ({ ...prev, rejectClockOut: e.target.checked }))}
                        style={{ width: '15px', height: '15px', accentColor: '#f43f5e', cursor: 'pointer' }}
                      />
                      <span>Reject Clock-Out ({formatPunchTime(rejectModal.item.requestedClockOut)})</span>
                    </label>
                  </div>
                </div>
              )}

              <div className={styles.validationRow}>
                <div>
                  {rejectModal.reason.trim().length === 0 ? (
                    <span className={styles.valStatusReq}>⚠️ Rejection reason is required</span>
                  ) : rejectModal.reason.trim().length === 1 ? (
                    <span className={styles.valStatusWarn}>⚠️ Minimum 2 letters required (1/2)</span>
                  ) : (
                    <span className={styles.valStatusValid}>✓ Valid rejection reason</span>
                  )}
                </div>
                <span className={styles.charCount}>
                  {rejectModal.reason.trim().length} chars
                </span>
              </div>

              <div className={styles.rejectModalFooter}>
                <button
                  type="button"
                  onClick={closeRejectModal}
                  disabled={modalActionLoading}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '9px 16px', borderRadius: '10px', fontSize: '13px' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmRejection}
                  disabled={!isRejectButtonEnabled || modalActionLoading}
                  className={styles.rejectConfirmBtn}
                  style={{
                    opacity: !isRejectButtonEnabled || modalActionLoading ? 0.5 : 1,
                    cursor: !isRejectButtonEnabled || modalActionLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {modalActionLoading ? (
                    <Loader2 size={16} className="animate-spin" />
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
