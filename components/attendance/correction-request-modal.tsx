'use client';

import React, { useState } from 'react';
import { FilePlus, X, Calendar, Clock, AlertCircle, FileText, Send, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/components/feedback/toast-provider';

interface CorrectionRequestModalProps {
  organizationCode: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CorrectionRequestModal({
  organizationCode,
  isOpen,
  onClose,
  onSuccess,
}: CorrectionRequestModalProps) {
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);

  const [type, setType] = useState<'MISSING_CLOCK_IN' | 'MISSING_CLOCK_OUT' | 'INCORRECT_TIME' | 'OTHER'>('MISSING_CLOCK_IN');
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [clockInTime, setClockInTime] = useState<string>('09:00');
  const [clockOutTime, setClockOutTime] = useState<string>('17:00');
  const [reason, setReason] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error('Please provide a reason/explanation for this correction request.');
      return;
    }

    setSubmitting(true);
    try {
      // Build ISO strings for requested clock in / out
      let requestedClockInIso: string | undefined = undefined;
      let requestedClockOutIso: string | undefined = undefined;

      if ((type === 'MISSING_CLOCK_IN' || type === 'INCORRECT_TIME') && clockInTime) {
        requestedClockInIso = new Date(`${date}T${clockInTime}:00`).toISOString();
      }
      if ((type === 'MISSING_CLOCK_OUT' || type === 'INCORRECT_TIME') && clockOutTime) {
        requestedClockOutIso = new Date(`${date}T${clockOutTime}:00`).toISOString();
      }

      const res = await fetch(`/api/org/${organizationCode}/attendance/correction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          date,
          requestedClockIn: requestedClockInIso,
          requestedClockOut: requestedClockOutIso,
          reason: reason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit correction request.');
      }

      toast.success('Attendance correction request submitted to Admin for approval!');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Error submitting request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '520px',
          backgroundColor: '#0f172a',
          border: '1px solid var(--border-subtle)',
          borderRadius: '16px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FilePlus size={22} color="#818cf8" />
            <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#ffffff', margin: 0 }}>
              Request Attendance Correction
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          {/* Issue Type */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Correction Type *
            </label>
            <select
              value={type}
              onChange={(e: any) => setType(e.target.value)}
              className="form-control"
              style={{ width: '100%', backgroundColor: 'rgba(15, 23, 42, 0.8)', color: '#ffffff' }}
            >
              <option value="MISSING_CLOCK_IN">Forgot Clock In</option>
              <option value="MISSING_CLOCK_OUT">Forgot Clock Out</option>
              <option value="INCORRECT_TIME">Adjust Wrong Punch Time</option>
              <option value="OTHER">Other Punch Discrepancy</option>
            </select>
          </div>

          {/* Date Picker */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Target Punch Date *
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="form-control"
              style={{ width: '100%', backgroundColor: 'rgba(15, 23, 42, 0.8)', color: '#ffffff' }}
              required
            />
          </div>

          {/* Clock In / Out Inputs */}
          {(type === 'MISSING_CLOCK_IN' || type === 'INCORRECT_TIME') && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Actual Clock In Time *
              </label>
              <input
                type="time"
                value={clockInTime}
                onChange={(e) => setClockInTime(e.target.value)}
                className="form-control"
                style={{ width: '100%', backgroundColor: 'rgba(15, 23, 42, 0.8)', color: '#ffffff' }}
                required
              />
            </div>
          )}

          {(type === 'MISSING_CLOCK_OUT' || type === 'INCORRECT_TIME') && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Actual Clock Out Time *
              </label>
              <input
                type="time"
                value={clockOutTime}
                onChange={(e) => setClockOutTime(e.target.value)}
                className="form-control"
                style={{ width: '100%', backgroundColor: 'rgba(15, 23, 42, 0.8)', color: '#ffffff' }}
                required
              />
            </div>
          )}

          {/* Reason Justification */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Reason / Justification *
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Device battery died at shift start, or network connection was down..."
              className="form-control"
              style={{ width: '100%', backgroundColor: 'rgba(15, 23, 42, 0.8)', color: '#ffffff', resize: 'none' }}
              required
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', paddingTop: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {submitting ? 'Submitting...' : 'Submit Request'}
              <Send size={15} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
