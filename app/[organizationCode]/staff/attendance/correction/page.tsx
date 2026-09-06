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
} from 'lucide-react';
import { useToast } from '@/components/feedback/toast-provider';
import styles from './AttendanceCorrection.module.css';

export default function StaffAttendanceCorrectionPage() {
  const params = useParams();
  const orgCode = (params.organizationCode as string)?.toUpperCase() || '';
  const router = useRouter();
  const toast = useToast();

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [type, setType] = useState('MISSING_CLOCK_IN');
  const [requestedClockIn, setRequestedClockIn] = useState('08:00');
  const [requestedClockOut, setRequestedClockOut] = useState('17:00');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const requiresClockIn = type === 'MISSING_CLOCK_IN' || type === 'INCORRECT_CLOCK_IN' || type === 'MANUAL_ENTRY';
  const requiresClockOut = type === 'MISSING_CLOCK_OUT' || type === 'INCORRECT_CLOCK_OUT' || type === 'MANUAL_ENTRY';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !type || !reason.trim()) {
      toast.error('Please complete all required fields including date, type, and reason.');
      return;
    }

    setSubmitting(true);
    try {
      let requestedClockInIso: string | null = null;
      let requestedClockOutIso: string | null = null;

      if (requiresClockIn && requestedClockIn) {
        requestedClockInIso = new Date(`${date}T${requestedClockIn}:00`).toISOString();
      }
      if (requiresClockOut && requestedClockOut) {
        requestedClockOutIso = new Date(`${date}T${requestedClockOut}:00`).toISOString();
      }

      const res = await fetch(`/api/org/${orgCode}/attendance/correction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          type,
          requestedClockIn: requestedClockInIso,
          requestedClockOut: requestedClockOutIso,
          reason: reason.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Attendance correction request submitted to Admin.');
        router.push(`/${orgCode}/staff/attendance/corrections`);
      } else {
        toast.error(data.error || 'Failed to submit correction request.');
      }
    } catch {
      toast.error('Network error submitting correction.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div style={{ marginBottom: '24px' }}>
        <Link
          href={`/${orgCode}/staff/attendance`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '13px', textDecoration: 'none', marginBottom: '12px' }}
        >
          <ArrowLeft size={16} />
          <span>Back to Attendance History</span>
        </Link>

        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
          Report an Attendance Problem
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
          Submit an attendance correction request for missing or incorrect punch times.
        </p>
      </div>

      <div className={styles.formCard} style={{ maxWidth: '600px' }}>
        <form onSubmit={handleSubmit}>
          {/* Affected Date */}
          <div className={styles.formGroup}>
            <label className={styles.label}>Affected Attendance Date *</label>
            <input
              type="date"
              className={styles.input}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* Problem Type */}
          <div className={styles.formGroup}>
            <label className={styles.label}>Problem Type *</label>
            <select
              className={styles.input}
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="MISSING_CLOCK_IN">Missing Clock In</option>
              <option value="MISSING_CLOCK_OUT">Missing Clock Out</option>
              <option value="INCORRECT_CLOCK_IN">Incorrect Clock In Time</option>
              <option value="INCORRECT_CLOCK_OUT">Incorrect Clock Out Time</option>
              <option value="MANUAL_ENTRY">Manual Entry Request</option>
            </select>
          </div>

          {/* Times */}
          <div className={styles.timeRow} style={{ marginBottom: '20px' }}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Requested Clock In</label>
              <input
                type="time"
                className={styles.input}
                value={requestedClockIn}
                onChange={(e) => setRequestedClockIn(e.target.value)}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Requested Clock Out</label>
              <input
                type="time"
                className={styles.input}
                value={requestedClockOut}
                onChange={(e) => setRequestedClockOut(e.target.value)}
              />
            </div>
          </div>

          {/* Reason */}
          <div className={styles.formGroup}>
            <label className={styles.label}>Detailed Explanation *</label>
            <textarea
              className={styles.textarea}
              placeholder="Explain why the correction is needed..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', flexWrap: 'wrap' }}>
            <Link href={`/${orgCode}/staff/attendance`} className="btn btn-secondary" style={{ flex: 1, textAlign: 'center' }}>
              Cancel
            </Link>
            <button type="submit" disabled={submitting} className="btn btn-primary" style={{ flex: 1 }}>
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

