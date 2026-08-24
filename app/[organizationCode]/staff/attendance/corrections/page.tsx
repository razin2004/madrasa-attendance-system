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
} from 'lucide-react';
import { useToast } from '@/components/feedback/toast-provider';
import styles from './CorrectionHistory.module.css';

export default function StaffCorrectionHistoryPage() {
  const params = useParams();
  const orgCode = (params.organizationCode as string)?.toUpperCase() || '';
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [corrections, setCorrections] = useState<any[]>([]);

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

  return (
    <div className={styles.container}>
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <Link
            href={`/${orgCode}/staff/attendance`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '13px', textDecoration: 'none', marginBottom: '12px' }}
          >
            <ArrowLeft size={16} />
            <span>Back to Attendance History</span>
          </Link>

          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
            My Correction Requests
          </h1>
        </div>

        <Link href={`/${orgCode}/staff/attendance/correction`} className="btn btn-primary btn-sm">
          + New Correction
        </Link>
      </div>

      {loading ? (
        <div className="glass-card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <Loader2 size={32} className="animate-spin" style={{ color: '#818cf8', margin: '0 auto 12px auto' }} />
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Loading correction history...</p>
        </div>
      ) : corrections.length === 0 ? (
        <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          No attendance correction requests submitted.
        </div>
      ) : (
        <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'rgba(255,255,255,0.03)', textAlign: 'left' }}>
                <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '11.5px', textTransform: 'uppercase' }}>Affected Date</th>
                <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '11.5px', textTransform: 'uppercase' }}>Problem Type</th>
                <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '11.5px', textTransform: 'uppercase' }}>Requested Punch</th>
                <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '11.5px', textTransform: 'uppercase' }}>Status</th>
                <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '11.5px', textTransform: 'uppercase' }}>Submitted Date</th>
              </tr>
            </thead>
            <tbody>
              {corrections.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '14px 16px', fontWeight: 700, color: '#ffffff' }}>{item.date}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <span className="badge badge-warning">{item.type}</span>
                  </td>
                  <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', fontSize: '12.5px' }}>
                    In: <span style={{ color: '#34d399' }}>{item.requestedClockIn || '—'}</span> &bull; Out:{' '}
                    <span style={{ color: '#fbbf24' }}>{item.requestedClockOut || '—'}</span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span className={`badge ${item.status === 'APPROVED' ? 'badge-success' : item.status === 'REJECTED' ? 'badge-danger' : 'badge-warning'}`}>
                      {item.status}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                    {new Date(item.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
