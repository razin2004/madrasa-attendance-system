'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  ArrowLeft,
  FilePlus,
  Loader2,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { useToast } from '@/components/feedback/toast-provider';
import styles from './NewLeave.module.css';

export default function StaffApplyLeavePage() {
  const params = useParams();
  const orgCode = (params.organizationCode as string)?.toUpperCase() || '';
  const router = useRouter();
  const toast = useToast();

  const [type, setType] = useState<'ANNUAL' | 'SICK' | 'OTHER' | 'DUTY'>('ANNUAL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Auto-calculate duration days
  const calculateDays = (): number => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) return 0;
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const daysCount = calculateDays();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate || !reason.trim()) {
      toast.error('Please complete all required fields including dates and reason.');
      return;
    }
    if (daysCount <= 0) {
      toast.error('End date cannot be earlier than start date.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/org/${orgCode}/leave/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          startDate,
          endDate,
          reason,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Leave request submitted successfully!');
        router.push(`/${orgCode}/staff/leave`);
      } else {
        toast.error(data.error || 'Failed to submit leave request.');
      }
    } catch {
      toast.error('Network error submitting leave.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div style={{ marginBottom: '24px' }}>
        <Link
          href={`/${orgCode}/staff/leave`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '13px', textDecoration: 'none', marginBottom: '12px' }}
        >
          <ArrowLeft size={16} />
          <span>Back to My Leave</span>
        </Link>

        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
          Apply for Leave
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
          Submit a new leave application for admin review &amp; staffing coverage assessment.
        </p>
      </div>

      <div className="glass-card" style={{ maxWidth: '640px', padding: '28px' }}>
        <form onSubmit={handleSubmit}>
          {/* Section 1: Leave Type Cards */}
          <div style={{ marginBottom: '24px' }}>
            <label className="form-label" style={{ marginBottom: '10px', display: 'block' }}>Select Leave Type *</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              {[
                { type: 'ANNUAL', name: 'Annual Leave', desc: 'Planned vacation or time away from work' },
                { type: 'SICK', name: 'Sick Leave', desc: 'Medical absence due to illness or injury' },
                { type: 'OTHER', name: 'Casual / Other Leave', desc: 'Short-notice personal time off' },
                { type: 'DUTY', name: 'Duty Leave', desc: 'Official company business or external training' },
              ].map((lt) => (
                <div
                  key={lt.type}
                  onClick={() => setType(lt.type as any)}
                  style={{
                    padding: '14px',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${type === lt.type ? '#818cf8' : 'var(--border-subtle)'}`,
                    backgroundColor: type === lt.type ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ fontSize: '14px', fontWeight: 700, color: type === lt.type ? '#ffffff' : 'var(--text-secondary)' }}>
                    {lt.name}
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {lt.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Date Range */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div className="form-group">
              <label className="form-label">Start Date *</label>
              <input
                type="date"
                className="form-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">End Date *</label>
              <input
                type="date"
                className="form-input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {daysCount > 0 && (
            <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)', color: '#818cf8', fontSize: '13px', fontWeight: 700, marginBottom: '20px' }}>
              Calculated Duration: {daysCount} Days
            </div>
          )}

          {/* Section 3: Reason */}
          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="form-label">Reason for Leave *</label>
            <textarea
              className="form-input"
              style={{ height: '90px' }}
              placeholder="Provide context or explanation for your leave request..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <Link href={`/${orgCode}/staff/leave`} className="btn btn-secondary">
              Cancel
            </Link>
            <button type="submit" disabled={submitting} className="btn btn-primary">
              {submitting ? 'Submitting...' : 'Submit Leave Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
