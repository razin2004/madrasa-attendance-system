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

  const problemTypes = [
    { id: 'MISSING_CLOCK_IN', name: 'Missing Clock In', desc: 'Present but forgot to punch in' },
    { id: 'MISSING_CLOCK_OUT', name: 'Missing Clock Out', desc: 'Punched in but forgot to punch out' },
    { id: 'INCORRECT_CLOCK_IN', name: 'Incorrect Clock In', desc: 'Recorded clock in time was wrong' },
    { id: 'INCORRECT_CLOCK_OUT', name: 'Incorrect Clock Out', desc: 'Recorded clock out time was wrong' },
    { id: 'MANUAL_ENTRY', name: 'Full Day Manual Entry', desc: 'Request full day attendance log' },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.contentWrapper}>
        <div className={styles.header}>
          <Link href={`/${orgCode}/staff/attendance`} className={styles.backLink}>
            <ArrowLeft size={16} />
            <span>Back to Attendance History</span>
          </Link>

          <h1 className={styles.title}>Report Attendance Problem</h1>
          <p className={styles.subtitle}>
            Submit an attendance correction request for missing or incorrect punch times.
          </p>
        </div>

        {/* Notice Info Box */}
        <div className={styles.noticeBox}>
          <AlertTriangle size={18} className={styles.noticeIcon} />
          <p className={styles.noticeText}>
            All correction requests are sent to organization administrators for review. Please provide accurate punch times and a valid reason.
          </p>
        </div>

        <div className={styles.formCard}>
          <form onSubmit={handleSubmit}>
            {/* Affected Date */}
            <div className={styles.formGroup}>
              <label className={styles.label}>
                Affected Attendance Date <span style={{ color: 'var(--danger-text, #f87171)' }}>*</span>
              </label>
              <input
                type="date"
                className={styles.input}
                style={{ colorScheme: 'dark', height: '42px' }}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            {/* Problem Type Selector */}
            <div className={styles.formGroup}>
              <label className={styles.label}>
                Correction Category <span style={{ color: 'var(--danger-text, #f87171)' }}>*</span>
              </label>
              <div className={styles.typeGrid}>
                {problemTypes.map((pt) => {
                  const isSelected = type === pt.id;
                  return (
                    <button
                      type="button"
                      key={pt.id}
                      onClick={() => setType(pt.id)}
                      className={`${styles.typeOption} ${isSelected ? styles.typeOptionSelected : ''}`}
                    >
                      <span className={styles.typeName}>{pt.name}</span>
                      <span className={styles.typeDesc}>{pt.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Times */}
            <div className={styles.timeRow}>
              {requiresClockIn && (
                <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                  <label className={styles.label}>
                    Requested Clock In <span style={{ color: 'var(--danger-text, #f87171)' }}>*</span>
                  </label>
                  <input
                    type="time"
                    className={styles.input}
                    style={{ colorScheme: 'dark', height: '42px' }}
                    value={requestedClockIn}
                    onChange={(e) => setRequestedClockIn(e.target.value)}
                  />
                </div>
              )}

              {requiresClockOut && (
                <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                  <label className={styles.label}>
                    Requested Clock Out <span style={{ color: 'var(--danger-text, #f87171)' }}>*</span>
                  </label>
                  <input
                    type="time"
                    className={styles.input}
                    style={{ colorScheme: 'dark', height: '42px' }}
                    value={requestedClockOut}
                    onChange={(e) => setRequestedClockOut(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Reason */}
            <div className={styles.formGroup} style={{ marginTop: '20px' }}>
              <label className={styles.label}>
                Reason / Detailed Explanation <span style={{ color: 'var(--danger-text, #f87171)' }}>*</span>
              </label>
              <textarea
                className={styles.textarea}
                placeholder="Explain why this attendance correction is needed..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            <div className={styles.actionRow}>
              <Link href={`/${orgCode}/staff/attendance`} className="btn btn-secondary" style={{ flex: 1, textAlign: 'center', justifyContent: 'center' }}>
                Cancel
              </Link>
              <button type="submit" disabled={submitting} className="btn btn-primary" style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <FilePlus size={16} />
                    <span>Submit Correction Request</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

