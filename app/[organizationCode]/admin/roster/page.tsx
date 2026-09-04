'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Filter,
  MapPin,
  Users,
  Clock,
  Moon,
  AlertTriangle,
  RefreshCw,
  Eye,
  Plus,
  Loader2,
  X,
} from 'lucide-react';
import { OrgAdminSidebar } from '@/components/layout/org-admin-sidebar';
import { OrgAdminMobileNav } from '@/components/layout/org-admin-mobile-nav';
import { useToast } from '@/components/feedback/toast-provider';
import { formatDateToIsoDay, Weekday } from '@/lib/shift-validation';
import styles from './Roster.module.css';

interface BranchItem {
  id: string;
  name: string;
}

interface ScheduledDay {
  date: string;
  weekday: Weekday;
  isScheduled: boolean;
  isHoliday: boolean;
  startTime: string | null;
  endTime: string | null;
  isOvernight: boolean;
  shiftPatternName?: string;
  hasOverride: boolean;
  overrideReason?: string | null;
}

interface StaffRow {
  staffId: string;
  profileId: string;
  name: string;
  phone: string;
  status: 'ACTIVE' | 'INACTIVE';
  branches: Array<{ id: string; name: string }>;
  days: ScheduledDay[];
}

interface WeeklyRosterData {
  startDate: string;
  endDate: string;
  days: Array<{ date: string; weekday: Weekday }>;
  staffRows: StaffRow[];
  summary: {
    totalStaff: number;
    scheduledCountByDay: Record<string, number>;
  };
}

const WEEKDAY_NAMES: Record<Weekday, string> = {
  MONDAY: 'Mon',
  TUESDAY: 'Tue',
  WEDNESDAY: 'Wed',
  THURSDAY: 'Thu',
  FRIDAY: 'Fri',
  SATURDAY: 'Sat',
  SUNDAY: 'Sun',
};

