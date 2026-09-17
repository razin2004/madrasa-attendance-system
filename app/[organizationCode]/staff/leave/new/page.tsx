'use client';

import React, { useState, useEffect } from 'react';
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
  Lock,
  Layers,
  Info,
} from 'lucide-react';
import { useToast } from '@/components/feedback/toast-provider';
import styles from './NewLeave.module.css';

export default function StaffApplyLeavePage() {
  const params = useParams();
  const orgCode = (params.organizationCode as string)?.toUpperCase() || '';
  const router = useRouter();
  const toast = useToast();

  const [type, setType] = useState<'ANNUAL' | 'SICK' | 'OTHER' | 'DUTY'>('ANNUAL');

  // Application Mode: SINGLE_DATE vs DATE_RANGE
  const [dateMode, setDateMode] = useState<'SINGLE_DATE' | 'DATE_RANGE'>('SINGLE_DATE');
  const [singleDate, setSingleDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Restriction Rules State
  const [rules, setRules] = useState<any[]>([]);
  const [loadingRules, setLoadingRules] = useState(true);

  useEffect(() => {
    fetch(`/api/org/${orgCode}/leave/restrictions`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setRules(data.rules || []);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingRules(false));
  }, [orgCode]);

  // Sync single date to start and end
  const handleSingleDateChange = (val: string) => {
    setSingleDate(val);
    setStartDate(val);
    setEndDate(val);
  };

  // Auto-calculate duration days
  const calculateDays = (): number => {
    const s = dateMode === 'SINGLE_DATE' ? singleDate : startDate;
    const e = dateMode === 'SINGLE_DATE' ? singleDate : endDate;
    if (!s || !e) return 0;
    const start = new Date(`${s}T00:00:00Z`);
    const end = new Date(`${e}T00:00:00Z`);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0;
    const diffTime = end.getTime() - start.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const daysCount = calculateDays();

  // Active Allowed & Blackout Rules for Selected Leave Type
  const relevantBlackouts = rules.filter(
    (r) => r.ruleType === 'BLACKOUT_PERIOD' && (r.leaveType === 'ALL' || r.leaveType === type)
  );
  const relevantAllowed = rules.filter(
    (r) => r.ruleType === 'ALLOWED_WINDOW' && (r.leaveType === 'ALL' || r.leaveType === type)
  );

  // Client-side date check
  const getValidationWarning = (): string | null => {
    const s = dateMode === 'SINGLE_DATE' ? singleDate : startDate;
    const e = dateMode === 'SINGLE_DATE' ? singleDate : endDate;
    if (!s || !e) return null;

    const reqStart = new Date(`${s}T00:00:00Z`);
    const reqEnd = new Date(`${e}T00:00:00Z`);

    // Check Blackouts
    for (const b of relevantBlackouts) {
      const bStart = new Date(b.startDate);
      const bEnd = new Date(b.endDate);
      if (reqStart <= bEnd && reqEnd >= bStart) {
        return `🚨 Selected dates overlap blackout period: "${b.title}" (${new Date(b.startDate).toLocaleDateString()} to ${new Date(b.endDate).toLocaleDateString()}).`;
      }
    }

    // Check Allowed Windows
    if (relevantAllowed.length > 0) {
      const insideAllowed = relevantAllowed.some((a) => {
        const aStart = new Date(a.startDate);
        const aEnd = new Date(a.endDate);
        return reqStart >= aStart && reqEnd <= aEnd;
      });
      if (!insideAllowed) {
        const windows = relevantAllowed
          .map((a) => `"${a.title}" (${new Date(a.startDate).toLocaleDateString()} to ${new Date(a.endDate).toLocaleDateString()})`)
          .join(', ');
        return `⚠️ Requested dates fall outside active allowed leave windows for ${type}: ${windows}.`;
      }
    }

    return null;
  };

  const valWarning = getValidationWarning();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeStart = dateMode === 'SINGLE_DATE' ? singleDate : startDate;
    const activeEnd = dateMode === 'SINGLE_DATE' ? singleDate : endDate;

    if (!activeStart || !activeEnd || !reason.trim()) {
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
          startDate: activeStart,
          endDate: activeEnd,
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

          {/* Active Leave Policy & Restriction Rules Banner */}
          {rules.length > 0 && (
            <div style={{ marginBottom: '24px', padding: '14px 16px', borderRadius: '12px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.12)' }}>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#818cf8', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', letterSpacing: '0.5px' }}>
                <Layers size={14} /> Active Organization Leave Policy Rules
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12.5px' }}>
                {relevantAllowed.map((r) => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#34d399' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#34d399' }} />
                    <span><strong>Allowed Window ({r.title}):</strong> {new Date(r.startDate).toLocaleDateString(undefined, { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })} – {new Date(r.endDate).toLocaleDateString(undefined, { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                ))}

                {relevantBlackouts.map((r) => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f87171' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#f87171' }} />
                    <span><strong>Blackout Period ({r.title}):</strong> {new Date(r.startDate).toLocaleDateString(undefined, { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })} – {new Date(r.endDate).toLocaleDateString(undefined, { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 2: Application Mode Switcher (Single Date vs Date Range) */}
          <div style={{ marginBottom: '20px' }}>
            <label className="form-label" style={{ marginBottom: '8px', display: 'block' }}>Application Mode *</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setDateMode('SINGLE_DATE')}
                className={`btn ${dateMode === 'SINGLE_DATE' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '10px', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <Calendar size={15} />
                <span>Single Specific Day</span>
              </button>

              <button
                type="button"
                onClick={() => setDateMode('DATE_RANGE')}
                className={`btn ${dateMode === 'DATE_RANGE' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '10px', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <Clock size={15} />
                <span>Custom Date Range</span>
              </button>
            </div>
          </div>

          {/* Date Picker Fields based on Mode */}
          {dateMode === 'SINGLE_DATE' ? (
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label" style={{ fontSize: '12.5px' }}>Specific Leave Date *</label>
              <input
                type="date"
                className="form-input"
                style={{
                  fontSize: '13px',
                  padding: '10px 12px',
                  width: '100%',
                  minHeight: '42px',
                  backgroundColor: '#0f172a',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '10px',
                  color: '#ffffff',
                  colorScheme: 'dark',
                  boxSizing: 'border-box',
                }}
                value={singleDate}
                onChange={(e) => handleSingleDateChange(e.target.value)}
              />
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '20px' }}>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', minWidth: 0 }}>
                <label className="form-label" style={{ fontSize: '12.5px', marginBottom: 0 }}>Start Date *</label>
                <input
                  type="date"
                  className="form-input"
                  style={{
                    fontSize: '13px',
                    padding: '10px 12px',
                    width: '100%',
                    minHeight: '42px',
                    backgroundColor: '#0f172a',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '10px',
                    color: '#ffffff',
                    colorScheme: 'dark',
                    boxSizing: 'border-box',
                  }}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', minWidth: 0 }}>
                <label className="form-label" style={{ fontSize: '12.5px', marginBottom: 0 }}>End Date *</label>
                <input
                  type="date"
                  className="form-input"
                  style={{
                    fontSize: '13px',
                    padding: '10px 12px',
                    width: '100%',
                    minHeight: '42px',
                    backgroundColor: '#0f172a',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '10px',
                    color: '#ffffff',
                    colorScheme: 'dark',
                    boxSizing: 'border-box',
                  }}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          )}

          {daysCount > 0 && (
            <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)', color: '#818cf8', fontSize: '13px', fontWeight: 700, marginBottom: '20px' }}>
              Calculated Duration: {daysCount} {daysCount === 1 ? 'Day (Single Specific Date)' : 'Days (Date Range)'}
            </div>
          )}

          {/* Validation Warning Box */}
          {valWarning && (
            <div style={{ padding: '12px 14px', borderRadius: '10px', backgroundColor: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', fontSize: '12.5px', lineHeight: 1.4, marginBottom: '20px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#f87171' }} />
              <div>{valWarning}</div>
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

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', flexWrap: 'wrap' }}>
            <Link href={`/${orgCode}/staff/leave`} className="btn btn-secondary" style={{ flex: 1, textAlign: 'center' }}>
              Cancel
            </Link>
            <button type="submit" disabled={submitting || Boolean(valWarning)} className="btn btn-primary" style={{ flex: 1 }}>
              {submitting ? 'Submitting...' : 'Submit Leave Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
