'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  ArrowLeft,
  FilePlus,
  Loader2,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Plus,
} from 'lucide-react';
import { useToast } from '@/components/feedback/toast-provider';
import styles from './CorrectionHistory.module.css';

export default function StaffCorrectionHistoryPage() {
  const params = useParams();
  const orgCode = (params.organizationCode as string)?.toUpperCase() || '';
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [corrections, setCorrections] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  useEffect(() => {
    fetch(`/api/org/${orgCode}/attendance/corrections`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setCorrections(data.requests || []);
        else toast.error(data.error || 'Failed to load correction history.');
      })
      .catch(() => toast.error('Network error loading history.'))
      .finally(() => setLoading(false));
  }, [orgCode, toast]);

  const formatTimeStr = (isoStr?: string | null) => {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoStr;
    }
  };

  const formatDateStr = (isoStr?: string | null) => {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      return d.toLocaleDateString(undefined, { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return isoStr;
    }
  };

  const formatCorrectionType = (t: string) => {
    if (!t) return 'Correction';
    return t.replace(/_/g, ' ');
  };

  const pendingCount = corrections.filter((c) => c.status === 'PENDING').length;
  const approvedCount = corrections.filter((c) => c.status === 'APPROVED').length;
  const rejectedCount = corrections.filter((c) => c.status === 'REJECTED').length;

  const filteredCorrections = corrections.filter((c) =>
    statusFilter === 'ALL' ? true : c.status === statusFilter
  );

  return (
    <div className={styles.container}>
      {/* Top Bar */}
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
            My Attendance Correction Requests
          </h1>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0 0' }}>
            View submitted punch adjustments, missed clock-in issues, and approval status
          </p>
        </div>

        <Link
          href={`/${orgCode}/staff/attendance/correction`}
          className={`btn btn-primary btn-sm ${styles.desktopOnlyAction}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 16px', borderRadius: '10px' }}
        >
          <Plus size={16} />
          <span>Submit New Correction</span>
        </Link>
      </div>

      {/* Metric Overview Grid */}
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard} style={{ borderLeft: '3px solid #fbbf24' }}>
          <div className={styles.metricLabel}>Pending Review</div>
          <div className={styles.metricValue} style={{ color: '#fbbf24' }}>{pendingCount}</div>
        </div>
        <div className={styles.metricCard} style={{ borderLeft: '3px solid #34d399' }}>
          <div className={styles.metricLabel}>Approved Requests</div>
          <div className={styles.metricValue} style={{ color: '#34d399' }}>{approvedCount}</div>
        </div>
        <div className={styles.metricCard} style={{ borderLeft: '3px solid #f87171' }}>
          <div className={styles.metricLabel}>Rejected Requests</div>
          <div className={styles.metricValue} style={{ color: '#f87171' }}>{rejectedCount}</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className={styles.filterBar}>
        {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`btn btn-sm ${statusFilter === st ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600 }}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="glass-card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <Loader2 size={32} className="animate-spin" style={{ color: '#818cf8', margin: '0 auto 12px auto' }} />
          <p style={{ fontSize: '14px', color: '#94a3b8' }}>Loading correction requests...</p>
        </div>
      ) : filteredCorrections.length === 0 ? (
        <div className="glass-card" style={{ padding: '48px 24px', textAlign: 'center', color: '#94a3b8' }}>
          <Clock size={36} color="var(--text-muted)" style={{ margin: '0 auto 12px auto' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', margin: '0 0 4px 0' }}>
            No correction requests found
          </h3>
          <p style={{ fontSize: '13px', margin: 0 }}>No requests match the selected status filter.</p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className={styles.tableCard}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Affected Date</th>
                  <th>Correction Type</th>
                  <th>Requested Punch</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Submitted Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredCorrections.map((item) => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 700, color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
                      {formatDateStr(item.date)}
                    </td>
                    <td>
                      <span className="badge badge-warning">{formatCorrectionType(item.type)}</span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12.5px' }}>
                      In: <span style={{ color: '#34d399', fontWeight: 700 }}>{formatTimeStr(item.requestedClockIn)}</span> &bull; Out:{' '}
                      <span style={{ color: '#fbbf24', fontWeight: 700 }}>{formatTimeStr(item.requestedClockOut)}</span>
                    </td>
                    <td style={{ color: '#94a3b8', fontStyle: 'italic', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      &ldquo;{item.reason}&rdquo;
                    </td>
                    <td>
                      <span className={`badge ${item.status === 'APPROVED' ? 'badge-success' : item.status === 'REJECTED' ? 'badge-danger' : 'badge-warning'}`}>
                        {item.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '12.5px', color: '#94a3b8' }}>
                      {new Date(item.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View */}
          <div className={styles.mobileCards}>
            {filteredCorrections.map((item) => (
              <div key={item.id} className={styles.cardItem}>
                <div className={styles.cardHeaderRow}>
                  <div className={styles.dateBadgeGroup}>
                    <Calendar size={14} color="#818cf8" />
                    <span className={styles.cardDateVal}>
                      {formatDateStr(item.date)}
                    </span>
                  </div>
                  <span className={`badge ${item.status === 'APPROVED' ? 'badge-success' : item.status === 'REJECTED' ? 'badge-danger' : 'badge-warning'}`}>
                    {item.status === 'APPROVED' && <CheckCircle2 size={11} style={{ marginRight: '3px', verticalAlign: 'middle' }} />}
                    {item.status === 'REJECTED' && <XCircle size={11} style={{ marginRight: '3px', verticalAlign: 'middle' }} />}
                    {item.status === 'PENDING' && <Clock size={11} style={{ marginRight: '3px', verticalAlign: 'middle' }} />}
                    {item.status}
                  </span>
                </div>

                <div className={styles.cardCategoryRow}>
                  <span className={styles.typeBadge}>{formatCorrectionType(item.type)}</span>
                  <span className={styles.submittedDate}>
                    Submitted: {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div className={styles.punchBoxesGrid}>
                  <div className={styles.punchCellIn}>
                    <span className={styles.punchCellLabel}>Req. Clock In</span>
                    <span className={styles.punchCellTime}>{formatTimeStr(item.requestedClockIn)}</span>
                  </div>
                  <div className={styles.punchCellOut}>
                    <span className={styles.punchCellLabel}>Req. Clock Out</span>
                    <span className={styles.punchCellTime}>{formatTimeStr(item.requestedClockOut)}</span>
                  </div>
                </div>

                <div className={styles.reasonQuoteBox}>
                  <span className={styles.reasonQuoteText}>&ldquo;{item.reason}&rdquo;</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
