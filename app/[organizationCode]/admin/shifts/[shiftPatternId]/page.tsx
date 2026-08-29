'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Clock,
  ArrowLeft,
  Users,
  Calendar,
  Edit2,
  Power,
  ShieldCheck,
  Plus,
  Moon,
  AlertTriangle,
  RefreshCw,
  MapPin,
  Trash2,
  Check,
  X,
  Loader2,
  Save,
  Copy,
} from 'lucide-react';
import { OrgAdminSidebar } from '@/components/layout/org-admin-sidebar';
import { OrgAdminMobileNav } from '@/components/layout/org-admin-mobile-nav';
import { useToast } from '@/components/feedback/toast-provider';
import { ConfirmationModal } from '@/components/feedback/confirmation-modal';
import { formatDateToIsoDay, Weekday } from '@/lib/shift-validation';
import styles from './ShiftDetail.module.css';

interface WeeklyDayItem {
  id?: string;
  weekday: Weekday;
  isHoliday: boolean;
  startTime: string | null;
  endTime: string | null;
  isOvernight: boolean;
}

interface StaffAssignmentItem {
  id: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  assignedBy: string | null;
  staffProfile: {
    id: string;
    staffId: string;
    name: string;
    phone: string;
    user: { status: 'ACTIVE' | 'INACTIVE' };
    branchAssignments: Array<{ branch: { id: string; name: string } }>;
  };
}

interface ShiftPatternDetail {
  id: string;
  name: string;
  description: string | null;
  minimumStaffingThreshold: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  weeklyDays: WeeklyDayItem[];
  assignments: StaffAssignmentItem[];
}

interface AllStaffItem {
  id: string;
  staffId: string;
  name: string;
  phone: string;
  user: { status: 'ACTIVE' | 'INACTIVE' };
}

