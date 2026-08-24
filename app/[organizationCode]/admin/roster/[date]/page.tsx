'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Calendar,
  ArrowLeft,
  Users,
  Clock,
  Moon,
  AlertTriangle,
  RefreshCw,
  Edit2,
  Trash2,
  Plus,
  MapPin,
  CheckCircle2,
  Loader2,
  X,
} from 'lucide-react';
import { OrgAdminSidebar } from '@/components/layout/org-admin-sidebar';
import { OrgAdminMobileNav } from '@/components/layout/org-admin-mobile-nav';
import { useToast } from '@/components/feedback/toast-provider';
import { ConfirmationModal } from '@/components/feedback/confirmation-modal';
import { isOvernightShift } from '@/lib/shift-validation';
import styles from './RosterDayDetail.module.css';

interface StaffDetailItem {
  profileId: string;
  staffId: string;
  name: string;
  phone: string;
  accountStatus: 'ACTIVE' | 'INACTIVE';
  branches: Array<{ id: string; name: string }>;
  schedule: {
    date: string;
    isScheduled: boolean;
    isHoliday: boolean;
    startTime: string | null;
    endTime: string | null;
    isOvernight: boolean;
    shiftPatternName?: string;
    hasOverride: boolean;
    overrideId?: string;
    overrideReason?: string | null;
  };
}

interface DayRosterData {
  date: string;
  weekday: string;
  counts: {
    totalStaff: number;
    workingStaff: number;
    holidayStaff: number;
    unassignedStaff: number;
  };
  workingStaff: StaffDetailItem[];
  holidayStaff: StaffDetailItem[];
  unassignedStaff: StaffDetailItem[];
}

