'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FilePlus,
  RefreshCw,
  Loader2,
  Trash2,
  ArrowLeft,
  Plus,
  Search,
  X,
  Filter,
} from 'lucide-react';
import { useToast } from '@/components/feedback/toast-provider';
import { ConfirmationModal } from '@/components/feedback/confirmation-modal';
import styles from './StaffLeave.module.css';

export default function StaffLeaveDashboardPage() {
  const params = useParams();
  const orgCode = (params.organizationCode as string)?.toUpperCase() || '';
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [balances, setBalances] = useState<any>(null);
  const [cancelRequestId, setCancelRequestId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showMobileFilters, setShowMobileFilters] = useState<boolean>(false);

  const fetchLeaveData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/org/${orgCode}/leave/staff`);
      const data = await res.json();
      if (res.ok && data.success) {
        setLeaveRequests(data.requests || []);
        if (data.balances) setBalances(data.balances);
      } else {
        toast.error(data.error || 'Failed to load leave history.');
      }
    } catch {
      toast.error('Network error fetching leave data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaveData();
  }, [orgCode]);

  const handleCancel = async () => {
    if (!cancelRequestId) return;
    try {
      const res = await fetch(`/api/org/${orgCode}/leave/staff/${cancelRequestId}/cancel`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Leave request cancelled.');
        setCancelRequestId(null);
        fetchLeaveData();
      } else {
        toast.error(data.error || 'Failed to cancel request.');
      }
    } catch {
      toast.error('Network error cancelling request.');
    }
  };

  const getBalanceInfo = (type: string) => {
    if (!Array.isArray(balances)) return { remaining: 0, entitlement: 0, used: 0 };
    const found = balances.find((b: any) => b.leaveType === type);
    return found
      ? { remaining: found.remaining ?? 0, entitlement: found.entitlement ?? 0, used: found.used ?? 0 }
      : { remaining: 0, entitlement: 0, used: 0 };
  };

  const annual = getBalanceInfo('ANNUAL');
  const sick = getBalanceInfo('SICK');
  const other = getBalanceInfo('OTHER');
  const duty = getBalanceInfo('DUTY');

  const formatLeaveType = (typeStr: string) => {
    if (!typeStr) return 'Leave';
    switch (typeStr.toUpperCase()) {
      case 'ANNUAL':
        return 'Annual Leave';
      case 'SICK':
        return 'Sick Leave';
      case 'DUTY':
        return 'Duty Leave';
      case 'OTHER':
        return 'Casual / Other Leave';
      default:
        return typeStr;
    }
  };

  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  const filteredRequests = leaveRequests.filter((r) => {
    const matchesStatus = statusFilter === 'ALL' ? true : r.status === statusFilter;
    const matchesCategory = categoryFilter === 'ALL' ? true : (r.type || r.leaveType) === categoryFilter;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return matchesStatus && matchesCategory;
    const matchesQuery =
      (r.reason && r.reason.toLowerCase().includes(q)) ||
      (r.type && r.type.toLowerCase().includes(q)) ||
      (formatLeaveType(r.type || r.leaveType).toLowerCase().includes(q)) ||
      (r.startDate && r.startDate.toLowerCase().includes(q)) ||
      (r.endDate && r.endDate.toLowerCase().includes(q));
    return matchesStatus && matchesCategory && matchesQuery;
  });

  const isFilterActive = statusFilter !== 'ALL' || categoryFilter !== 'ALL';

  return (
    <div className={styles.container}>
      {/* Top Header */}
      <div className={styles.headerBar}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
            My Leave &amp; Absences
          </h1>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0 0' }}>
            View leave balances, submit absence requests, and check approval status
          </p>
        </div>

        <Link
          href={`/${orgCode}/staff/leave/new`}
          className={`btn btn-primary btn-sm ${styles.desktopOnlyAction}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 16px', borderRadius: '10px' }}
        >
          <Plus size={16} />
          <span>Apply for Leave</span>
        </Link>
      </div>

      {/* Entitlement Balances Grid */}
      <div className={styles.balanceGrid}>
        <div className={styles.balanceCard} style={{ borderLeft: '3px solid #818cf8' }}>
          <div>
            <div className={styles.balanceVal}>{annual.remaining}</div>
            <div className={styles.balanceLabel}>Annual Leave Remaining</div>
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>Used: {annual.used} / {annual.entitlement} days</div>
        </div>

        <div className={styles.balanceCard} style={{ borderLeft: '3px solid #34d399' }}>
          <div>
            <div className={styles.balanceVal} style={{ color: '#34d399' }}>{sick.remaining}</div>
            <div className={styles.balanceLabel}>Sick Leave Remaining</div>
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>Used: {sick.used} / {sick.entitlement} days</div>
        </div>

        <div className={styles.balanceCard} style={{ borderLeft: '3px solid #fbbf24' }}>
          <div>
            <div className={styles.balanceVal} style={{ color: '#fbbf24' }}>{other.remaining}</div>
            <div className={styles.balanceLabel}>Casual / Other Remaining</div>
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>Used: {other.used} days</div>
        </div>

        <div className={styles.balanceCard} style={{ borderLeft: '3px solid #c084fc' }}>
          <div>
            <div className={styles.balanceVal} style={{ color: '#c084fc' }}>{duty.remaining}</div>
            <div className={styles.balanceLabel}>Duty Leave Remaining</div>
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>Used: {duty.used} days</div>
        </div>
      </div>

      {/* Search Field with Pinned Filter Icon (Org Admin Style) */}
      <div style={{ marginBottom: '16px', width: '100%' }}>
        <div style={{ position: 'relative', width: '100%' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="Search by leave type, reason, or date..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 40px 9px 36px',
              borderRadius: '10px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#ffffff',
              fontSize: '13px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '42px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className={styles.filterToggleBtn}
            style={{
              position: 'absolute',
              right: '6px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              backgroundColor: isFilterActive ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.06)',
              border: isFilterActive ? '1px solid rgba(99, 102, 241, 0.5)' : '1px solid rgba(255, 255, 255, 0.12)',
              color: isFilterActive ? '#818cf8' : '#ffffff',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            title="Toggle Filters"
          >
            <Filter size={15} color={isFilterActive ? '#818cf8' : 'currentColor'} />
          </button>
        </div>

        {/* Desktop Inline Filters */}
        <div className={styles.desktopFilterGroup}>
          {/* Status Tabs */}
          <div style={{ display: 'flex', gap: '4px', backgroundColor: 'rgba(255, 255, 255, 0.04)', padding: '3px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`btn btn-sm ${statusFilter === st ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Category Dropdown */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{
              height: '36px',
              padding: '0 10px',
              borderRadius: '8px',
              backgroundColor: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#ffffff',
              fontSize: '12.5px',
              outline: 'none',
            }}
          >
            <option value="ALL">All Categories</option>
            <option value="ANNUAL">Annual Leave</option>
            <option value="SICK">Sick Leave</option>
            <option value="DUTY">Duty Leave</option>
            <option value="OTHER">Casual / Other</option>
          </select>
        </div>
      </div>

      {/* Filter Bottom Sheet Modal Overlay (Org Admin Style) */}
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
              border: '1px solid var(--border-medium, rgba(255, 255, 255, 0.15))',
              borderBottom: 'none',
              padding: '20px',
              boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              boxSizing: 'border-box',
              maxHeight: '85vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 800, fontSize: '14px', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Filter size={16} color="#818cf8" />
                <span>Filter Leave Requests</span>
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
                  color: '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Approval Status Filter */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>
                Approval Status
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`btn btn-sm ${statusFilter === st ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600 }}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Leave Type Category Filter */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>
                Leave Category
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {[
                  { id: 'ALL', label: 'All Categories' },
                  { id: 'ANNUAL', label: 'Annual' },
                  { id: 'SICK', label: 'Sick' },
                  { id: 'DUTY', label: 'Duty' },
                  { id: 'OTHER', label: 'Casual / Other' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryFilter(cat.id)}
                    className={`btn btn-sm ${categoryFilter === cat.id ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600 }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Footer */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px', paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
              {isFilterActive ? (
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('ALL');
                    setCategoryFilter('ALL');
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
                style={{ borderRadius: '8px', padding: '8px 18px', fontSize: '12.5px', fontWeight: 700 }}
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="glass-card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <Loader2 size={32} className="animate-spin" style={{ color: '#818cf8', margin: '0 auto 12px auto' }} />
          <p style={{ fontSize: '14px', color: '#94a3b8' }}>Loading leave requests...</p>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="glass-card" style={{ padding: '48px 24px', textAlign: 'center', color: '#94a3b8' }}>
          <Calendar size={36} color="var(--text-muted)" style={{ margin: '0 auto 12px auto' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', margin: '0 0 4px 0' }}>
            No leave requests found
          </h3>
          <p style={{ fontSize: '13px', margin: 0 }}>No requests match the selected status filter.</p>
        </div>
      ) : (
        <>
          {/* Desktop View Table */}
          <div className={styles.tableCard}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Leave Type</th>
                  <th>Date Range</th>
                  <th>Duration</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((req) => (
                  <tr key={req.id}>
                    <td style={{ fontWeight: 700, color: '#ffffff' }}>
                      {formatLeaveType(req.type || req.leaveType)}
                    </td>
                    <td style={{ color: '#94a3b8', fontFamily: 'var(--font-mono)', fontSize: '12.5px' }}>
                      {new Date(req.startDate).toLocaleDateString(undefined, { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })} – {new Date(req.endDate).toLocaleDateString(undefined, { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td style={{ fontWeight: 700, color: '#818cf8', fontFamily: 'var(--font-mono)' }}>
                      {req.daysCount} {req.daysCount === 1 ? 'day' : 'days'}
                    </td>
                    <td style={{ color: '#94a3b8', fontStyle: 'italic', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      &ldquo;{req.reason}&rdquo;
                    </td>
                    <td>
                      <span className={`badge ${req.status === 'APPROVED' ? 'badge-success' : req.status === 'REJECTED' ? 'badge-danger' : req.status === 'CANCELLED' ? 'badge-secondary' : 'badge-warning'}`}>
                        {req.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '12.5px', color: '#94a3b8' }}>
                      {new Date(req.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {req.status === 'PENDING' && (
                        <button
                          onClick={() => setCancelRequestId(req.id)}
                          className="btn btn-secondary btn-sm"
                          style={{ color: '#f87171', padding: '4px 10px', fontSize: '12px' }}
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile View Cards */}
          <div className={styles.mobileCards}>
            {filteredRequests.map((req) => (
              <div key={req.id} className={styles.cardItem}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff' }}>
                    {formatLeaveType(req.type || req.leaveType)}
                  </span>
                  <span className={`badge ${req.status === 'APPROVED' ? 'badge-success' : req.status === 'REJECTED' ? 'badge-danger' : req.status === 'CANCELLED' ? 'badge-secondary' : 'badge-warning'}`}>
                    {req.status}
                  </span>
                </div>

                <div style={{ fontSize: '12.5px', color: '#cbd5e1', marginBottom: '6px', fontFamily: 'var(--font-mono)' }}>
                  {new Date(req.startDate).toLocaleDateString(undefined, { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })} – {new Date(req.endDate).toLocaleDateString(undefined, { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })}
                </div>

                <div style={{ fontSize: '12.5px', color: '#818cf8', fontWeight: 700, marginBottom: '8px' }}>
                  Duration: {req.daysCount} {req.daysCount === 1 ? 'day' : 'days'}
                </div>

                <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', backgroundColor: 'rgba(0,0,0,0.2)', padding: '8px 10px', borderRadius: '6px', marginBottom: '10px' }}>
                  &ldquo;{req.reason}&rdquo;
                </div>

                {req.status === 'PENDING' && (
                  <button
                    onClick={() => setCancelRequestId(req.id)}
                    className="btn btn-secondary btn-sm"
                    style={{ color: '#f87171', width: '100%', fontSize: '12px', padding: '6px 0', marginTop: '4px' }}
                  >
                    Cancel Leave Request
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* CANCEL CONFIRMATION MODAL */}
      <ConfirmationModal
        isOpen={Boolean(cancelRequestId)}
        onClose={() => setCancelRequestId(null)}
        onConfirm={handleCancel}
        title="Cancel Leave Request?"
        message="Are you sure you want to cancel this pending leave request?"
        confirmText="Cancel Request"
        variant="danger"
      />
    </div>
  );
}