const WEEKDAY_ORDER: Weekday[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

const WEEKDAY_NAMES: Record<Weekday, string> = {
  MONDAY: 'Monday',
  TUESDAY: 'Tuesday',
  WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday',
  FRIDAY: 'Friday',
  SATURDAY: 'Saturday',
  SUNDAY: 'Sunday',
};

export default function ShiftPatternDetailPage() {
  const params = useParams();
  const organizationCode = (params.organizationCode as string)?.toUpperCase();
  const shiftPatternId = params.shiftPatternId as string;
  const router = useRouter();
  const toast = useToast();

  const [pattern, setPattern] = useState<ShiftPatternDetail | null>(null);
  const [allStaff, setAllStaff] = useState<AllStaffItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [branding, setBranding] = useState<any>(null);

  // Staff Assignment Modal
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [effectiveFrom, setEffectiveFrom] = useState(formatDateToIsoDay(new Date()));
  const [effectiveTo, setEffectiveTo] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);

  // Remove Assignment Confirmation Modal
  const [removeAssignmentId, setRemoveAssignmentId] = useState<string | null>(null);
  const [removingAssignment, setRemovingAssignment] = useState(false);

  // Toggle Active Confirmation Modal
  const [toggleActiveModalOpen, setToggleActiveModalOpen] = useState(false);

  // Edit Pattern Form
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [minimumStaffingThreshold, setMinimumStaffingThreshold] = useState('1');
  const [savingEdit, setSavingEdit] = useState(false);

  // Edit Weekly Schedule Modal State
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [editingDays, setEditingDays] = useState<WeeklyDayItem[]>([]);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, [organizationCode, shiftPatternId]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const brandRes = await fetch(`/api/org/${organizationCode}/branding`);
      const brandData = await brandRes.json();
      if (brandData.success) setBranding(brandData.organization);

      const staffRes = await fetch(`/api/org/${organizationCode}/staff`);
      const staffData = await staffRes.json();
      if (staffData.success) {
        setAllStaff(staffData.staff.filter((s: any) => s.user.status !== 'INACTIVE'));
      }

      const res = await fetch(`/api/org/${organizationCode}/shift-patterns/${shiftPatternId}`);
      const data = await res.json();
      if (data.success && data.shiftPattern) {
        setPattern(data.shiftPattern);
        setName(data.shiftPattern.name);
        setDescription(data.shiftPattern.description || '');
        setMinimumStaffingThreshold(String(data.shiftPattern.minimumStaffingThreshold));

        // Initialize editingDays array for all 7 weekdays
        initEditingDays(data.shiftPattern.weeklyDays || []);
      } else {
        toast.error(data.error || 'Failed to load shift pattern.');
      }
    } catch {
      toast.error('Network error loading pattern details.');
    } finally {
      setLoading(false);
    }
  };

  const initEditingDays = (existingDays: WeeklyDayItem[]) => {
    const fullDays: WeeklyDayItem[] = WEEKDAY_ORDER.map((wDay) => {
      const match = existingDays.find((d) => d.weekday === wDay);
      if (match) {
        return {
          weekday: wDay,
          isHoliday: match.isHoliday,
          startTime: match.startTime || '09:00',
          endTime: match.endTime || '17:00',
          isOvernight: match.isOvernight || false,
        };
      }
      return {
        weekday: wDay,
        isHoliday: wDay === 'SATURDAY' || wDay === 'SUNDAY',
        startTime: '09:00',
        endTime: '17:00',
        isOvernight: false,
      };
    });
    setEditingDays(fullDays);
  };

  const handleToggleActive = async () => {
    if (!pattern) return;
    try {
      const res = await fetch(`/api/org/${organizationCode}/shift-patterns/${pattern.id}/deactivate`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        toast.success(pattern.isActive ? 'Shift pattern deactivated.' : 'Shift pattern activated.');
        setToggleActiveModalOpen(false);
        fetchInitialData();
      } else {
        toast.error(data.error || 'Failed to update pattern status.');
      }
    } catch {
      toast.error('Network error updating status.');
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingEdit(true);
      const res = await fetch(`/api/org/${organizationCode}/shift-patterns/${shiftPatternId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          minimumStaffingThreshold: parseInt(minimumStaffingThreshold, 10),
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Shift pattern details updated successfully.');
        setIsEditing(false);
        fetchInitialData();
      } else {
        toast.error(data.error || 'Failed to update pattern.');
      }
    } catch {
      toast.error('Network error updating pattern.');
    } finally {
      setSavingEdit(false);
    }
  };

  // Save Weekly Schedule
  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setScheduleError(null);

    // Validate that at least one workday exists
    const workdays = editingDays.filter((d) => !d.isHoliday);
    if (workdays.length === 0) {
      setScheduleError('At least one day must be set as a working day.');
      return;
    }

    // Validate start & end times for workdays
    for (const d of workdays) {
      if (!d.startTime || !d.endTime) {
        setScheduleError(`Please specify start and end times for ${WEEKDAY_NAMES[d.weekday]}.`);
        return;
      }
    }

    try {
      setSavingSchedule(true);
      const payloadDays = editingDays.map((d) => ({
        weekday: d.weekday,
        isHoliday: d.isHoliday,
        startTime: d.isHoliday ? null : d.startTime,
        endTime: d.isHoliday ? null : d.endTime,
        isOvernight: d.isHoliday ? false : d.isOvernight,
      }));

      const res = await fetch(`/api/org/${organizationCode}/shift-patterns/${shiftPatternId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: payloadDays }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Weekly working schedule updated successfully!');
        setScheduleModalOpen(false);
        fetchInitialData();
      } else {
        setScheduleError(data.error || 'Failed to save weekly schedule.');
      }
    } catch {
      setScheduleError('Network error saving weekly schedule.');
    } finally {
      setSavingSchedule(false);
    }
  };

  // Quick Action: Copy Monday schedule to all workdays
  const handleCopyMondayToAllWorkdays = () => {
    const monday = editingDays.find((d) => d.weekday === 'MONDAY');
    if (!monday) return;
    setEditingDays((prev) =>
      prev.map((d) => {
        if (d.weekday === 'SATURDAY' || d.weekday === 'SUNDAY') return d;
        return {
          ...d,
          isHoliday: false,
          startTime: monday.startTime || '09:00',
          endTime: monday.endTime || '17:00',
          isOvernight: monday.isOvernight,
        };
      })
    );
    toast.info('Applied Monday hours to Mon–Fri workdays.');
  };

  const handleAssignStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setConflictError(null);

    if (selectedStaffIds.length === 0) {
      toast.error('Please select at least one staff member.');
      return;
    }

    if (!effectiveFrom) {
      toast.error('Effective start date is required.');
      return;
    }

    try {
      setAssigning(true);
      const res = await fetch(`/api/org/${organizationCode}/shift-assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftPatternId,
          staffProfileIds: selectedStaffIds,
          effectiveFrom,
          effectiveTo: effectiveTo || null,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Staff assigned successfully.');
        setAssignModalOpen(false);
        setSelectedStaffIds([]);
        fetchInitialData();
      } else {
        if (res.status === 409) {
          setConflictError(data.error || 'Shift assignment conflict detected. Staff already has another shift assigned for this date range.');
        } else {
          toast.error(data.error || 'Failed to assign staff.');
        }
      }
    } catch {
      toast.error('Network error assigning shift pattern.');
    } finally {
      setAssigning(false);
    }
  };

  const handleConfirmRemoveAssignment = async () => {
    if (!removeAssignmentId) return;
    try {
      setRemovingAssignment(true);
      const res = await fetch(`/api/org/${organizationCode}/shift-assignments/${removeAssignmentId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Staff removed from shift pattern.');
        setRemoveAssignmentId(null);
        fetchInitialData();
      } else {
        toast.error(data.error || 'Failed to remove assignment.');
      }
    } catch {
      toast.error('Network error removing assignment.');
    } finally {
      setRemovingAssignment(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <OrgAdminSidebar organizationCode={organizationCode} organizationName={branding?.name || 'Organization'} />
        <div className={styles.mainContent} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Loader2 size={32} className="animate-spin" style={{ color: '#818cf8' }} />
        </div>
      </div>
    );
  }

  if (!pattern) {
    return (
      <div className={styles.container}>
        <OrgAdminSidebar organizationCode={organizationCode} organizationName={branding?.name || 'Organization'} />
        <div className={styles.mainContent} style={{ padding: '32px', textAlign: 'center' }}>
          <AlertTriangle size={36} color="var(--danger-text)" style={{ margin: '0 auto 12px auto' }} />
          <h2>Shift pattern not found</h2>
          <Link href={`/${organizationCode}/admin/shifts`} className="btn btn-primary" style={{ marginTop: '16px' }}>
            Back to Shift Patterns
          </Link>
        </div>
      </div>
    );
  }

  const isActive = pattern.isActive;

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <Link
              href={`/${organizationCode}/admin/shifts`}
              className="btn btn-secondary btn-sm"
              style={{ padding: '8px' }}
            >
              <ArrowLeft size={16} />
            </Link>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.3px' }}>
                  {pattern.name}
                </h1>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: isActive ? '#34d399' : '#f87171',
                    border: `1px solid ${isActive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  }}
                >
                  {isActive ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </div>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {pattern.description || 'Recurring weekly schedule configuration'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setIsEditing(!isEditing)} className="btn btn-secondary btn-sm">
              <Edit2 size={14} />
              <span>{isEditing ? 'Cancel Edit' : 'Edit Info'}</span>
            </button>

            <button
              onClick={() => {
                initEditingDays(pattern.weeklyDays);
                setScheduleModalOpen(true);
              }}
              className="btn btn-secondary btn-sm"
              style={{ border: '1px solid rgba(99, 102, 241, 0.4)', color: '#818cf8' }}
            >
              <Clock size={14} />
              <span>Edit Weekly Schedule</span>
            </button>

            <button
              onClick={() => setToggleActiveModalOpen(true)}
              className={`btn btn-sm ${isActive ? 'btn-danger-subtle' : 'btn-success-subtle'}`}
              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Power size={14} />
              <span>{isActive ? 'Deactivate' : 'Activate'}</span>
            </button>

            <button
              onClick={() => {
                setConflictError(null);
                setAssignModalOpen(true);
              }}
              disabled={!isActive}
              className="btn btn-primary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={16} />
              <span>Assign Staff</span>
            </button>
          </div>
        </header>

        {/* Content Container */}
        <main style={{ padding: '32px', maxWidth: '1100px', width: '100%', margin: '0 auto' }}>
          {/* Edit Pattern Details Form */}
          {isEditing && (
            <div className="glass-card" style={{ padding: '24px', marginBottom: '28px', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff', marginBottom: '16px' }}>Edit Shift Pattern Details</h3>
              <form onSubmit={handleSaveEdit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '16px', alignItems: 'end' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '12.5px', color: '#ffffff', fontWeight: 600 }}>Shift Name</label>
                  <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="form-input" style={{ width: '100%', marginTop: '4px' }} />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '12.5px', color: '#ffffff', fontWeight: 600 }}>Min Staff Required</label>
                  <input type="number" min="1" required value={minimumStaffingThreshold} onChange={(e) => setMinimumStaffingThreshold(e.target.value)} className="form-input" style={{ width: '100%', marginTop: '4px' }} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label" style={{ fontSize: '12.5px', color: '#ffffff', fontWeight: 600 }}>Description</label>
                  <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="form-input" style={{ width: '100%', marginTop: '4px' }} />
                </div>
                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
                  <button type="button" onClick={() => setIsEditing(false)} className="btn btn-secondary btn-sm">Cancel</button>
                  <button type="submit" disabled={savingEdit} className="btn btn-primary btn-sm">{savingEdit ? 'Saving...' : 'Save Info'}</button>
                </div>
              </form>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Section 1: Weekly Schedule Grid */}
            <div className="glass-card" style={{ padding: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
                    <Calendar size={18} />
                  </div>
                  <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>
                    Weekly Working Schedule
                  </h2>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                    <ShieldCheck size={14} color="#38bdf8" />
                    <span>Min Staff: <strong>{pattern.minimumStaffingThreshold}</strong></span>
                  </div>
                  <button
                    onClick={() => {
                      initEditingDays(pattern.weeklyDays);
                      setScheduleModalOpen(true);
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Edit2 size={13} />
                    <span>Edit Schedule</span>
                  </button>
                </div>
              </div>

              <div className={styles.scheduleGrid}>
                {WEEKDAY_ORDER.map((wDay) => {
                  const dayConfig = pattern.weeklyDays.find((d) => d.weekday === wDay);
                  const isHol = !dayConfig || dayConfig.isHoliday;
                  const isOver = dayConfig?.isOvernight;

                  return (
                    <div
                      key={wDay}
                      className={`${styles.scheduleCard} ${
                        isHol
                          ? styles.scheduleCardHoliday
                          : isOver
                          ? styles.scheduleCardOvernight
                          : styles.scheduleCardWorking
                      }`}
                    >
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff', marginBottom: '4px' }}>
                        {WEEKDAY_NAMES[wDay]}
                      </div>

                      {!isHol && dayConfig?.startTime && dayConfig?.endTime ? (
                        <>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: '#818cf8' }}>
                            {dayConfig.startTime} – {dayConfig.endTime}
                          </div>
                          {isOver && (
                            <span style={{ fontSize: '10px', color: '#c084fc', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', marginTop: '4px' }}>
                              <Moon size={10} />
                              <span>Overnight</span>
                            </span>
                          )}
                        </>
                      ) : (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '4px' }}>
                          Holiday
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section 2: Assigned Workforce */}
            <div className="glass-card" style={{ padding: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(168, 85, 247, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c084fc' }}>
                    <Users size={18} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>
                      Assigned Workforce ({pattern.assignments.length})
                    </h2>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setConflictError(null);
                    setAssignModalOpen(true);
                  }}
                  disabled={!isActive}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Plus size={14} />
                  <span>Assign Staff</span>
                </button>
              </div>

              {pattern.assignments.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', backgroundColor: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-md)' }}>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                    No staff members are currently assigned to this recurring shift pattern.
                  </p>
                </div>
              ) : (
                <div className={styles.staffList}>
                  {pattern.assignments.map((assignment) => (
                    <div key={assignment.id} className={styles.staffItem}>
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
                            {assignment.staffProfile.staffId}
                          </span>
                          <span style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff' }}>
                            {assignment.staffProfile.name}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                          <span>
                            Effective: {assignment.effectiveFrom.slice(0, 10)} {assignment.effectiveTo ? `to ${assignment.effectiveTo.slice(0, 10)}` : '(Ongoing)'}
                          </span>
                          {assignment.staffProfile.branchAssignments.length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <MapPin size={11} color="#38bdf8" />
                              <span>{assignment.staffProfile.branchAssignments.map((b) => b.branch.name).join(', ')}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => setRemoveAssignmentId(assignment.id)}
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--danger-text)', padding: '6px' }}
                        title="Remove assignment"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* EDIT WEEKLY WORKING SCHEDULE MODAL */}
      {scheduleModalOpen && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 999999, backgroundColor: 'rgba(3, 7, 18, 0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '640px', padding: '28px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Clock size={20} color="#818cf8" />
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                  Edit Weekly Working Schedule
                </h3>
              </div>
              <button onClick={() => setScheduleModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.4 }}>
              Configure daily work hours, holiday status, and overnight shifts for <strong>{pattern.name}</strong>.
            </p>

            {/* Quick Actions Header */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleCopyMondayToAllWorkdays}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '11.5px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                <Copy size={12} />
                <span>Apply Monday Hours to Mon–Fri</span>
              </button>
            </div>

            {scheduleError && (
              <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', fontSize: '12.5px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={15} />
                <span>{scheduleError}</span>
              </div>
            )}

            <form onSubmit={handleSaveSchedule}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                {WEEKDAY_ORDER.map((wDay) => {
                  const dayObj = editingDays.find((d) => d.weekday === wDay) || {
                    weekday: wDay,
                    isHoliday: true,
                    startTime: '09:00',
                    endTime: '17:00',
                    isOvernight: false,
                  };

                  return (
                    <div
                      key={wDay}
                      style={{
                        padding: '12px 16px',
                        borderRadius: '12px',
                        backgroundColor: dayObj.isHoliday ? 'rgba(255,255,255,0.02)' : 'rgba(99, 102, 241, 0.08)',
                        border: `1px solid ${dayObj.isHoliday ? 'rgba(255,255,255,0.06)' : 'rgba(99, 102, 241, 0.25)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        flexWrap: 'wrap',
                      }}
                    >
                      {/* Day Label & Holiday Toggle */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '160px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingDays((prev) =>
                              prev.map((d) => (d.weekday === wDay ? { ...d, isHoliday: !d.isHoliday } : d))
                            );
                          }}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 700,
                            border: 'none',
                            cursor: 'pointer',
                            backgroundColor: dayObj.isHoliday ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                            color: dayObj.isHoliday ? '#f87171' : '#34d399',
                          }}
                        >
                          {dayObj.isHoliday ? 'Holiday' : '✓ Workday'}
                        </button>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>
                          {WEEKDAY_NAMES[wDay]}
                        </span>
                      </div>

                      {/* Time Pickers if Workday */}
                      {!dayObj.isHoliday ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <input
                            type="time"
                            value={dayObj.startTime || '09:00'}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditingDays((prev) =>
                                prev.map((d) => (d.weekday === wDay ? { ...d, startTime: val } : d))
                              );
                            }}
                            className="form-input"
                            style={{ padding: '6px 8px', fontSize: '12px', width: '105px' }}
                          />
                          <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>to</span>
                          <input
                            type="time"
                            value={dayObj.endTime || '17:00'}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditingDays((prev) =>
                                prev.map((d) => (d.weekday === wDay ? { ...d, endTime: val } : d))
                              );
                            }}
                            className="form-input"
                            style={{ padding: '6px 8px', fontSize: '12px', width: '105px' }}
                          />

                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#c084fc', cursor: 'pointer', marginLeft: '6px' }}>
                            <input
                              type="checkbox"
                              checked={dayObj.isOvernight}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setEditingDays((prev) =>
                                  prev.map((d) => (d.weekday === wDay ? { ...d, isOvernight: checked } : d))
                                );
                              }}
                            />
                            <span>Overnight</span>
                          </label>
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          Off Day / Holiday
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setScheduleModalOpen(false)} className="btn btn-secondary btn-sm">
                  Cancel
                </button>
                <button type="submit" disabled={savingSchedule} className="btn btn-primary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  {savingSchedule ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Saving Schedule...</span>
                    </>
                  ) : (
                    <>
                      <Save size={14} />
                      <span>Save Weekly Schedule</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Staff Assignment Modal */}
      {assignModalOpen && (
        <div className="modal-overlay" onClick={() => setAssignModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px', padding: '28px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>
              Assign Staff to Shift: {pattern.name}
            </h3>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Select staff members and specify the effective date range. Overlapping assignments will be checked automatically.
            </p>

            {conflictError && (
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#f87171',
                  fontSize: '12.5px',
                  marginBottom: '16px',
                  lineHeight: '1.4',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, marginBottom: '2px' }}>
                  <AlertTriangle size={15} />
                  <span>Shift Conflict Detected</span>
                </div>
                <div>{conflictError}</div>
              </div>
            )}

            <form onSubmit={handleAssignStaff}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '12.5px', color: '#ffffff', fontWeight: 600 }}>
                    Effective From <span style={{ color: 'var(--danger-text)' }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={effectiveFrom}
                    onChange={(e) => setEffectiveFrom(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '12.5px', color: '#ffffff', fontWeight: 600 }}>Effective To (Optional)</label>
                  <input
                    type="date"
                    value={effectiveTo}
                    onChange={(e) => setEffectiveTo(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '12.5px', color: '#ffffff', fontWeight: 600 }}>
                  Select Staff Members ({selectedStaffIds.length} selected)
                </label>
                <div
                  style={{
                    maxHeight: '200px',
                    overflowY: 'auto',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'rgba(13, 18, 31, 0.8)',
                    padding: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  {allStaff.map((s) => {
                    const isSelected = selectedStaffIds.includes(s.id);
                    return (
                      <div
                        key={s.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedStaffIds(selectedStaffIds.filter((id) => id !== s.id));
                          } else {
                            setSelectedStaffIds([...selectedStaffIds, s.id]);
                          }
                        }}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                          border: `1px solid ${isSelected ? '#4f46e5' : 'transparent'}`,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                        }}
                      >
                        <div
                          style={{
                            width: '16px',
                            height: '16px',
                            borderRadius: '3px',
                            backgroundColor: isSelected ? '#4f46e5' : 'transparent',
                            border: `1px solid ${isSelected ? '#4f46e5' : 'var(--border-medium)'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                          }}
                        >
                          {isSelected && <Check size={11} />}
                        </div>
                        <div style={{ fontSize: '13px', color: '#ffffff' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', color: '#818cf8', marginRight: '6px' }}>
                            {s.staffId}
                          </span>
                          {s.name}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setAssignModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigning || selectedStaffIds.length === 0}
                  className="btn btn-primary btn-sm"
                >
                  {assigning ? 'Assigning...' : 'Assign Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remove Assignment Confirmation Modal */}
      <ConfirmationModal
        isOpen={Boolean(removeAssignmentId)}
        onClose={() => setRemoveAssignmentId(null)}
        onConfirm={handleConfirmRemoveAssignment}
        title="Remove staff assignment?"
        message="This staff member will no longer be assigned to this shift pattern. Historical attendance records will remain preserved."
        confirmText="Remove Assignment"
        variant="danger"
      />

      {/* Toggle Pattern Status Confirmation Modal */}
      <ConfirmationModal
        isOpen={toggleActiveModalOpen}
        onClose={() => setToggleActiveModalOpen(false)}
        onConfirm={handleToggleActive}
        title={isActive ? 'Deactivate shift pattern?' : 'Activate shift pattern?'}
        message={
          isActive
            ? `Deactivating "${pattern.name}" prevents new staff assignments. Existing historical roster and attendance records remain preserved.`
            : `Reactivating "${pattern.name}" will allow staff to be assigned to this shift pattern for new schedules.`
        }
        confirmText={isActive ? 'Deactivate Pattern' : 'Activate Pattern'}
        variant={isActive ? 'danger' : 'primary'}
      />

      {/* Mobile Nav */}
      <OrgAdminMobileNav organizationCode={organizationCode} />
    </div>
  );
}
