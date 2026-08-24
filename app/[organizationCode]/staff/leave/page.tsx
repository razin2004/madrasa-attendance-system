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

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h2>My Leave &amp; Absences</h2>
          <p>View entitlements, apply for leave, and check approval status</p>
        </div>

        <Link href={`/${orgCode}/staff/leave/new`} className="btn btn-primary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <FilePlus size={15} />
          <span>+ Apply for Leave</span>
        </Link>
      </div>

      {/* Entitlement Balances Grid */}
      <div className={styles.balanceGrid}>
        <div className={styles.balanceCard}>
          <span className={styles.balanceVal}>{balances?.annualRemaining ?? 14}</span>
          <span className={styles.balanceLabel}>Annual Leave Remaining</span>
        </div>
        <div className={styles.balanceCard}>
          <span className={styles.balanceVal} style={{ color: '#34d399' }}>
            {balances?.sickRemaining ?? 10}
          </span>
          <span className={styles.balanceLabel}>Sick Leave Remaining</span>
        </div>
        <div className={styles.balanceCard}>
          <span className={styles.balanceVal} style={{ color: '#fbbf24' }}>
            {balances?.casualRemaining ?? 5}
          </span>
          <span className={styles.balanceLabel}>Casual Leave Remaining</span>
        </div>
        <div className={styles.balanceCard}>
          <span className={styles.balanceVal} style={{ color: '#c084fc' }}>
            {balances?.dutyRemaining ?? 3}
          </span>
          <span className={styles.balanceLabel}>Duty Leave Remaining</span>
        </div>
      </div>

      {/* Request History */}
      {loading ? (
        <div className="glass-card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <Loader2 size={32} className="animate-spin" style={{ color: '#818cf8', margin: '0 auto 12px auto' }} />
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Loading leave requests...</p>
        </div>
      ) : leaveRequests.length === 0 ? (
        <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          No leave requests submitted yet.
        </div>
      ) : (
        <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'rgba(255,255,255,0.03)', textAlign: 'left' }}>
                <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '11.5px', textTransform: 'uppercase' }}>Leave Type</th>
                <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '11.5px', textTransform: 'uppercase' }}>Date Range</th>
                <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '11.5px', textTransform: 'uppercase' }}>Duration</th>
                <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '11.5px', textTransform: 'uppercase' }}>Status</th>
                <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '11.5px', textTransform: 'uppercase' }}>Submitted</th>
                <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '11.5px', textTransform: 'uppercase' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {leaveRequests.map((req) => (
                <tr key={req.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '14px 16px', fontWeight: 700, color: '#ffffff' }}>{req.leaveType}</td>
                  <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>
                    {new Date(req.startDate).toLocaleDateString()} – {new Date(req.endDate).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '14px 16px', fontWeight: 700, color: '#818cf8' }}>{req.daysCount} days</td>
                  <td style={{ padding: '14px 16px' }}>
                    <span className={`badge ${req.status === 'APPROVED' ? 'badge-success' : req.status === 'REJECTED' ? 'badge-danger' : 'badge-warning'}`}>
                      {req.status}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                    {new Date(req.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    {req.status === 'PENDING' && (
                      <button onClick={() => setCancelRequestId(req.id)} className="btn btn-secondary btn-sm" style={{ color: '#f87171' }}>
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