export default function RosterDayDetailPage() {
  const params = useParams();
  const organizationCode = (params.organizationCode as string)?.toUpperCase();
  const dateStr = params.date as string;
  const router = useRouter();
  const toast = useToast();

  const [branding, setBranding] = useState<any>(null);
  const [data, setData] = useState<DayRosterData | null>(null);
  const [loading, setLoading] = useState(true);

  // Override Modal State
  const [overrideModalStaff, setOverrideModalStaff] = useState<StaffDetailItem | null>(null);
  const [isHolidayOverride, setIsHolidayOverride] = useState(false);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('17:00');
  const [reason, setReason] = useState('');
  const [savingOverride, setSavingOverride] = useState(false);

  // Delete Override Confirmation Modal
  const [deleteOverrideId, setDeleteOverrideId] = useState<string | null>(null);

  useEffect(() => {
    fetchInitial();
  }, [organizationCode, dateStr]);

  const fetchInitial = async () => {
    try {
      setLoading(true);
      const brandRes = await fetch(`/api/org/${organizationCode}/branding`);
      const brandData = await brandRes.json();
      if (brandData.success) setBranding(brandData.organization);

      const res = await fetch(`/api/org/${organizationCode}/roster/day/${dateStr}`);
      const d = await res.json();
      if (d.success && d.dayDetail) {
        setData(d.dayDetail);
      } else {
        toast.error(d.error || 'Failed to load day roster detail.');
      }
    } catch {
      toast.error('Network error loading day detail.');
    } finally {
      setLoading(false);
    }
  };

  const openOverrideModal = (staff: StaffDetailItem) => {
    setOverrideModalStaff(staff);
    setIsHolidayOverride(staff.schedule.isHoliday);
    setStartTime(staff.schedule.startTime || '08:00');
    setEndTime(staff.schedule.endTime || '17:00');
    setReason(staff.schedule.overrideReason || '');
  };

  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideModalStaff) return;

    try {
      setSavingOverride(true);
      const res = await fetch(`/api/org/${organizationCode}/roster/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffProfileId: overrideModalStaff.profileId,
          date: dateStr,
          isHoliday: isHolidayOverride,
          startTime: isHolidayOverride ? null : startTime,
          endTime: isHolidayOverride ? null : endTime,
          reason: reason.trim() || null,
        }),
      });

      const resData = await res.json();
      if (resData.success) {
        toast.success('Roster override applied successfully.');
        setOverrideModalStaff(null);
        fetchInitial();
      } else {
        toast.error(resData.error || 'Failed to apply shift override.');
      }
    } catch {
      toast.error('Network error applying override.');
    } finally {
      setSavingOverride(false);
    }
  };

  const handleDeleteOverride = async () => {
    if (!deleteOverrideId) return;
    try {
      const res = await fetch(`/api/org/${organizationCode}/roster/override/${deleteOverrideId}`, {
        method: 'DELETE',
      });
      const resData = await res.json();
      if (resData.success) {
        toast.success('Shift override removed successfully.');
        setDeleteOverrideId(null);
        fetchInitial();
      } else {
        toast.error(resData.error || 'Failed to remove override.');
      }
    } catch {
      toast.error('Network error deleting override.');
    }
  };

  const overnight = !isHolidayOverride && startTime && endTime ? isOvernightShift(startTime, endTime) : false;

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
            href={`/${organizationCode}/admin/roster`}
            className="btn btn-secondary btn-sm"
            style={{ padding: '8px' }}
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.3px' }}>
              Roster Detail: {data?.weekday}, {dateStr}
            </h1>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Inspect planned shifts, duty hours, and apply day-specific overrides for individual staff members.
            </p>
          </div>
        </header>

        {/* Content Body */}
        <main style={{ padding: '32px', maxWidth: '1100px', width: '100%', margin: '0 auto' }}>
          {loading || !data ? (
            <div className="glass-card" style={{ padding: '48px 24px', textAlign: 'center' }}>
              <Loader2 size={32} className="animate-spin" style={{ color: '#818cf8', margin: '0 auto 12px auto' }} />
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Loading day roster detail...</p>
            </div>
          ) : (
            <>
              {/* Metrics Grid */}
              <div className={styles.metricsGrid}>
                <div className="glass-card" style={{ padding: '18px', borderLeft: '3px solid #818cf8' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                    Working On Duty
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#ffffff', marginTop: '2px' }}>
                    {data.counts.workingStaff}
                  </div>
                </div>

                <div className="glass-card" style={{ padding: '18px', borderLeft: '3px solid #64748b' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                    Scheduled Holidays
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#cbd5e1', marginTop: '2px' }}>
                    {data.counts.holidayStaff}
                  </div>
                </div>

                <div className="glass-card" style={{ padding: '18px', borderLeft: '3px solid #f59e0b' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                    Unassigned Staff
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#fbbf24', marginTop: '2px' }}>
                    {data.counts.unassignedStaff}
                  </div>
                </div>
              </div>

              {/* Working Staff List */}
              <div className="glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={18} color="#818cf8" />
                  <span>Scheduled on Duty ({data.workingStaff.length})</span>
                </h3>

                {data.workingStaff.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No staff scheduled to work on this day.</p>
                ) : (
                  <div className={styles.staffList}>
                    {data.workingStaff.map((staff) => (
                      <div key={staff.profileId} className={`glass-card ${styles.staffCard}`}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                              style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: '11px',
                                fontWeight: 800,
                                padding: '1px 6px',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                                color: '#818cf8',
                              }}
                            >
                              {staff.staffId}
                            </span>
                            <strong style={{ color: '#ffffff', fontSize: '14px' }}>{staff.name}</strong>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            <span>Pattern: {staff.schedule.shiftPatternName}</span>
                            {staff.branches.length > 0 && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <MapPin size={11} color="#38bdf8" />
                                <span>{staff.branches.map((b) => b.name).join(', ')}</span>
                              </span>
                            )}
                          </div>

                          {staff.schedule.hasOverride && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#fbbf24', marginTop: '4px' }}>
                              <AlertTriangle size={12} />
                              <span>Day Override Active: {staff.schedule.overrideReason || 'Custom Hours'}</span>
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '13px',
                              fontWeight: 700,
                              color: staff.schedule.isOvernight ? '#c084fc' : '#818cf8',
                              backgroundColor: staff.schedule.isOvernight ? 'rgba(168, 85, 247, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              border: `1px solid ${staff.schedule.hasOverride ? '#fbbf24' : 'rgba(99, 102, 241, 0.3)'}`,
                            }}
                          >
                            {staff.schedule.startTime} – {staff.schedule.endTime}
                            {staff.schedule.isOvernight && ' (Overnight)'}
                          </span>

                          <button
                            onClick={() => openOverrideModal(staff)}
                            className="btn btn-secondary btn-sm"
                            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Edit2 size={12} />
                            <span>{staff.schedule.hasOverride ? 'Edit Override' : 'Override'}</span>
                          </button>

                          {staff.schedule.hasOverride && staff.schedule.overrideId && (
                            <button
                              onClick={() => setDeleteOverrideId(staff.schedule.overrideId!)}
                              className="btn btn-ghost btn-sm"
                              style={{ color: 'var(--danger-text)', padding: '6px' }}
                              title="Delete override"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Holiday Staff List */}
              {data.holidayStaff.length > 0 && (
                <div className="glass-card" style={{ padding: '24px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '14px' }}>
                    Scheduled Holidays ({data.holidayStaff.length})
                  </h3>
                  <div className={styles.staffList}>
                    {data.holidayStaff.map((staff) => (
                      <div key={staff.profileId} className={`glass-card ${styles.staffCard}`}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#818cf8', fontWeight: 700 }}>
                            {staff.staffId}
                          </span>
                          <strong style={{ color: '#ffffff', fontSize: '13.5px' }}>{staff.name}</strong>
                          <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>({staff.schedule.shiftPatternName})</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>HOLIDAY</span>
                          <button
                            onClick={() => openOverrideModal(staff)}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '11px', padding: '4px 8px' }}
                          >
                            Add Work Override
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Staff Override Modal */}
      {overrideModalStaff && (
        <div className="modal-overlay" onClick={() => setOverrideModalStaff(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px', padding: '28px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff', marginBottom: '4px' }}>
              Staff Shift Override
            </h3>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Apply a day-specific schedule modification for <strong>{overrideModalStaff.name}</strong> ({overrideModalStaff.staffId}) on <strong>{dateStr}</strong>.
            </p>

            <form onSubmit={handleSaveOverride}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <button
                  type="button"
                  onClick={() => setIsHolidayOverride(false)}
                  className={`btn btn-sm ${!isHolidayOverride ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1 }}
                >
                  Working Shift
                </button>
                <button
                  type="button"
                  onClick={() => setIsHolidayOverride(true)}
                  className={`btn btn-sm ${isHolidayOverride ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1 }}
                >
                  Day Off / Holiday
                </button>
              </div>

              {!isHolidayOverride && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '12.5px', color: '#ffffff', fontWeight: 600 }}>Start Time</label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="form-input"
                      required
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '12.5px', color: '#ffffff', fontWeight: 600 }}>End Time</label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="form-input"
                      required
                    />
                  </div>
                </div>
              )}

              {overnight && (
                <div style={{ padding: '8px 12px', backgroundColor: 'rgba(168, 85, 247, 0.15)', borderRadius: '6px', color: '#c084fc', fontSize: '12px', marginBottom: '16px' }}>
                  <Moon size={12} style={{ display: 'inline', marginRight: '4px' }} />
                  <span>This shift extends overnight into the next day.</span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '12.5px', color: '#ffffff', fontWeight: 600 }}>Reason for Override (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Early departure approved, Swap shift, Special project"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="form-input"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setOverrideModalStaff(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingOverride}
                  className="btn btn-primary btn-sm"
                >
                  {savingOverride ? 'Saving Override...' : 'Apply Override'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Override Confirmation Modal */}
      <ConfirmationModal
        isOpen={Boolean(deleteOverrideId)}
        onClose={() => setDeleteOverrideId(null)}
        onConfirm={handleDeleteOverride}
        title="Remove shift override?"
        message="Removing this day override will restore the staff member's default recurring shift pattern schedule for this date."
        confirmText="Remove Override"
        variant="danger"
      />

      {/* Mobile Nav */}
      <OrgAdminMobileNav organizationCode={organizationCode} />
    </div>
  );
}
