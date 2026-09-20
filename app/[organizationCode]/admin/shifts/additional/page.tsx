'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Clock,
  Plus,
  Search,
  Users,
  Calendar,
  Filter,
  X,
  Loader2,
  Trash2,
  Pencil,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { OrgAdminSidebar } from '@/components/layout/org-admin-sidebar';
import { OrgAdminMobileNav } from '@/components/layout/org-admin-mobile-nav';
import { OrgAdminHeader } from '@/components/layout/org-admin-header';
import { useToast } from '@/components/feedback/toast-provider';
import { ConfirmationModal } from '@/components/feedback/confirmation-modal';
import { StaffAvatar } from '@/components/ui/staff-avatar';
import styles from './AdditionalShifts.module.css';

interface AdditionalShiftItem {
  id: string;
  staffProfileId: string;
  staffName: string;
  staffId: string;
  staffEmail?: string;
  date: string;
  startTime: string;
  endTime: string;
  isOvernight?: boolean;
  title: string;
  notes?: string | null;
  createdAt?: string;
}

export default function DedicatedAdditionalShiftsPage() {
  const params = useParams();
  const organizationCode = (params.organizationCode as string)?.toUpperCase() || '';
  const router = useRouter();
  const toast = useToast();

  const [branding, setBranding] = useState<any>(null);
  const [additionalShifts, setAdditionalShifts] = useState<AdditionalShiftItem[]>([]);
  const [staffList, setStaffList] = useState<{ id: string; name: string; staffId: string }[]>([]);
  const [shiftPatterns, setShiftPatterns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [selectedStaffFilter, setSelectedStaffFilter] = useState('');
  const [selectedDateFilter, setSelectedDateFilter] = useState('');
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);

  // Modal State for Add / Edit
  const [additionalModalOpen, setAdditionalModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<AdditionalShiftItem | null>(null);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [selectedShiftPatternId, setSelectedShiftPatternId] = useState<string>('');
  const [addDate, setAddDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [addStartTime, setAddStartTime] = useState('11:00');
  const [addEndTime, setAddEndTime] = useState('16:00');
  const [addTitle, setAddTitle] = useState('Overtime Shift');
  const [addNotes, setAddNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Delete Modal State
  const [deleteShiftId, setDeleteShiftId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (organizationCode) {
      fetchData();
    }
  }, [organizationCode]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setHasError(false);

      const [brandRes, addRes, staffRes, patternRes] = await Promise.all([
        fetch(`/api/org/${organizationCode}/branding`),
        fetch(`/api/org/${organizationCode}/shifts/additional`),
        fetch(`/api/org/${organizationCode}/staff`),
        fetch(`/api/org/${organizationCode}/shift-patterns`),
      ]);

      const brandData = await brandRes.json();
      if (brandData.success) setBranding(brandData.organization);

      const addData = await addRes.json();
      if (addData.success && Array.isArray(addData.additionalShifts)) {
        setAdditionalShifts(addData.additionalShifts);
      } else {
        setHasError(true);
        toast.error(addData.error || 'Failed to load additional shifts.');
      }

      const staffData = await staffRes.json();
      if (staffData.success && Array.isArray(staffData.staff)) {
        setStaffList(
          staffData.staff.map((s: any) => ({
            id: s.id,
            name: s.name,
            staffId: s.staffId,
          }))
        );
      }

      const patternData = await patternRes.json();
      if (patternData.success && (patternData.shiftPatterns || patternData.patterns)) {
        setShiftPatterns(patternData.shiftPatterns || patternData.patterns || []);
      }
    } catch {
      setHasError(true);
      toast.error('Network error loading data.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingShift(null);
    setSelectedStaffIds([]);
    setSelectedShiftPatternId('');
    setAddDate(new Date().toISOString().split('T')[0]);
    setAddStartTime('11:00');
    setAddEndTime('16:00');
    setAddTitle('Overtime Shift');
    setAddNotes('');
    setModalError(null);
    setAdditionalModalOpen(true);
  };

  const handleOpenEditModal = (shift: AdditionalShiftItem) => {
    setEditingShift(shift);
    setSelectedStaffIds([shift.staffProfileId]);
    setSelectedShiftPatternId('');
    setAddDate(shift.date);
    setAddStartTime(shift.startTime);
    setAddEndTime(shift.endTime);
    setAddTitle(shift.title || 'Additional Shift');
    setAddNotes(shift.notes || '');
    setModalError(null);
    setAdditionalModalOpen(true);
  };

  const handleCreateOrUpdateShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (selectedStaffIds.length === 0) {
      setModalError('Please select at least one staff member.');
      return;
    }
    if (!addDate) {
      setModalError('Please select a date.');
      return;
    }

    try {
      setSubmitting(true);
      const isEdit = Boolean(editingShift);
      const endpoint = `/api/org/${organizationCode}/shifts/additional`;
      const method = isEdit ? 'PUT' : 'POST';

      const payload = isEdit
        ? {
            id: editingShift!.id,
            staffProfileId: selectedStaffIds[0],
            date: addDate,
            startTime: addStartTime,
            endTime: addEndTime,
            title: addTitle.trim() || 'Additional Shift',
            notes: addNotes.trim() || null,
          }
        : {
            staffProfileIds: selectedStaffIds,
            date: addDate,
            shiftPatternId: selectedShiftPatternId || null,
            startTime: addStartTime,
            endTime: addEndTime,
            title: addTitle.trim() || 'Additional Shift',
            notes: addNotes.trim() || null,
          };

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || (isEdit ? 'Shift updated successfully.' : 'Shift assigned successfully.'));
        setAdditionalModalOpen(false);
        fetchData();
      } else {
        setModalError(data.error || 'Failed to save shift.');
        toast.error(data.error || 'Validation error.');
      }
    } catch {
      setModalError('Network connection error.');
      toast.error('Network error.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteShift = async () => {
    if (!deleteShiftId) return;
    try {
      setDeleting(true);
      const res = await fetch(`/api/org/${organizationCode}/shifts/additional?id=${deleteShiftId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Additional shift removed.');
        setDeleteShiftId(null);
        fetchData();
      } else {
        toast.error(data.error || 'Failed to delete shift.');
      }
    } catch {
      toast.error('Network error deleting shift.');
    } finally {
      setDeleting(false);
    }
  };

  // Filtered Additional Shifts
  const filteredShifts = additionalShifts.filter((shift) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      shift.staffName.toLowerCase().includes(q) ||
      shift.staffId.toLowerCase().includes(q) ||
      shift.title.toLowerCase().includes(q) ||
      (shift.notes && shift.notes.toLowerCase().includes(q));

    const matchesStaff = !selectedStaffFilter || shift.staffProfileId === selectedStaffFilter;
    const matchesDate = !selectedDateFilter || shift.date === selectedDateFilter;

    return matchesSearch && matchesStaff && matchesDate;
  });

  const handleBack = () => {
    router.push(`/${organizationCode}/admin/shifts`);
  };

  const hasActiveFilters = Boolean(search || selectedStaffFilter || selectedDateFilter);

  return (
    <div className={styles.container}>
      <OrgAdminSidebar
        organizationCode={organizationCode}
        organizationName={branding?.name || 'Organization'}
        logoUrl={branding?.logoUrl}
      />

      <div className={styles.mainContent}>
        <OrgAdminHeader
          organizationCode={organizationCode}
          logoUrl={branding?.logoUrl}
          panelTitle="Assigned Additional Shifts"
          panelSubtitle="Overtime & special holiday shift assignments"
          onBack={handleBack}
        />

        <main className={styles.pageContainer}>
          {/* Controls Bar: Search Input with Pinned Filter Drawer Button & Add Button */}
          <div className={styles.controlsBar}>
            <div className={styles.searchBarWrapper}>
              <Search size={15} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search staff, ID, title, notes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={styles.searchInput}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  style={{
                    position: 'absolute',
                    right: '44px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  <X size={14} />
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowFilterDrawer(true)}
                className={styles.filterToggleBtn}
                style={{
                  backgroundColor: hasActiveFilters ? 'rgba(99, 102, 241, 0.2)' : undefined,
                  borderColor: hasActiveFilters ? 'rgba(99, 102, 241, 0.5)' : undefined,
                  color: hasActiveFilters ? '#818cf8' : '#ffffff',
                }}
                title="Filter Shifts"
              >
                <Filter size={15} color={hasActiveFilters ? '#818cf8' : 'currentColor'} />
              </button>
            </div>

            {/* Desktop Filters Bar */}
            <div className={styles.desktopFilters}>
              <select
                value={selectedStaffFilter}
                onChange={(e) => setSelectedStaffFilter(e.target.value)}
                className="form-input"
                style={{ height: '42px', padding: '0 12px', fontSize: '12.5px', borderRadius: '12px', minWidth: '160px', color: '#ffffff', backgroundColor: 'rgba(15, 23, 42, 0.85)' }}
              >
                <option value="" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>All Staff Members</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id} style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                    {s.name} ({s.staffId})
                  </option>
                ))}
              </select>

              <input
                type="date"
                value={selectedDateFilter}
                onChange={(e) => setSelectedDateFilter(e.target.value)}
                className="form-input"
                style={{ height: '42px', padding: '0 10px', fontSize: '12.5px', borderRadius: '12px', color: '#ffffff', backgroundColor: 'rgba(15, 23, 42, 0.85)' }}
              />

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setSelectedStaffFilter('');
                    setSelectedDateFilter('');
                  }}
                  className="btn btn-secondary btn-sm"
                  style={{ height: '42px', padding: '0 12px', fontSize: '12px', borderRadius: '10px' }}
                >
                  Reset
                </button>
              )}
            </div>

            {/* Assign Shift Button (Icon only on mobile) */}
            <button
              onClick={handleOpenCreateModal}
              className="btn btn-primary"
              style={{
                backgroundColor: '#f59e0b',
                borderColor: '#f59e0b',
                color: '#000000',
                fontWeight: 700,
                height: '42px',
                padding: '0 14px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                borderRadius: '12px',
                flexShrink: 0,
              }}
            >
              <Plus size={16} />
              <span className={styles.btnTextDesktop}>Assign Shift</span>
            </button>
          </div>

          {/* LOADING STATE */}
          {loading && (
            <div className="glass-card" style={{ padding: '48px 24px', textAlign: 'center' }}>
              <Loader2 size={32} className="animate-spin" style={{ color: '#818cf8', margin: '0 auto 12px auto' }} />
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Loading additional shifts...</p>
            </div>
          )}

          {/* ERROR STATE */}
          {hasError && !loading && (
            <div className="glass-card" style={{ padding: '40px', textAlign: 'center' }}>
              <AlertCircle size={36} color="#f87171" style={{ margin: '0 auto 12px auto' }} />
              <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#ffffff' }}>Unable to load shifts</h3>
              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginTop: '4px', marginBottom: '20px' }}>
                There was an error communicating with the scheduling server.
              </p>
              <button onClick={fetchData} className="btn btn-primary btn-sm">Try Again</button>
            </div>
          )}

          {/* EMPTY STATE */}
          {!loading && !hasError && additionalShifts.length === 0 && (
            <div className="glass-card" style={{ padding: '48px 24px', textAlign: 'center', maxWidth: '480px', margin: '40px auto' }}>
              <Clock size={40} color="#fbbf24" style={{ margin: '0 auto 16px auto', opacity: 0.8 }} />
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', marginBottom: '8px' }}>
                No Additional Shifts Assigned
              </h2>
              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '24px' }}>
                Assign overtime or special holiday shift hours to staff members.
              </p>
              <button onClick={handleOpenCreateModal} className="btn btn-primary" style={{ backgroundColor: '#f59e0b', borderColor: '#f59e0b', color: '#000000', fontWeight: 700 }}>
                + Assign Additional Shift
              </button>
            </div>
          )}

          {/* SEARCH EMPTY STATE */}
          {!loading && !hasError && additionalShifts.length > 0 && filteredShifts.length === 0 && (
            <div className="glass-card" style={{ padding: '40px', textAlign: 'center' }}>
              <Search size={32} color="var(--text-muted)" style={{ margin: '0 auto 12px auto' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>No matching shifts found</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', marginBottom: '16px' }}>
                Try adjusting your search query or clearing active filters.
              </p>
              <button onClick={() => { setSearch(''); setSelectedStaffFilter(''); setSelectedDateFilter(''); }} className="btn btn-secondary btn-sm">
                Clear Filters
              </button>
            </div>
          )}

          {/* DATA LIST: DESKTOP TABLE */}
          {!loading && !hasError && filteredShifts.length > 0 && (
            <>
              <div className={styles.desktopTable}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-medium)', backgroundColor: 'rgba(15, 23, 42, 0.9)' }}>
                      <th style={{ padding: '14px 18px', textAlign: 'left', color: '#94a3b8', fontWeight: 700 }}>Staff Member</th>
                      <th style={{ padding: '14px 18px', textAlign: 'left', color: '#94a3b8', fontWeight: 700 }}>Date</th>
                      <th style={{ padding: '14px 18px', textAlign: 'left', color: '#94a3b8', fontWeight: 700 }}>Shift Timing</th>
                      <th style={{ padding: '14px 18px', textAlign: 'left', color: '#94a3b8', fontWeight: 700 }}>Shift Title &amp; Notes</th>
                      <th style={{ padding: '14px 18px', textAlign: 'right', color: '#94a3b8', fontWeight: 700 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredShifts.map((shift) => (
                      <tr key={shift.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
                        <td style={{ padding: '14px 18px' }}>
                          <div className={styles.staffInfoRow}>
                            <StaffAvatar name={shift.staffName} size="sm" />
                            <div>
                              <div style={{ fontWeight: 800, color: '#ffffff' }}>{shift.staffName}</div>
                              <div style={{ fontSize: '11.5px', color: '#818cf8', fontFamily: 'var(--font-mono)' }}>{shift.staffId}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '14px 18px', color: '#f1f5f9', fontWeight: 600 }}>{shift.date}</td>
                        <td style={{ padding: '14px 18px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '8px', backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontWeight: 700, fontSize: '12px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                            <Clock size={13} />
                            <span>{shift.startTime} – {shift.endTime}</span>
                          </span>
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '9999px', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)', fontSize: '11px', fontWeight: 700 }}>
                            ⚡ {shift.title}
                          </span>
                          {shift.notes && <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>{shift.notes}</div>}
                        </td>
                        <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                            <button
                              onClick={() => handleOpenEditModal(shift)}
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: '12px', padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Pencil size={13} color="#818cf8" />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => setDeleteShiftId(shift.id)}
                              className="btn btn-danger-subtle btn-sm"
                              style={{ fontSize: '12px', padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Trash2 size={13} />
                              <span>Remove</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* DATA LIST: MOBILE CARDS WITH ICON-ONLY ACTIONS */}
              <div className={styles.mobileCardsGrid}>
                {filteredShifts.map((shift) => (
                  <div key={shift.id} className={styles.shiftCard}>
                    <div className={styles.shiftCardHeader}>
                      <div className={styles.staffInfoRow}>
                        <StaffAvatar name={shift.staffName} size="sm" />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {shift.staffName}
                          </div>
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 800,
                              padding: '1px 5px',
                              borderRadius: '4px',
                              backgroundColor: 'rgba(99, 102, 241, 0.15)',
                              color: '#818cf8',
                              border: '1px solid rgba(99, 102, 241, 0.25)',
                              fontFamily: 'var(--font-mono)',
                            }}
                          >
                            {shift.staffId}
                          </span>
                        </div>
                      </div>

                      <span style={{ padding: '3px 8px', borderRadius: '9999px', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)', fontSize: '10.5px', fontWeight: 700, flexShrink: 0 }}>
                        ⚡ {shift.title}
                      </span>
                    </div>

                    <div className={styles.shiftCardMeta}>
                      <span style={{ color: '#cbd5e1', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={13} color="#818cf8" />
                        <span>{shift.date}</span>
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '6px', backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontWeight: 700, fontSize: '11px' }}>
                        <Clock size={11} />
                        <span>{shift.startTime} – {shift.endTime}</span>
                      </span>
                    </div>

                    {shift.notes && (
                      <div style={{ fontSize: '11px', color: '#94a3b8', background: 'rgba(0,0,0,0.3)', padding: '5px 8px', borderRadius: '6px' }}>
                        {shift.notes}
                      </div>
                    )}

                    {/* Icon-Only Action Buttons on Mobile View */}
                    <div className={styles.shiftCardActions}>
                      <button
                        onClick={() => handleOpenEditModal(shift)}
                        className={`btn btn-secondary ${styles.actionBtnIconOnly}`}
                        title="Edit Shift"
                      >
                        <Pencil size={14} color="#818cf8" />
                      </button>
                      <button
                        onClick={() => setDeleteShiftId(shift.id)}
                        className={`btn btn-danger-subtle ${styles.actionBtnIconOnly}`}
                        title="Remove Shift"
                      >
                        <Trash2 size={14} color="#f87171" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </main>
      </div>

      {/* MOBILE FILTER DRAWER BOTTOM SHEET MODAL */}
      {showFilterDrawer && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
          onClick={() => setShowFilterDrawer(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '500px',
              backgroundColor: '#0f172a',
              borderTopLeftRadius: '20px',
              borderTopRightRadius: '20px',
              border: '1px solid var(--border-medium)',
              borderBottom: 'none',
              padding: '20px',
              boxShadow: '0 -10px 40px rgba(0,0,0,0.6)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Filter size={16} color="#818cf8" />
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff', margin: 0 }}>Filter Additional Shifts</h3>
              </div>
              <button
                onClick={() => setShowFilterDrawer(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                  Filter by Staff Member
                </label>
                <select
                  value={selectedStaffFilter}
                  onChange={(e) => setSelectedStaffFilter(e.target.value)}
                  className="form-input"
                  style={{ width: '100%', height: '42px', padding: '0 12px', fontSize: '13px', color: '#ffffff', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '10px' }}
                >
                  <option value="" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>All Staff Members</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id} style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                      {s.name} ({s.staffId})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                  Filter by Specific Date
                </label>
                <input
                  type="date"
                  value={selectedDateFilter}
                  onChange={(e) => setSelectedDateFilter(e.target.value)}
                  className="form-input"
                  style={{ width: '100%', height: '42px', padding: '0 12px', fontSize: '13px', color: '#ffffff', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '10px' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => {
                  setSelectedStaffFilter('');
                  setSelectedDateFilter('');
                  setSearch('');
                  setShowFilterDrawer(false);
                }}
                className="btn btn-secondary"
                style={{ flex: 1, height: '42px', borderRadius: '10px', fontSize: '13px' }}
              >
                Reset Filters
              </button>
              <button
                onClick={() => setShowFilterDrawer(false)}
                className="btn btn-primary"
                style={{ flex: 1, height: '42px', borderRadius: '10px', fontSize: '13px' }}
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {additionalModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setAdditionalModalOpen(false)}
        >
          <div
            className="glass-card"
            style={{
              width: '100%',
              maxWidth: '540px',
              backgroundColor: '#0d121f',
              border: '1px solid var(--border-medium)',
              borderRadius: '16px',
              padding: '24px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9)',
              boxSizing: 'border-box',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fbbf24', flexShrink: 0 }}>
                  ⚡
                </div>
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                    {editingShift ? 'Edit Additional Shift' : 'Assign Additional Shift'}
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                    {editingShift ? 'Update shift timing, date, or notes' : 'Overtime or special holiday shift assignment'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAdditionalModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {modalError && (
              <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', fontSize: '12.5px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateOrUpdateShift} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Staff Member Selection */}
              <div>
                <label className="form-label" style={{ fontSize: '12px', color: '#ffffff', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                  {editingShift ? 'Staff Member *' : 'Select Staff Member(s) *'}
                </label>
                {editingShift ? (
                  <select
                    value={selectedStaffIds[0] || ''}
                    onChange={(e) => setSelectedStaffIds([e.target.value])}
                    className="form-input"
                    style={{ width: '100%', height: '42px', fontSize: '13px' }}
                  >
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id} style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                        {s.name} ({s.staffId})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid var(--border-medium)', borderRadius: '10px', padding: '8px', backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {staffList.map((s) => {
                      const isSel = selectedStaffIds.includes(s.id);
                      return (
                        <div
                          key={s.id}
                          onClick={() => {
                            if (isSel) setSelectedStaffIds(selectedStaffIds.filter((id) => id !== s.id));
                            else setSelectedStaffIds([...selectedStaffIds, s.id]);
                          }}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            backgroundColor: isSel ? 'rgba(99, 102, 241, 0.18)' : 'transparent',
                            border: `1px solid ${isSel ? 'rgba(99, 102, 241, 0.4)' : 'transparent'}`,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input type="checkbox" checked={isSel} readOnly style={{ accentColor: '#4f46e5' }} />
                            <span style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>{s.name}</span>
                          </div>
                          <span style={{ fontSize: '11px', color: '#818cf8', fontFamily: 'var(--font-mono)' }}>{s.staffId}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Preset Shift Pattern Selector */}
              {!editingShift && shiftPatterns.length > 0 && (
                <div>
                  <label className="form-label" style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Quick Fill from Shift Pattern (Optional)
                  </label>
                  <select
                    value={selectedShiftPatternId}
                    onChange={(e) => {
                      const pId = e.target.value;
                      setSelectedShiftPatternId(pId);
                      const matched = shiftPatterns.find((sp) => sp.id === pId);
                      if (matched) {
                        setAddTitle(matched.name);
                        const workDay = matched.weeklyDays?.find((w: any) => !w.isHoliday && w.startTime && w.endTime);
                        if (workDay) {
                          setAddStartTime(workDay.startTime);
                          setAddEndTime(workDay.endTime);
                        }
                      }
                    }}
                    className="form-input"
                    style={{ width: '100%', height: '40px', fontSize: '12.5px' }}
                  >
                    <option value="" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>Custom Shift Time</option>
                    {shiftPatterns.map((p) => (
                      <option key={p.id} value={p.id} style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Date Input */}
              <div>
                <label className="form-label" style={{ fontSize: '12px', color: '#ffffff', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                  Shift Date *
                </label>
                <input
                  type="date"
                  required
                  value={addDate}
                  onChange={(e) => setAddDate(e.target.value)}
                  className="form-input"
                  style={{ width: '100%', height: '42px', fontSize: '13px' }}
                />
              </div>

              {/* Start & End Time Inputs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '12px', color: '#ffffff', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                    Start Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={addStartTime}
                    onChange={(e) => setAddStartTime(e.target.value)}
                    className="form-input"
                    style={{ width: '100%', height: '42px', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '12px', color: '#ffffff', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                    End Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={addEndTime}
                    onChange={(e) => setAddEndTime(e.target.value)}
                    className="form-input"
                    style={{ width: '100%', height: '42px', fontSize: '13px' }}
                  />
                </div>
              </div>

              {/* Shift Title */}
              <div>
                <label className="form-label" style={{ fontSize: '12px', color: '#ffffff', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                  Shift Title / Description *
                </label>
                <input
                  type="text"
                  required
                  value={addTitle}
                  onChange={(e) => setAddTitle(e.target.value)}
                  placeholder="e.g. Overtime Shift, Special Duty"
                  className="form-input"
                  style={{ width: '100%', height: '42px', fontSize: '13px' }}
                />
              </div>

              {/* Notes */}
              <div>
                <label className="form-label" style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Additional Instructions / Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={addNotes}
                  onChange={(e) => setAddNotes(e.target.value)}
                  placeholder="Special instructions..."
                  className="form-input"
                  style={{ width: '100%', padding: '10px', fontSize: '12.5px', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setAdditionalModalOpen(false)}
                  className="btn btn-secondary btn-sm"
                  style={{ height: '40px', padding: '0 16px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary btn-sm"
                  style={{ backgroundColor: '#f59e0b', borderColor: '#f59e0b', color: '#000000', fontWeight: 700, height: '40px', padding: '0 20px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  {submitting ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                  <span>{submitting ? 'Saving Shift...' : editingShift ? 'Update Shift' : 'Assign Shift'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      <ConfirmationModal
        isOpen={Boolean(deleteShiftId)}
        onClose={() => setDeleteShiftId(null)}
        onConfirm={handleDeleteShift}
        title="Remove Additional Shift?"
        message="Are you sure you want to remove this assigned additional shift? This action cannot be undone."
        confirmText={deleting ? 'Removing...' : 'Remove Shift'}
        variant="danger"
      />

      <OrgAdminMobileNav organizationCode={organizationCode} />
    </div>
  );
}
