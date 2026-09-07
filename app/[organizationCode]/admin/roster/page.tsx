'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  Menu,
  Search,
  CalendarDays,
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

import { OrgAdminHeader } from '@/components/layout/org-admin-header';

export default function RosterCalendarPage() {
  const params = useParams();
  const organizationCode = (params.organizationCode as string)?.toUpperCase();
  const router = useRouter();
  const toast = useToast();

  const [branding, setBranding] = useState<any>(null);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [showMobileFilters, setShowMobileFilters] = useState<boolean>(false);

  // Header Menu Dropdown & Outside Click Handling
  const [headerMenuOpen, setHeaderMenuOpen] = useState<boolean>(false);
  const headerMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node)) {
        setHeaderMenuOpen(false);
      }
    };
    if (headerMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [headerMenuOpen]);

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

  // Filtered Staff Rows for Search Query
  const filteredStaffRows = rosterData?.staffRows.filter((staff) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return (
      staff.name.toLowerCase().includes(query) ||
      staff.staffId.toLowerCase().includes(query)
    );
  }) || [];

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
        {/* Mobile-Optimized Header */}
        <OrgAdminHeader
          organizationCode={organizationCode}
          logoUrl={branding?.logoUrl}
          panelTitle="Roster Calendar"
          panelSubtitle="Weekly shift allocations & day overrides"
          headerMenuOpen={headerMenuOpen}
          onToggleHeaderMenu={() => setHeaderMenuOpen(!headerMenuOpen)}
        >
          {headerMenuOpen && (
            <div
              className={styles.headerMenuDropdown}
              style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 8px)',
                width: '220px',
                backgroundColor: '#0f172a',
                border: '1px solid var(--border-medium, rgba(255,255,255,0.15))',
                borderRadius: '12px',
                padding: '8px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <Link
                href={`/${organizationCode}/admin/shifts`}
                className="btn btn-ghost btn-sm"
                style={{ justifyContent: 'flex-start', gap: '8px', width: '100%', textDecoration: 'none', color: '#f8fafc', fontSize: '12.5px' }}
                onClick={() => setHeaderMenuOpen(false)}
              >
                <Clock size={15} color="#818cf8" />
                <span>Manage Shift Patterns</span>
              </Link>
              <button
                onClick={() => {
                  setHeaderMenuOpen(false);
                  fetchRoster();
                }}
                className="btn btn-ghost btn-sm"
                style={{ justifyContent: 'flex-start', gap: '8px', width: '100%', color: '#f8fafc', fontSize: '12.5px' }}
              >
                <RefreshCw size={15} color="#10b981" />
                <span>Refresh Roster Data</span>
              </button>
              <Link
                href={`/${organizationCode}/admin/attendance/daily`}
                className="btn btn-ghost btn-sm"
                style={{ justifyContent: 'flex-start', gap: '8px', width: '100%', textDecoration: 'none', color: '#f8fafc', fontSize: '12.5px' }}
                onClick={() => setHeaderMenuOpen(false)}
              >
                <CalendarDays size={15} color="#38bdf8" />
                <span>Daily Attendance</span>
              </Link>
            </div>
          )}
        </OrgAdminHeader>

        {/* Content Body */}
        <main className="pageMainContent" style={{ maxWidth: '1280px' }}>
          {/* Controls Bar: Week Navigator, Search & Branch Filters */}
          <div className={styles.controlsBar}>
            {/* Week Navigator */}
            <div className={styles.weekNavigator}>
              <button
                onClick={handlePrevWeek}
                className="btn btn-ghost btn-sm"
                style={{ padding: '5px 8px' }}
                title="Previous Week"
              >
                <ChevronLeft size={16} />
              </button>

              <button
                onClick={handleCurrentWeek}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: '12.5px', fontWeight: 700, color: '#f8fafc', padding: '5px 8px' }}
              >
                {weekLabel}
              </button>

              <button
                onClick={handleNextWeek}
                className="btn btn-ghost btn-sm"
                style={{ padding: '5px 8px' }}
                title="Next Week"
              >
                <ChevronRight size={16} />
              </button>

              <button
                onClick={handleCurrentWeek}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', marginLeft: '2px' }}
              >
                Today
              </button>
            </div>

            {/* Filters Bar: Search & Branch */}
            <div className={styles.filterSection}>
              {/* Search Bar with Pinned Filter Icon (Staff Panel Style) */}
              <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
                <Search
                  size={15}
                  style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}
                />
                <input
                  type="text"
                  placeholder="Search staff name or ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="form-input"
                  style={{
                    height: '38px',
                    paddingLeft: '36px',
                    paddingRight: '42px',
                    fontSize: '13px',
                    width: '100%',
                    backgroundColor: 'rgba(15, 23, 42, 0.85)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    boxSizing: 'border-box',
                  }}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    style={{
                      position: 'absolute',
                      right: '40px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '2px',
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMobileFilters((prev) => !prev);
                  }}
                  style={{
                    position: 'absolute',
                    right: '5px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '30px',
                    height: '30px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '6px',
                    background: selectedBranchId ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                    border: selectedBranchId ? '1px solid rgba(99, 102, 241, 0.5)' : '1px solid var(--border-medium, rgba(255, 255, 255, 0.12))',
                    color: selectedBranchId ? '#818cf8' : '#ffffff',
                    cursor: 'pointer',
                    zIndex: 10,
                    touchAction: 'manipulation',
                  }}
                  title="Toggle Filters"
                >
                  <Filter size={15} color={selectedBranchId ? '#818cf8' : 'currentColor'} style={{ pointerEvents: 'none' }} />
                </button>
              </div>

              {/* Desktop Branch Filter Dropdown */}
              <div className={styles.desktopBranchFilter} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ position: 'relative', width: '100%' }}>
                  <MapPin
                    size={14}
                    style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#818cf8', pointerEvents: 'none' }}
                  />
                  <select
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    className="form-input"
                    style={{
                      height: '38px',
                      padding: '4px 28px 4px 30px',
                      fontSize: '12.5px',
                      minWidth: '160px',
                      color: '#ffffff',
                      backgroundColor: 'rgba(15, 23, 42, 0.85)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: '8px',
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
            </div>

            {/* Mobile Filter Sheet Modal */}
            {showMobileFilters && (
              <div
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0,0,0,0.65)',
                  backdropFilter: 'blur(4px)',
                  zIndex: 1100,
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                }}
                onClick={() => setShowMobileFilters(false)}
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
                    boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Filter size={16} color="#818cf8" />
                      <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff', margin: 0 }}>Roster Filters</h3>
                    </div>
                    <button
                      onClick={() => setShowMobileFilters(false)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                        Branch Location
                      </label>
                      <select
                        value={selectedBranchId}
                        onChange={(e) => setSelectedBranchId(e.target.value)}
                        className="form-input"
                        style={{
                          width: '100%',
                          height: '40px',
                          padding: '0 12px',
                          fontSize: '13px',
                          color: '#ffffff',
                          backgroundColor: 'rgba(255,255,255,0.05)',
                          border: '1px solid var(--border-medium)',
                          borderRadius: '10px',
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

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => {
                        setSelectedBranchId('');
                        setShowMobileFilters(false);
                      }}
                      className="btn btn-secondary"
                      style={{ flex: 1, height: '42px', borderRadius: '10px', fontSize: '13px' }}
                    >
                      Reset Filters
                    </button>
                    <button
                      onClick={() => setShowMobileFilters(false)}
                      className="btn btn-primary"
                      style={{ flex: 1, height: '42px', borderRadius: '10px', fontSize: '13px' }}
                    >
                      Apply Filters
                    </button>
                  </div>
                </div>
              </div>
            )}
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
                    {filteredStaffRows.map((staff) => (
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
                {/* Horizontal Day Selector Tabs */}
                <div className={styles.dayTabsContainer}>
                  {rosterData.days.map((d, idx) => {
                    const isSelected = mobileSelectedDateIdx === idx;
                    const scheduledCount = rosterData.summary.scheduledCountByDay[d.date] || 0;
                    return (
                      <button
                        key={d.date}
                        onClick={() => setMobileSelectedDateIdx(idx)}
                        className={`${styles.dayTab} ${isSelected ? styles.dayTabSelected : ''}`}
                      >
                        <span style={{ fontSize: '10.5px', fontWeight: 800, textTransform: 'uppercase', color: isSelected ? '#a5b4fc' : 'var(--text-muted)' }}>
                          {WEEKDAY_NAMES[d.weekday]}
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                          {d.date.slice(8)}
                        </span>
                        {scheduledCount > 0 && (
                          <span
                            style={{
                              fontSize: '9.5px',
                              fontWeight: 700,
                              padding: '1px 5px',
                              borderRadius: '10px',
                              backgroundColor: isSelected ? '#4f46e5' : 'rgba(255,255,255,0.1)',
                              color: '#ffffff',
                              marginTop: '2px',
                            }}
                          >
                            {scheduledCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Selected Day Breakdown Cards */}
                {rosterData.days[mobileSelectedDateIdx] && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div>
                        <h3 style={{ fontSize: '14.5px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                          {WEEKDAY_NAMES[rosterData.days[mobileSelectedDateIdx].weekday]},{' '}
                          {rosterData.days[mobileSelectedDateIdx].date}
                        </h3>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {rosterData.summary.scheduledCountByDay[rosterData.days[mobileSelectedDateIdx].date] || 0} Scheduled Staff
                        </span>
                      </div>
                      <Link
                        href={`/${organizationCode}/admin/roster/${rosterData.days[mobileSelectedDateIdx].date}`}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '11px', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px', borderRadius: '6px' }}
                      >
                        <Eye size={12} />
                        <span>Day Breakdown</span>
                      </Link>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {filteredStaffRows.length === 0 ? (
                        <div className="glass-card" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                          No matching staff found for &quot;{search}&quot;.
                        </div>
                      ) : (
                        filteredStaffRows.map((staff) => {
                          const daySchedule = staff.days[mobileSelectedDateIdx];
                          if (!daySchedule) return null;

                          return (
                            <div
                              key={staff.profileId}
                              className="glass-card"
                              style={{
                                padding: '12px 14px',
                                borderRadius: '10px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '10px',
                              }}
                            >
                              {/* Staff Info */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                {/* Line 1: Name + Staff ID */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                  <strong style={{ color: '#ffffff', fontSize: '13.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {staff.name}
                                  </strong>
                                  <span
                                    style={{
                                      fontFamily: 'var(--font-mono)',
                                      fontSize: '10.5px',
                                      fontWeight: 800,
                                      padding: '1px 6px',
                                      borderRadius: '4px',
                                      backgroundColor: 'rgba(99, 102, 241, 0.15)',
                                      color: '#818cf8',
                                      border: '1px solid rgba(99, 102, 241, 0.25)',
                                    }}
                                  >
                                    {staff.staffId}
                                  </span>
                                </div>

                                {/* Line 2: Branch Info */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                                  <MapPin size={11} style={{ flexShrink: 0 }} />
                                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {staff.branches.length > 0 ? staff.branches.map((b) => b.name).join(', ') : 'All Branches'}
                                  </span>
                                </div>
                              </div>

                              {/* Line 3 / Right: Shift Details */}
                              <div style={{ flexShrink: 0, textAlign: 'right' }}>
                                <Link
                                  href={`/${organizationCode}/admin/roster/${daySchedule.date}`}
                                  style={{ textDecoration: 'none' }}
                                >
                                  {daySchedule.isScheduled && !daySchedule.isHoliday ? (
                                    <div className={`${styles.cellWorking} ${daySchedule.isOvernight ? styles.cellOvernight : ''} ${daySchedule.hasOverride ? styles.cellOverride : ''}`}>
                                      <span style={{ fontSize: '11.5px', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                                        {daySchedule.startTime} – {daySchedule.endTime}
                                      </span>
                                      {daySchedule.isOvernight && (
                                        <span style={{ fontSize: '9px', display: 'flex', alignItems: 'center', gap: '2px', justifyContent: 'flex-end', marginTop: '1px' }}>
                                          <Moon size={9} />
                                          <span>Overnight</span>
                                        </span>
                                      )}
                                      {daySchedule.hasOverride && <span className={styles.overrideTag}>Override</span>}
                                    </div>
                                  ) : daySchedule.isScheduled && daySchedule.isHoliday ? (
                                    <div className={`${styles.cellHoliday} ${daySchedule.hasOverride ? styles.cellOverride : ''}`}>
                                      <span>HOLIDAY</span>
                                      {daySchedule.hasOverride && <span className={styles.overrideTag}>Override</span>}
                                    </div>
                                  ) : (
                                    <span style={{ color: 'var(--text-muted)', fontSize: '11.5px', fontStyle: 'italic' }}>Off</span>
                                  )}
                                </Link>
                              </div>
                            </div>
                          );
                        })
                      )}
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

