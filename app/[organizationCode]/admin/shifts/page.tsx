'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Clock,
  Plus,
  Search,
  Users,
  Power,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  Moon,
  Calendar,
  Filter,
  X,
  Loader2,
  Menu,
} from 'lucide-react';
import { OrgAdminSidebar } from '@/components/layout/org-admin-sidebar';
import { OrgAdminMobileNav } from '@/components/layout/org-admin-mobile-nav';
import { useToast } from '@/components/feedback/toast-provider';
import { ConfirmationModal } from '@/components/feedback/confirmation-modal';
import styles from './ShiftManagement.module.css';

interface WeeklyDayItem {
  id: string;
  weekday: string;
  isHoliday: boolean;
  startTime: string | null;
  endTime: string | null;
  isOvernight: boolean;
}

interface ShiftPatternItem {
  id: string;
  name: string;
  description: string | null;
  minimumStaffingThreshold: number;
  isActive: boolean;
  createdAt: string;
  assignedStaffCount: number;
  weeklyDays: WeeklyDayItem[];
}

interface OrgBranding {
  id: string;
  name: string;
  logoUrl: string | null;
  organizationCode: string;
}

const WEEKDAY_MAP: Record<string, string> = {
  MONDAY: 'Mon',
  TUESDAY: 'Tue',
  WEDNESDAY: 'Wed',
  THURSDAY: 'Thu',
  FRIDAY: 'Fri',
  SATURDAY: 'Sat',
  SUNDAY: 'Sun',
};

import { OrgAdminHeader } from '@/components/layout/org-admin-header';

