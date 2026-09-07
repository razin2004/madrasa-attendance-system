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

  const filteredRequests = leaveRequests.filter((r) => {
    const matchesStatus = statusFilter === 'ALL' ? true : r.status === statusFilter;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return matchesStatus;
    const matchesQuery =
      (r.reason && r.reason.toLowerCase().includes(q)) ||
      (r.type && r.type.toLowerCase().includes(q)) ||
      (formatLeaveType(r.type || r.leaveType).toLowerCase().includes(q)) ||
      (r.startDate && r.startDate.toLowerCase().includes(q)) ||
      (r.endDate && r.endDate.toLowerCase().includes(q));
    return matchesStatus && matchesQuery;
  });

  return (
    <div className={styles.container}>
      {/* Top Header */}
      <div className={styles.headerBar}>
        <div>
          <Link
            href={`/${orgCode}/staff`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '13px', textDecoration: 'none', marginBottom: '8px' }}
          >
            <ArrowLeft size={16} />
            <span>Back to Dashboard</span>
          </Link>

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

      {/* Search & Filter Header Bar (Org Admin Pattern) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              type="text"
              placeholder="Search by leave type, reason, or date..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 36px 9px 36px',
                borderRadius: '10px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#ffffff',
                fontSize: '13px',
                outline: 'none',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '10px',
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
          </div>

          <button
            type="button"
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 14px', borderRadius: '10px' }}
          >
            <Filter size={15} />
            <span>Filter</span>
            {statusFilter !== 'ALL' && (
              <span style={{ backgroundColor: '#818cf8', color: '#ffffff', fontSize: '10px', fontWeight: 800, padding: '1px 6px', borderRadius: '10px' }}>
                1
              </span>
            )}
          </button>
        </div>

        {/* Filter Tabs Row */}
        <div style={{ display: showMobileFilters ? 'flex' : undefined, flexWrap: 'wrap', gap: '6px' }} className={showMobileFilters ? '' : styles.filterBar}>
          {['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].map((st) => (
            <button
              key={st}
              onClick={() => {
                setStatusFilter(st);
                setShowMobileFilters(false);
              }}
              className={`btn btn-sm ${statusFilter === st ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600 }}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

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
