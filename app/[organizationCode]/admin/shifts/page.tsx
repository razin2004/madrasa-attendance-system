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

  useEffect(() => {
    fetchInitialData();
  }, [organizationCode]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      setHasError(false);
      const brandRes = await fetch(`/api/org/${organizationCode}/branding`);
      const brandData = await brandRes.json();
      if (brandData.success) {
        setBranding(brandData.organization);
      }

      const res = await fetch(`/api/org/${organizationCode}/shift-patterns`);
      const data = await res.json();
      if (data.success) {
        setPatterns(data.shiftPatterns);
        setCounts(data.counts);
      } else {
        setHasError(true);
        toast.error(data.error || 'Failed to load shift patterns.');
      }
    } catch {
      setHasError(true);
      toast.error('Network error loading shift patterns.');
    } finally {
      setLoading(false);
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
        <header className={styles.header}>
          <div>
            <h1 className={styles.headerTitle}>Shifts &amp; Roster</h1>
            <p className={styles.headerSubtitle}>
              Create recurring schedules, assign staff, and manage workforce coverage.
            </p>
          </div>

          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setHeaderMenuOpen(!headerMenuOpen)}
              className="btn btn-secondary btn-sm"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '38px',
                height: '38px',
                padding: 0,
                borderRadius: '10px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-medium)',
                color: '#ffffff',
                cursor: 'pointer',
              }}
              title="Shifts & Roster Actions Menu"
            >
              <Menu size={18} />
            </button>

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
                      backgroundColor: 'rgba(99, 102, 241, 0.15)',
                    }}
                  >
                    <Plus size={15} color="#818cf8" />
                    <span>Create Shift Pattern</span>
                  </Link>

                  <Link
                    href={`/${organizationCode}/admin/roster`}
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
          </div>
        </header>

        {/* Content Body */}
        <main className="pageMainContent" style={{ maxWidth: '1240px' }}>
          {/* Filter Bar */}
          <div className={styles.filterBar}>
            {/* Tabs */}
            <div className={styles.tabGroup}>
              {[
                { id: 'ALL', label: `All Patterns (${counts.total})` },
                { id: 'ACTIVE', label: `Active (${counts.active})` },
                { id: 'INACTIVE', label: `Inactive (${counts.inactive})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id as any)}
                  className={`${styles.tabButton} ${filter === tab.id ? styles.tabButtonActive : ''}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative', width: '280px' }}>
              <Search
                size={15}
                color="var(--text-muted)"
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="text"
                placeholder="Search shift pattern name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '36px', height: '36px', fontSize: '13px' }}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  style={{ position: 'absolute', right: '10px', top: '9px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <X size={14} />
                </button>
              )}
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
        </main>
      </div>

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