export default function ShiftPatternsPage() {
  const params = useParams();
  const organizationCode = (params.organizationCode as string)?.toUpperCase();
  const router = useRouter();
  const toast = useToast();

  const [branding, setBranding] = useState<OrgBranding | null>(null);
  const [patterns, setPatterns] = useState<ShiftPatternItem[]>([]);
  const [counts, setCounts] = useState({ total: 0, active: 0, inactive: 0 });
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [search, setSearch] = useState('');
  const [togglePattern, setTogglePattern] = useState<ShiftPatternItem | null>(null);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  // Additional Shift Modal & Data State
  const [additionalModalOpen, setAdditionalModalOpen] = useState(false);
  const [staffList, setStaffList] = useState<{ id: string; name: string; staffId: string }[]>([]);
  const [additionalShifts, setAdditionalShifts] = useState<any[]>([]);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [addDate, setAddDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [addStartTime, setAddStartTime] = useState('11:00');
  const [addEndTime, setAddEndTime] = useState('16:00');
  const [addTitle, setAddTitle] = useState('Overtime Shift');
  const [addNotes, setAddNotes] = useState('');
  const [submittingAdditional, setSubmittingAdditional] = useState(false);
  const [additionalError, setAdditionalError] = useState<string | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, [organizationCode]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      setHasError(false);
      const [brandRes, shiftRes, staffRes, addRes] = await Promise.all([
        fetch(`/api/org/${organizationCode}/branding`),
        fetch(`/api/org/${organizationCode}/shift-patterns`),
        fetch(`/api/org/${organizationCode}/staff`),
        fetch(`/api/org/${organizationCode}/shifts/additional`),
      ]);

      const brandData = await brandRes.json();
      if (brandData.success) {
        setBranding(brandData.organization);
      }

      const data = await shiftRes.json();
      if (data.success) {
        setPatterns(data.shiftPatterns);
        setCounts(data.counts);
      } else {
        setHasError(true);
        toast.error(data.error || 'Failed to load shift patterns.');
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

      const addData = await addRes.json();
      if (addData.success && Array.isArray(addData.additionalShifts)) {
        setAdditionalShifts(addData.additionalShifts);
      }
    } catch {
      setHasError(true);
      toast.error('Network error loading shift patterns.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAdditionalShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdditionalError(null);

    if (selectedStaffIds.length === 0) {
      setAdditionalError('Please select at least one staff member.');
      return;
    }
    if (!addDate || !addStartTime || !addEndTime) {
      setAdditionalError('Please specify date, start time, and end time.');
      return;
    }

    try {
      setSubmittingAdditional(true);
      const res = await fetch(`/api/org/${organizationCode}/shifts/additional`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffProfileIds: selectedStaffIds,
          date: addDate,
          startTime: addStartTime,
          endTime: addEndTime,
          title: addTitle.trim() || 'Overtime Shift',
          notes: addNotes.trim() || null,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || 'Additional shift assigned successfully!');
        setAdditionalModalOpen(false);
        setSelectedStaffIds([]);
        setAddNotes('');
        fetchInitialData();
      } else {
        setAdditionalError(data.error || 'Failed to assign additional shift.');
        toast.error(data.error || 'Intersection or validation error.');
      }
    } catch {
      setAdditionalError('Network connection error.');
      toast.error('Network error.');
    } finally {
      setSubmittingAdditional(false);
    }
  };

  const handleDeleteAdditionalShift = async (id: string) => {
    try {
      const res = await fetch(`/api/org/${organizationCode}/shifts/additional?id=${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Additional shift removed.');
        fetchInitialData();
      } else {
        toast.error(data.error || 'Failed to remove additional shift.');
      }
    } catch {
      toast.error('Network error removing shift.');
    }
  };

  const handleToggleActive = async () => {
    if (!togglePattern) return;
    try {
      setToggleLoading(true);
      const res = await fetch(
        `/api/org/${organizationCode}/shift-patterns/${togglePattern.id}/deactivate`,
        { method: 'POST' }
      );
      const data = await res.json();
      if (data.success) {
        toast.success(
          togglePattern.isActive
            ? 'Shift pattern deactivated.'
            : 'Shift pattern activated.'
        );
        setTogglePattern(null);
        fetchInitialData();
      } else {
        toast.error(data.error || 'Failed to update shift pattern status.');
      }
    } catch {
      toast.error('Network error updating status.');
    } finally {
      setToggleLoading(false);
    }
  };

  const filteredPatterns = patterns.filter((p) => {
    if (filter === 'ACTIVE' && !p.isActive) return false;
    if (filter === 'INACTIVE' && p.isActive) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className={styles.container}>
      {/* Sidebar */}
      <OrgAdminSidebar
        organizationCode={organizationCode}
        organizationName={branding?.name || 'Organization'}
        logoUrl={branding?.logoUrl}
        shiftPatternCount={counts.total}
      />

      {/* Main Content */}
      <div className={styles.mainContent}>
        {/* Header */}
        <OrgAdminHeader
          organizationCode={organizationCode}
          logoUrl={branding?.logoUrl}
          panelTitle="Shifts & Roster"
          panelSubtitle="Create recurring schedules, assign staff, and manage workforce coverage."
          headerMenuOpen={headerMenuOpen}
          onToggleHeaderMenu={() => setHeaderMenuOpen(!headerMenuOpen)}
        >
          {headerMenuOpen && (
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 999 }}
                onClick={() => setHeaderMenuOpen(false)}
              />
              <div
                className="glass-card"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 8px)',
                  zIndex: 1000,
                  minWidth: '210px',
                  padding: '6px',
                  backgroundColor: '#0d121f',
                  border: '1px solid var(--border-medium)',
                  borderRadius: '12px',
                  boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.8)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setHeaderMenuOpen(false);
                    setAdditionalModalOpen(true);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    color: '#fbbf24',
                    border: 'none',
                    backgroundColor: 'rgba(245, 158, 11, 0.15)',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    width: '100%',
                    textAlign: 'left',
                  }}
                >
                  <Plus size={15} color="#fbbf24" />
                  <span>⚡ Assign Additional Shift</span>
                </button>

                <Link
                  href={`/${organizationCode}/admin/shifts/new`}
                  onClick={() => setHeaderMenuOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    color: '#ffffff',
                    textDecoration: 'none',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  <Plus size={15} color="#818cf8" />
                  <span>Create Shift Pattern</span>
                </Link>

                <Link
                  href={`/${organizationCode}/admin/shifts/swaps`}
                  onClick={() => setHeaderMenuOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    color: '#cbd5e1',
                    textDecoration: 'none',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  <RefreshCw size={15} color="#38bdf8" />
                  <span>Shift Swaps &amp; Substitutions</span>
                </Link>

                <Link
                  href={`/${organizationCode}/admin/shifts/roster`}
                  onClick={() => setHeaderMenuOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    color: '#cbd5e1',
                    textDecoration: 'none',
                    fontSize: '13px',
                    fontWeight: 500,
                  }}
                >
                  <Calendar size={15} color="#38bdf8" />
                  <span>View Roster Calendar</span>
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setHeaderMenuOpen(false);
                    fetchInitialData();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    color: '#cbd5e1',
                    border: 'none',
                    background: 'none',
                    width: '100%',
                    textAlign: 'left',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  <RefreshCw size={15} color="#34d399" className={loading ? 'animate-spin' : ''} />
                  <span>Refresh Shifts</span>
                </button>
              </div>
            </>
          )}
        </OrgAdminHeader>

        {/* Content Body */}
        <main className="pageMainContent" style={{ maxWidth: '1240px' }}>
          {/* Filter & Search Bar */}
          <div className={styles.filterBar}>
            {/* Search Input with Pinned Filter Icon (Staff Panel Style) */}
            <div className={styles.searchInputWrapper}>
              <Search size={15} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search shift pattern name or rules..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={styles.searchInput}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  style={{ position: 'absolute', right: '40px', top: '9px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <X size={14} />
                </button>
              )}
              <button
                type="button"
                onClick={() => setFilterDrawerOpen(!filterDrawerOpen)}
                className={styles.filterToggleBtn}
                title="Toggle Filters"
              >
                <Filter size={15} color={filter !== 'ALL' ? '#818cf8' : 'currentColor'} />
              </button>
            </div>

            {/* Filter Tabs (Collapsible on Mobile) */}
            <div className={`${styles.tabGroup} ${filterDrawerOpen ? styles.tabGroupOpen : ''}`}>
              {[
                { id: 'ALL', label: `All Patterns (${counts.total})` },
                { id: 'ACTIVE', label: `Active (${counts.active})` },
                { id: 'INACTIVE', label: `Inactive (${counts.inactive})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setFilter(tab.id as any);
                    setFilterDrawerOpen(false);
                  }}
                  className={`${styles.tabButton} ${filter === tab.id ? styles.tabButtonActive : ''}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* ERROR STATE */}
          {hasError && !loading && (
            <div className="glass-card" style={{ padding: '40px', textAlign: 'center', margin: '20px 0' }}>
              <AlertCircle size={36} color="var(--danger-text)" style={{ margin: '0 auto 12px auto' }} />
              <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#ffffff' }}>Unable to load shift patterns</h3>
              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginTop: '4px', marginBottom: '20px' }}>
                There was an error communicating with the scheduling server.
              </p>
              <button onClick={fetchInitialData} className="btn btn-primary btn-sm">Try Again</button>
            </div>
          )}

          {/* LOADING SKELETON */}
          {loading && (
            <div className="glass-card" style={{ padding: '48px 24px', textAlign: 'center' }}>
              <Loader2 size={32} className="animate-spin" style={{ color: '#818cf8', margin: '0 auto 12px auto' }} />
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Loading shift patterns...</p>
            </div>
          )}

          {/* EMPTY STATE - NO SHIFT PATTERN YET */}
          {!loading && !hasError && patterns.length === 0 && (
            <div className="glass-card" style={{ padding: '48px 24px', textAlign: 'center', maxWidth: '520px', margin: '40px auto' }}>
              <Clock size={40} color="#818cf8" style={{ margin: '0 auto 16px auto', opacity: 0.8 }} />
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', marginBottom: '8px' }}>
                No shift patterns yet
              </h2>
              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '24px' }}>
                Create a shift pattern to start building your organization&apos;s roster and assigning staff schedules.
              </p>
              <Link href={`/${organizationCode}/admin/shifts/new`} className="btn btn-primary">
                + Create Shift
              </Link>
            </div>
          )}

          {/* EMPTY STATE - NO SEARCH RESULTS */}
          {!loading && !hasError && patterns.length > 0 && filteredPatterns.length === 0 && (
            <div className="glass-card" style={{ padding: '40px 24px', textAlign: 'center' }}>
              <Search size={32} color="var(--text-muted)" style={{ margin: '0 auto 12px auto' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>No shift patterns match your search</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', marginBottom: '16px' }}>
                Try searching for a different shift pattern name or description.
              </p>
              <button onClick={() => { setSearch(''); setFilter('ALL'); }} className="btn btn-secondary btn-sm">Clear Filters</button>
            </div>
          )}

          {/* SHIFT PATTERNS GRID */}
          {!loading && !hasError && filteredPatterns.length > 0 && (
            <div className={styles.patternGrid}>
              {filteredPatterns.map((pattern) => (
                <div
                  key={pattern.id}
                  className={`glass-card ${styles.patternCard} ${!pattern.isActive ? styles.patternCardInactive : ''}`}
                >
                  <div>
                    {/* Pattern Header */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '6px' }}>
                      <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#ffffff' }}>
                        {pattern.name}
                      </h3>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '9999px',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: pattern.isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: pattern.isActive ? '#34d399' : '#f87171',
                          border: `1px solid ${pattern.isActive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                        }}
                      >
                        {pattern.isActive ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </div>

                    {pattern.description && (
                      <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: '1.4' }}>
                        {pattern.description}
                      </p>
                    )}

                    {/* 7-Day Schedule Pills */}
                    <div className={styles.daysGrid}>
                      {['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'].map((wDay) => {
                        const dayConfig = pattern.weeklyDays.find((d) => d.weekday === wDay);
                        const isHol = !dayConfig || dayConfig.isHoliday;
                        const isOver = dayConfig?.isOvernight;

                        return (
                          <div
                            key={wDay}
                            className={`${styles.dayPill} ${
                              isHol
                                ? styles.dayPillHoliday
                                : isOver
                                ? styles.dayPillOvernight
                                : styles.dayPillWorking
                            }`}
                          >
                            <span>{WEEKDAY_MAP[wDay]}</span>
                            {!isHol && dayConfig?.startTime && dayConfig?.endTime ? (
                              <span className={styles.timeTag}>
                                {dayConfig.startTime.slice(0, 5)}
                              </span>
                            ) : (
                              <span style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>Off</span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Minimum Staffing & Staff Count Badges */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                      <div className={styles.thresholdBadge}>
                        <ShieldCheck size={14} color="#38bdf8" />
                        <span>Min Staff Required: <strong>{pattern.minimumStaffingThreshold}</strong></span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        <Users size={14} color="#818cf8" />
                        <span><strong>{pattern.assignedStaffCount}</strong> assigned</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: '14px',
                      marginTop: '14px',
                      borderTop: '1px solid var(--border-subtle)',
                    }}
                  >
                    <button
                      onClick={() => setTogglePattern(pattern)}
                      className={`btn btn-sm ${pattern.isActive ? 'btn-danger-subtle' : 'btn-success-subtle'}`}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Power size={13} />
                      <span>{pattern.isActive ? 'Deactivate' : 'Activate'}</span>
                    </button>

                    <Link
                      href={`/${organizationCode}/admin/shifts/${pattern.id}`}
                      className="btn btn-secondary btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <span>Manage Pattern</span>
                      <ChevronRight size={14} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ACTIVE ADDITIONAL SHIFTS LIST SECTION */}
          {additionalShifts.length > 0 && (
            <div style={{ marginTop: '40px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#fbbf24' }}>⚡</span>
                    <span>Assigned Additional Shifts ({additionalShifts.length})</span>
                  </h2>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Overtime and special holiday shift assignments for staff members.
                  </p>
                </div>
                <button
                  onClick={() => setAdditionalModalOpen(true)}
                  className="btn btn-primary btn-sm"
                  style={{ backgroundColor: '#f59e0b', borderColor: '#f59e0b', color: '#000000', fontWeight: 700 }}
                >
                  + Assign Additional Shift
                </button>
              </div>

              <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-medium)', backgroundColor: 'rgba(15, 23, 42, 0.6)' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', color: '#94a3b8', fontWeight: 700 }}>Staff Member</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', color: '#94a3b8', fontWeight: 700 }}>Date</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', color: '#94a3b8', fontWeight: 700 }}>Shift Hours</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', color: '#94a3b8', fontWeight: 700 }}>Shift Title</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', color: '#94a3b8', fontWeight: 700 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {additionalShifts.map((shift) => (
                      <tr key={shift.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 700, color: '#ffffff' }}>{shift.staffName}</div>
                          <div style={{ fontSize: '11.5px', color: '#818cf8', fontFamily: 'var(--font-mono)' }}>{shift.staffId}</div>
                        </td>
                        <td style={{ padding: '14px 16px', color: '#f1f5f9', fontWeight: 600 }}>{shift.date}</td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontWeight: 700, fontSize: '12px' }}>
                            <Clock size={12} />
                            <span>{shift.startTime} – {shift.endTime}</span>
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: '9999px', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)', fontSize: '11px', fontWeight: 700 }}>
                            {shift.title}
                          </span>
                          {shift.notes && <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '3px' }}>{shift.notes}</div>}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          <button
                            onClick={() => handleDeleteAdditionalShift(shift.id)}
                            className="btn btn-danger-subtle btn-sm"
                            style={{ fontSize: '11.5px', padding: '4px 10px' }}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ASSIGN ADDITIONAL SHIFT MODAL */}
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
        >
          <div
            className="glass-card"
            style={{
              width: '100%',
              maxWidth: '560px',
              backgroundColor: '#0d121f',
              border: '1px solid var(--border-medium)',
              borderRadius: '16px',
              padding: '28px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fbbf24' }}>
                  ⚡
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', margin: 0 }}>Assign Additional Shift</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>Overtime or special holiday shift assignment</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAdditionalModalOpen(false);
                  setAdditionalError(null);
                }}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {additionalError && (
              <div
                style={{
                  backgroundColor: 'rgba(244, 63, 94, 0.15)',
                  border: '1px solid rgba(244, 63, 94, 0.3)',
                  color: '#fb7185',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>{additionalError}</div>
              </div>
            )}

            <form onSubmit={handleCreateAdditionalShift} noValidate>
              {/* Target Staff Selection */}
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label className="form-label" style={{ margin: 0 }}>
                    Select Staff Member(s)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedStaffIds.length === staffList.length) {
                        setSelectedStaffIds([]);
                      } else {
                        setSelectedStaffIds(staffList.map((s) => s.id));
                      }
                    }}
                    style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    {selectedStaffIds.length === staffList.length ? 'Deselect All' : `Select All (${staffList.length})`}
                  </button>
                </div>

                <div
                  style={{
                    maxHeight: '140px',
                    overflowY: 'auto',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(15, 23, 42, 0.5)',
                    padding: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  {staffList.map((staff) => {
                    const isSelected = selectedStaffIds.includes(staff.id);
                    return (
                      <label
                        key={staff.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                          cursor: 'pointer',
                          fontSize: '13px',
                          color: '#ffffff',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedStaffIds([...selectedStaffIds, staff.id]);
                            } else {
                              setSelectedStaffIds(selectedStaffIds.filter((id) => id !== staff.id));
                            }
                          }}
                          style={{ accentColor: '#6366f1', width: '16px', height: '16px' }}
                        />
                        <span style={{ fontWeight: 600 }}>{staff.name}</span>
                        <span style={{ color: '#818cf8', fontSize: '11.5px', fontFamily: 'var(--font-mono)' }}>({staff.staffId})</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Target Date */}
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label" htmlFor="addDate">
                  Shift Target Date
                </label>
                <input
                  id="addDate"
                  type="date"
                  value={addDate}
                  onChange={(e) => setAddDate(e.target.value)}
                  className="form-input"
                  required
                />
              </div>

              {/* Time Interval Inputs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" htmlFor="addStartTime">
                    Start Time
                  </label>
                  <input
                    id="addStartTime"
                    type="time"
                    value={addStartTime}
                    onChange={(e) => setAddStartTime(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" htmlFor="addEndTime">
                    End Time
                  </label>
                  <input
                    id="addEndTime"
                    type="time"
                    value={addEndTime}
                    onChange={(e) => setAddEndTime(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>
              </div>

              {/* Shift Title / Reason */}
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label" htmlFor="addTitle">
                  Shift Title / Classification
                </label>
                <input
                  id="addTitle"
                  type="text"
                  placeholder="e.g. Overtime Shift, Holiday Duty"
                  value={addTitle}
                  onChange={(e) => setAddTitle(e.target.value)}
                  className="form-input"
                  required
                />
              </div>

              {/* Notes */}
              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label" htmlFor="addNotes">
                  Additional Notes (Included in email notification)
                </label>
                <textarea
                  id="addNotes"
                  placeholder="e.g. Special coverage for event."
                  value={addNotes}
                  onChange={(e) => setAddNotes(e.target.value)}
                  className="form-input"
                  rows={2}
                  style={{ resize: 'vertical' }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setAdditionalModalOpen(false)}
                  className="btn btn-secondary"
                  disabled={submittingAdditional}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAdditional || selectedStaffIds.length === 0}
                  className="btn btn-primary"
                  style={{ backgroundColor: '#f59e0b', borderColor: '#f59e0b', color: '#000000', fontWeight: 700 }}
                >
                  {submittingAdditional ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Validating &amp; Assigning...</span>
                    </>
                  ) : (
                    <span>Assign Shift ({selectedStaffIds.length} Selected)</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={Boolean(togglePattern)}
        onClose={() => setTogglePattern(null)}
        onConfirm={handleToggleActive}
        title={togglePattern?.isActive ? 'Deactivate shift pattern?' : 'Activate shift pattern?'}
        message={
          togglePattern?.isActive
            ? `Deactivating "${togglePattern?.name}" prevents new staff assignments. Existing historical roster and attendance assignments will NOT be erased.`
            : `Reactivating "${togglePattern?.name}" will allow this pattern to be assigned to staff members for new schedules.`
        }
        confirmText={togglePattern?.isActive ? 'Deactivate Pattern' : 'Activate Pattern'}
        variant={togglePattern?.isActive ? 'danger' : 'primary'}
      />

      {/* Mobile Navigation */}
      <OrgAdminMobileNav organizationCode={organizationCode} />
    </div>
  );
}
