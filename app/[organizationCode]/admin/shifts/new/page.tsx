'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Clock,
  ArrowLeft,
  ShieldCheck,
  Moon,
  Info,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { OrgAdminSidebar } from '@/components/layout/org-admin-sidebar';
import { OrgAdminMobileNav } from '@/components/layout/org-admin-mobile-nav';
import { useToast } from '@/components/feedback/toast-provider';
import { isOvernightShift, Weekday } from '@/lib/shift-validation';
import styles from './ShiftCreate.module.css';

interface DayState {
  weekday: Weekday;
  label: string;
  isHoliday: boolean;
  startTime: string;
  endTime: string;
}

const DEFAULT_DAYS: DayState[] = [
  { weekday: 'MONDAY', label: 'Monday', isHoliday: false, startTime: '08:00', endTime: '17:00' },
  { weekday: 'TUESDAY', label: 'Tuesday', isHoliday: false, startTime: '08:00', endTime: '17:00' },
  { weekday: 'WEDNESDAY', label: 'Wednesday', isHoliday: false, startTime: '08:00', endTime: '17:00' },
  { weekday: 'THURSDAY', label: 'Thursday', isHoliday: false, startTime: '08:00', endTime: '17:00' },
  { weekday: 'FRIDAY', label: 'Friday', isHoliday: false, startTime: '08:00', endTime: '17:00' },
  { weekday: 'SATURDAY', label: 'Saturday', isHoliday: true, startTime: '', endTime: '' },
  { weekday: 'SUNDAY', label: 'Sunday', isHoliday: true, startTime: '', endTime: '' },
];