export default function RosterCalendarPage() {
  const params = useParams();
  const organizationCode = (params.organizationCode as string)?.toUpperCase();
  const router = useRouter();
  const toast = useToast();

  const [branding, setBranding] = useState<any>(null);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');

  // Week Navigation
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  });

  const [rosterData, setRosterData] = useState<WeeklyRosterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileSelectedDateIdx, setMobileSelectedDateIdx] = useState(0);

  useEffect(() => {
    fetchInitial();
  }, [organizationCode]);

  useEffect(() => {
    fetchRoster();
  }, [organizationCode, currentWeekStart, selectedBranchId]);

  const fetchInitial = async () => {
    try {
      const brandRes = await fetch(`/api/org/${organizationCode}/branding`);
      const brandData = await brandRes.json();
      if (brandData.success) setBranding(brandData.organization);

      const branchRes = await fetch(`/api/org/${organizationCode}/branches`);
      const branchData = await branchRes.json();
      if (branchData.success) setBranches(branchData.branches);
    } catch {}
  };

  const fetchRoster = async () => {
    try {
      setLoading(true);
      const startStr = formatDateToIsoDay(currentWeekStart);
      const sunday = new Date(currentWeekStart);
      sunday.setDate(currentWeekStart.getDate() + 6);
      const endStr = formatDateToIsoDay(sunday);

      let url = `/api/org/${organizationCode}/roster?startDate=${startStr}&endDate=${endStr}`;
      if (selectedBranchId) url += `&branchId=${selectedBranchId}`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.success && data.roster) {
        setRosterData(data.roster);
      } else {
        toast.error(data.error || 'Failed to load roster data.');
      }
    } catch {
      toast.error('Network error loading roster.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrevWeek = () => {
    const prev = new Date(currentWeekStart);
    prev.setDate(currentWeekStart.getDate() - 7);
    setCurrentWeekStart(prev);
  };

  const handleNextWeek = () => {
    const next = new Date(currentWeekStart);
    next.setDate(currentWeekStart.getDate() + 7);
    setCurrentWeekStart(next);
  };

  const handleCurrentWeek = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    setCurrentWeekStart(monday);
  };

  const weekEnd = new Date(currentWeekStart);
  weekEnd.setDate(currentWeekStart.getDate() + 6);
  const weekLabel = `${currentWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

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
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.4px' }}>
              Roster Calendar
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              View weekly shift allocations, verify minimum staffing levels, and inspect day-level overrides.
            </p>
          </div>

          <Link
            href={`/${organizationCode}/admin/shifts`}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Clock size={14} />
            <span>Manage Shift Patterns</span>
          </Link>
        </header>

        {/* Content Body */}
        <main className="pageMainContent" style={{ maxWidth: '1280px' }}>
          {/* Controls Bar: Week Navigator & Branch Filters */}
          <div className={styles.controlsBar}>
            {/* Week Navigator */}
            <div className={styles.weekNavigator}>
              <button
                onClick={handlePrevWeek}
                className="btn btn-ghost btn-sm"
                style={{ padding: '4px 8px' }}
                title="Previous Week"
              >
                <ChevronLeft size={16} />
              </button>

              <button
                onClick={handleCurrentWeek}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc', padding: '4px 10px' }}
              >
                {weekLabel}
              </button>

              <button
                onClick={handleNextWeek}
                className="btn btn-ghost btn-sm"
                style={{ padding: '4px 8px' }}
                title="Next Week"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Branch Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                <MapPin size={14} />
                <span>Branch Filter:</span>
              </div>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="form-input"
                style={{
                  height: '38px',
                  padding: '6px 32px 6px 12px',
                  fontSize: '13px',
                  minWidth: '200px',
                  color: '#ffffff',
                  backgroundColor: 'rgba(15, 23, 42, 0.9)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                }}
              >
                <option value="" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id} style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Loading */}
          {loading ? (
            <div className="glass-card" style={{ padding: '48px 24px', textAlign: 'center' }}>
              <Loader2 size={32} className="animate-spin" style={{ color: '#818cf8', margin: '0 auto 12px auto' }} />
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Calculating weekly roster matrix...</p>
            </div>
          ) : !rosterData || rosterData.staffRows.length === 0 ? (
            /* Empty State */
            <div className="glass-card" style={{ padding: '48px 24px', textAlign: 'center', maxWidth: '520px', margin: '40px auto' }}>
              <Calendar size={36} color="#818cf8" style={{ margin: '0 auto 16px auto', opacity: 0.8 }} />
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', marginBottom: '8px' }}>
                No staff assigned to shifts
              </h2>
              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.5' }}>
                Assign staff to shift patterns to generate your organization&apos;s weekly roster calendar.
              </p>
              <Link href={`/${organizationCode}/admin/shifts`} className="btn btn-primary">
                View Shift Patterns &amp; Assign Staff
              </Link>
            </div>
          ) : (
            <>
              {/* DESKTOP ROSTER GRID */}
              <div className={styles.rosterTableContainer}>
                <table className={styles.rosterTable}>
                  <thead>
                    <tr>
                      <th style={{ width: '220px' }}>Staff Member</th>
                      {rosterData.days.map((d) => (
                        <th key={d.date} style={{ textAlign: 'center' }}>
                          <div>{WEEKDAY_NAMES[d.weekday]}</div>
                          <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '2px' }}>
                            {d.date.slice(5)}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rosterData.staffRows.map((staff) => (
                      <tr key={staff.profileId}>
                        {/* Staff Member Cell */}
                        <td>
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
                            <strong style={{ color: '#ffffff', fontSize: '13.5px' }}>{staff.name}</strong>
                          </div>
                          {staff.branches.length > 0 && (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                              {staff.branches.map((b) => b.name).join(', ')}
                            </div>
                          )}
                        </td>

                        {/* 7 Days Columns */}
                        {staff.days.map((day) => {
                          const isWorking = day.isScheduled && !day.isHoliday;
                          const isHoliday = day.isScheduled && day.isHoliday;

                          return (
                            <td key={day.date} style={{ textAlign: 'center' }}>
                              <Link
                                href={`/${organizationCode}/admin/roster/${day.date}`}
                                style={{ textDecoration: 'none', display: 'inline-block' }}
                              >
                                {isWorking ? (
                                  <div
                                    className={`${styles.cellWorking} ${
                                      day.isOvernight ? styles.cellOvernight : ''
                                    } ${day.hasOverride ? styles.cellOverride : ''}`}
                                    title={day.hasOverride ? `Override: ${day.overrideReason || 'Custom Hours'}` : day.shiftPatternName}
                                  >
                                    <span>
                                      {day.startTime} – {day.endTime}
                                    </span>
                                    {day.isOvernight && (
                                      <span style={{ fontSize: '9px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                        <Moon size={9} />
                                        <span>Overnight</span>
                                      </span>
                                    )}
                                    {day.hasOverride && <span className={styles.overrideTag}>Override</span>}
                                  </div>
                                ) : isHoliday ? (
                                  <div className={`${styles.cellHoliday} ${day.hasOverride ? styles.cellOverride : ''}`}>
                                    <span>HOLIDAY</span>
                                    {day.hasOverride && <span className={styles.overrideTag}>Override</span>}
                                  </div>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>—</span>
                                )}
                              </Link>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* MOBILE RESPONSIVE ROSTER */}
              <div className={styles.mobileRosterContainer}>
                {/* Horizontal Day Tabs */}
                <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
                  {rosterData.days.map((d, idx) => {
                    const isSelected = mobileSelectedDateIdx === idx;
                    return (
                      <button
                        key={d.date}
                        onClick={() => setMobileSelectedDateIdx(idx)}
                        style={{
                          flex: 1,
                          minWidth: '60px',
                          padding: '8px 4px',
                          borderRadius: '8px',
                          border: isSelected ? '1px solid #4f46e5' : '1px solid var(--border-subtle)',
                          backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.2)' : 'rgba(13, 18, 31, 0.8)',
                          color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '2px',
                          cursor: 'pointer',
                        }}
                      >
                        <span style={{ fontSize: '11px', fontWeight: 700 }}>{WEEKDAY_NAMES[d.weekday]}</span>
                        <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)' }}>{d.date.slice(8)}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Selected Day Cards */}
                {rosterData.days[mobileSelectedDateIdx] && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>
                        {WEEKDAY_NAMES[rosterData.days[mobileSelectedDateIdx].weekday]},{' '}
                        {rosterData.days[mobileSelectedDateIdx].date}
                      </h3>
                      <Link
                        href={`/${organizationCode}/admin/roster/${rosterData.days[mobileSelectedDateIdx].date}`}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '11px', padding: '4px 8px' }}
                      >
                        Day Breakdown
                      </Link>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {rosterData.staffRows.map((staff) => {
                        const daySchedule = staff.days[mobileSelectedDateIdx];
                        if (!daySchedule) return null;

                        return (
                          <div
                            key={staff.profileId}
                            className="glass-card"
                            style={{
                              padding: '14px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#818cf8', fontWeight: 700 }}>
                                  {staff.staffId}
                                </span>
                                <strong style={{ color: '#ffffff', fontSize: '13.5px' }}>{staff.name}</strong>
                              </div>
                              {staff.branches.length > 0 && (
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                  {staff.branches.map((b) => b.name).join(', ')}
                                </div>
                              )}
                            </div>

                            <div>
                              {daySchedule.isScheduled && !daySchedule.isHoliday ? (
                                <span className={styles.cellWorking}>
                                  {daySchedule.startTime} – {daySchedule.endTime}
                                </span>
                              ) : daySchedule.isScheduled && daySchedule.isHoliday ? (
                                <span className={styles.cellHoliday}>HOLIDAY</span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No Shift</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {/* Mobile Nav */}
      <OrgAdminMobileNav organizationCode={organizationCode} />
    </div>
  );
}
