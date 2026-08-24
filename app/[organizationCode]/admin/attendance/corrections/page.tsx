'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Calendar,
  Filter,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  FileText,
  Loader2,
} from 'lucide-react';
import { OrgAdminSidebar } from '@/components/layout/org-admin-sidebar';
import { OrgAdminMobileNav } from '@/components/layout/org-admin-mobile-nav';
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
  const toast = useToast();

  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
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
        toast.success(`Correction request ${action}d.`);
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

  return (
    <div className={styles.pageContainer}>
      <OrgAdminSidebar
        organizationCode={organizationCode}
        organizationName={orgData?.name || 'ShiftGuard'}
        logoUrl={orgData?.logoUrl}
      />

      <div className={styles.mainContent}>
        {/* Header */}
        <header className={styles.header}>
          <div>
            <h1 className="text-xl font-bold text-white m-0">Attendance Correction Requests</h1>
            <p className="text-xs text-slate-400 m-0 mt-1">
              Review staff-reported punch issues and approve time adjustments.
            </p>
          </div>

          <button onClick={fetchCorrections} className="btn btn-secondary btn-sm">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </header>

        {/* Filter Bar */}
        <div className={styles.filterBar}>
          <div style={{ display: 'flex', gap: '6px' }}>
            {['PENDING', 'APPROVED', 'REJECTED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`btn btn-sm ${statusFilter === st ? 'btn-primary' : 'btn-secondary'}`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className={styles.tableCard}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <Loader2 size={32} className="animate-spin" style={{ color: '#818cf8', margin: '0 auto 12px auto' }} />
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading corrections...</p>
            </div>
          ) : requests.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <ShieldCheck size={36} color="var(--text-muted)" style={{ margin: '0 auto 12px auto' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', margin: '0 0 4px 0' }}>
                No correction requests found
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                No requests match the selected status.
              </p>
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Staff Member</th>
                  <th className={styles.th}>Affected Date</th>
                  <th className={styles.th}>Problem Type</th>
                  <th className={styles.th}>Requested Punch</th>
                  <th className={styles.th}>Reason</th>
                  <th className={styles.th}>Status / Action</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((item) => (
                  <tr key={item.id}>
                    <td className={styles.td}>
                      <div style={{ fontWeight: 700, color: '#ffffff' }}>{item.staff.name}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#818cf8' }}>
                        ID: {item.staff.staffId}
                      </div>
                    </td>
                    <td className={styles.td} style={{ fontWeight: 600, color: '#ffffff' }}>
                      {item.date}
                    </td>
                    <td className={styles.td}>
                      <span className="badge badge-warning">{item.type}</span>
                    </td>
                    <td className={styles.td} style={{ fontSize: '12.5px', fontFamily: 'var(--font-mono)' }}>
                      In: <span style={{ color: '#34d399' }}>{item.requestedClockIn || '—'}</span> &bull; Out:{' '}
                      <span style={{ color: '#fbbf24' }}>{item.requestedClockOut || '—'}</span>
                    </td>
                    <td className={styles.td} style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                      &ldquo;{item.reason}&rdquo;
                    </td>
                    <td className={styles.td}>
                      {item.status === 'PENDING' ? (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={() => handleAction(item.id, 'approve')}
                            disabled={processingId === item.id}
                            className="btn btn-success btn-sm"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleAction(item.id, 'reject')}
                            disabled={processingId === item.id}
                            className="btn btn-danger btn-sm"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className={`badge ${item.status === 'APPROVED' ? 'badge-success' : 'badge-danger'}`}>
                          {item.status}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <OrgAdminMobileNav organizationCode={organizationCode} />
    </div>
  );
}