export default function CreateShiftPatternPage() {
  const params = useParams();
  const organizationCode = (params.organizationCode as string)?.toUpperCase();
  const router = useRouter();
  const toast = useToast();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [minimumStaffingThreshold, setMinimumStaffingThreshold] = useState('1');
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [days, setDays] = useState<DayState[]>(DEFAULT_DAYS);
  const [submitting, setSubmitting] = useState(false);
  const [branding, setBranding] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/org/${organizationCode}/branding`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setBranding(d.organization);
      })
      .catch(() => {});
  }, [organizationCode]);

  const handleToggleHoliday = (idx: number, isHoliday: boolean) => {
    const updated = [...days];
    updated[idx] = {
      ...updated[idx],
      isHoliday,
      startTime: isHoliday ? '' : updated[idx].startTime || '08:00',
      endTime: isHoliday ? '' : updated[idx].endTime || '17:00',
    };
    setDays(updated);
  };

  const handleTimeChange = (idx: number, field: 'startTime' | 'endTime', val: string) => {
    const updated = [...days];
    updated[idx] = {
      ...updated[idx],
      [field]: val,
    };
    setDays(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Shift pattern name is required.');
      return;
    }

    const threshold = parseInt(minimumStaffingThreshold, 10);
    if (isNaN(threshold) || threshold < 1) {
      toast.error('Minimum staffing threshold must be at least 1.');
      return;
    }

    // Validation for working days
    for (const d of days) {
      if (!d.isHoliday) {
        if (!d.startTime || !d.endTime) {
          toast.error(`${d.label} is marked as a working day, so start and end times are required.`);
          return;
        }
        if (d.startTime === d.endTime) {
          toast.error(`${d.label} start and end times cannot be identical.`);
          return;
        }
      }
    }

    try {
      setSubmitting(true);
      const res = await fetch(`/api/org/${organizationCode}/shift-patterns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          minimumStaffingThreshold: threshold,
          days: days.map((d) => ({
            weekday: d.weekday,
            isHoliday: d.isHoliday,
            startTime: d.isHoliday ? null : d.startTime,
            endTime: d.isHoliday ? null : d.endTime,
          })),
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`Shift pattern created successfully.`);
        router.push(`/${organizationCode}/admin/shifts`);
      } else {
        toast.error(data.error || 'Failed to create shift pattern.');
      }
    } catch {
      toast.error('Network error creating shift pattern.');
    } finally {
      setSubmitting(false);
    }
  };

  const workingDaysSummary = days.filter((d) => !d.isHoliday);
  const holidayDaysSummary = days.filter((d) => d.isHoliday);

  return (
    <div className={styles.container}>
      {/* Sidebar */}
      <OrgAdminSidebar
        organizationCode={organizationCode}
        organizationName={branding?.name || 'Organization'}
        logoUrl={branding?.logoUrl}
      />

      {/* Main Content */}
      <div className={styles.mainContent}>
        {/* Header */}
        <header className={styles.header}>
          <Link
            href={`/${organizationCode}/admin/shifts`}
            className="btn btn-secondary btn-sm"
            style={{ padding: '8px' }}
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.3px' }}>
              Create Shift Pattern
            </h1>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Define weekly working schedule, hours, overnight shifts, and minimum staffing thresholds.
            </p>
          </div>
        </header>

        {/* Form Container */}
        <main style={{ padding: '32px', maxWidth: '860px', width: '100%', margin: '0 auto' }}>
          <form onSubmit={handleSubmit}>
            {/* 1. Shift Profile Information */}
            <div className="glass-card" style={{ padding: '28px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(168, 85, 247, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#c084fc',
                  }}
                >
                  <Clock size={18} />
                </div>
                <div>
                  <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>
                    1. Shift Profile Information
                  </h2>
                </div>
              </div>

              {/* Shift Name */}
              <div style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
                  Shift Name <span style={{ color: 'var(--danger-text)' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Morning Shift, Evening Shift, General Staff"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="form-input"
                  style={{ width: '100%' }}
                  required
                />
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Give this shift a recognizable name, such as Morning Shift or Evening Shift.
                </p>
              </div>

              {/* Description */}
              <div style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
                  Description <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Standard 5-day office work week with weekend holidays"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="form-input"
                  style={{ width: '100%' }}
                />
              </div>

              {/* Minimum Staffing Required */}
              <div>
                <label className="form-label" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
                  Minimum Staff Required <span style={{ color: 'var(--danger-text)' }}>*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={minimumStaffingThreshold}
                  onChange={(e) => setMinimumStaffingThreshold(e.target.value)}
                  className="form-input"
                  style={{ width: '140px' }}
                  required
                />
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Minimum number of staff required for this shift.
                </p>
              </div>
            </div>

            {/* 2. 7-Day Weekly Schedule Editor */}
            <div className="glass-card" style={{ padding: '28px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(99, 102, 241, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#818cf8',
                  }}
                >
                  <Calendar size={18} />
                </div>
                <div>
                  <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>
                    2. Weekly Schedule (Monday – Sunday)
                  </h2>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Configure working hours or holiday status for each day of the week.
                  </p>
                </div>
              </div>

              {/* Day Rows */}
              {days.map((day, idx) => {
                const overnight = !day.isHoliday && day.startTime && day.endTime ? isOvernightShift(day.startTime, day.endTime) : false;

                return (
                  <div key={day.weekday} className={styles.dayRow}>
                    <div className={styles.dayLabel}>{day.label}</div>

                    {/* Working Day vs Holiday Toggle */}
                    <div className={styles.dayToggleGroup}>
                      <button
                        type="button"
                        onClick={() => handleToggleHoliday(idx, false)}
                        className={`${styles.toggleBtn} ${!day.isHoliday ? styles.toggleBtnActiveWorking : ''}`}
                      >
                        Working Day
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleHoliday(idx, true)}
                        className={`${styles.toggleBtn} ${day.isHoliday ? styles.toggleBtnActiveHoliday : ''}`}
                      >
                        Holiday
                      </button>
                    </div>

                    {/* Time Pickers */}
                    <div className={styles.timeInputGroup}>
                      {!day.isHoliday ? (
                        <>
                          <input
                            type="time"
                            value={day.startTime}
                            onChange={(e) => handleTimeChange(idx, 'startTime', e.target.value)}
                            className={`form-input ${styles.timeInput}`}
                            required
                          />
                          <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>to</span>
                          <input
                            type="time"
                            value={day.endTime}
                            onChange={(e) => handleTimeChange(idx, 'endTime', e.target.value)}
                            className={`form-input ${styles.timeInput}`}
                            required
                          />

                          {overnight && (
                            <span className={styles.overnightBadge} title="Shift crosses midnight into next day">
                              <Moon size={11} />
                              <span>Overnight</span>
                            </span>
                          )}
                        </>
                      ) : (
                        <span style={{ fontSize: '12.5px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          Scheduled Holiday (Day Off)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 3. Effective Date */}
            <div className="glass-card" style={{ padding: '28px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <div style={{ width: '34px', height: '34px', borderRadius: '8px', backgroundColor: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
                  <Calendar size={18} />
                </div>
                <div>
                  <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>
                    3. Effective Date
                  </h2>
                </div>
              </div>

              <div>
                <label className="form-label" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
                  Effective From <span style={{ color: 'var(--danger-text)' }}>*</span>
                </label>
                <input
                  type="date"
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                  className="form-input"
                  style={{ width: '220px' }}
                  required
                />
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Changes apply from this date and should not rewrite historical attendance.
                </p>
              </div>
            </div>

            {/* 4. Review Summary */}
            <div className="glass-card" style={{ padding: '24px', marginBottom: '28px', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', marginBottom: '12px' }}>
                Review Shift Summary
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                <div><span style={{ color: 'var(--text-muted)' }}>Shift Name: </span><strong style={{ color: '#ffffff' }}>{name.trim() || '(Untitled Shift)'}</strong></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Min Staff Required: </span><strong style={{ color: '#ffffff' }}>{minimumStaffingThreshold}</strong></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Working Days: </span><strong style={{ color: '#34d399' }}>{workingDaysSummary.map((d) => d.label.slice(0, 3)).join(', ') || 'None'}</strong></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Holidays: </span><strong style={{ color: 'var(--text-muted)' }}>{holidayDaysSummary.map((d) => d.label.slice(0, 3)).join(', ') || 'None'}</strong></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Effective Date: </span><strong style={{ color: '#ffffff' }}>{effectiveFrom}</strong></div>
              </div>
            </div>

            {/* Submit Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <Link href={`/${organizationCode}/admin/shifts`} className="btn btn-secondary btn-sm">
                Cancel
              </Link>
              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary btn-sm"
              >
                {submitting ? 'Creating Shift...' : 'Create Shift'}
              </button>
            </div>
          </form>
        </main>
      </div>

      {/* Mobile Nav */}
      <OrgAdminMobileNav organizationCode={organizationCode} />
    </div>
  );
}
