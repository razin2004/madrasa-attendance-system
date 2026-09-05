'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
  User,
  Users,
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  ShieldCheck,
  Building2,
  AlertCircle,
  FileText,
  ArrowLeftRight,
} from 'lucide-react';
import { OrgAdminSidebar } from '@/components/layout/org-admin-sidebar';
import { OrgAdminMobileNav } from '@/components/layout/org-admin-mobile-nav';
import { useToast } from '@/components/feedback/toast-provider';
import styles from './ShiftRoster.module.css';

interface Branch {
  id: string;
  name: string;
}

interface ShiftPattern {
  id: string;
  name: string;
  minimumStaffingThreshold: number;
  weeklyDays: Array<{
    weekday: string;
    startTime: string | null;
    endTime: string | null;
    isHoliday: boolean;
  }>;
}

interface StaffProfile {
  id: string;
  staffId: string;
  name: string;
  user: { email: string };
  branchAssignments?: Array<{ branch: { id: string; name: string } }>;
  shiftAssignments: Array<{
    shiftPattern: {
      id: string;
      name: string;
      weeklyDays: Array<{
        weekday: string;
        startTime: string | null;
        endTime: string | null;
        isHoliday: boolean;
      }>;
    };
  }>;
}

interface LeaveRequest {
  id: string;
  staffProfileId: string;
  type: string;
  startDate: string;
  endDate: string;
  reason: string | null;
}

interface ApprovedSwap {
  id: string;
  targetDate: string;
  requester: { id: string; name: string; staffId: string };
  peer: { id: string; name: string; staffId: string };
  shiftPattern: { id: string; name: string } | null;
}

interface Conflict {
  type: 'UNDER_STAFFED' | 'LEAVE_CONFLICT' | 'BACK_TO_BACK_NIGHT';
  date: string;
  title: string;
  message: string;
  severity: 'HIGH' | 'MEDIUM';
  branchId?: string;
  staffProfileId?: string;
}

interface RosterData {
  startDate: string;
  endDate: string;
  branches: Branch[];
  shiftPatterns: ShiftPattern[];
  staffProfiles: StaffProfile[];
  leaveRequests: LeaveRequest[];
  approvedSwaps: ApprovedSwap[];
  datesList: string[];
  conflicts: Conflict[];
  summaryStats: {
    totalStaff: number;
    totalConflicts: number;
    approvedLeavesCount: number;
    approvedSwapsCount: number;
  };
}

interface OrgBranding {
  id: string;
  name: string;
  logoUrl: string | null;
  organizationCode: string;
}

export default function ShiftRosterPage() {
  const params = useParams();
  const organizationCode = (params.organizationCode as string)?.toUpperCase() || '';
  const router = useRouter();
  const toast = useToast();

  const [branding, setBranding] = useState<OrgBranding | null>(null);
  const [rosterData, setRosterData] = useState<RosterData | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedBranchId, setSelectedBranchId] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'WEEKLY' | 'MONTHLY'>('WEEKLY');
  const [weekOffset, setWeekOffset] = useState<number>(0);
  const [showConflictsOnly, setShowConflictsOnly] = useState(false);

  const fetchRosterData = useCallback(async () => {
    try {
      setLoading(true);

      // Compute date range based on weekOffset and viewMode
      const now = new Date();
      const currentDay = now.getDay();
      const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;

      const startDate = new Date(now);
      startDate.setDate(now.getDate() + distanceToMonday + weekOffset * (viewMode === 'WEEKLY' ? 7 : 30));
      startDate.setUTCHours(0, 0, 0, 0);

      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + (viewMode === 'WEEKLY' ? 6 : 29));
      endDate.setUTCHours(23, 59, 59, 999);

      const brandRes = await fetch(`/api/org/${organizationCode}/branding`);
      const brandData = await brandRes.json();
      if (brandData.success) {
        setBranding(brandData.organization);
      }

      const queryParams = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        branchId: selectedBranchId,
      });

      const res = await fetch(`/api/org/${organizationCode}/admin/shifts/roster?${queryParams.toString()}`);
      const data = await res.json();

      if (res.ok && data.success) {
        setRosterData(data);
      } else {
        toast.error(data.error || 'Failed to load roster calendar.');
      }
    } catch {
      toast.error('Network error loading roster calendar.');
    } finally {
      setLoading(false);
    }
  }, [organizationCode, weekOffset, viewMode, selectedBranchId, toast]);

  useEffect(() => {
    if (organizationCode) {
      fetchRosterData();
    }
  }, [organizationCode, fetchRosterData]);

  const weekdayMap: Record<number, string> = {
    0: 'SUNDAY',
    1: 'MONDAY',
    2: 'TUESDAY',
    3: 'WEDNESDAY',
    4: 'THURSDAY',
    5: 'FRIDAY',
    6: 'SATURDAY',
  };

  return (
    <div className={styles.container}>
      <OrgAdminSidebar
        organizationCode={organizationCode}
        organizationName={branding?.name || 'Organization'}
        logoUrl={branding?.logoUrl}
      />

      <div className={styles.mainContent}>
        {/* Header Bar */}
        <header className={styles.headerBar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link href={`/${organizationCode}/admin/shifts`} className="btn btn-secondary btn-sm" style={{ padding: '8px' }}>
              <ArrowLeft size={16} />
            </Link>
            <div>
              <h1 className={styles.title}>Visual Shift Roster Calendar</h1>
              <p className={styles.subtitle}>
                Roster matrix with real-time automated conflict &amp; staffing risk detection.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* View Mode Toggle */}
            <div style={{ display: 'flex', backgroundColor: 'rgba(255,255,255,0.05)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <button
                onClick={() => setViewMode('WEEKLY')}
                className={`btn btn-sm ${viewMode === 'WEEKLY' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 12px', fontSize: '12px', borderRadius: '6px' }}
              >
                Weekly Matrix
              </button>
              <button
                onClick={() => setViewMode('MONTHLY')}
                className={`btn btn-sm ${viewMode === 'MONTHLY' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 12px', fontSize: '12px', borderRadius: '6px' }}
              >
                Monthly Grid
              </button>
            </div>

            {/* Branch Filter */}
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="form-input"
              style={{ fontSize: '12.5px', padding: '6px 12px', color: '#ffffff', backgroundColor: 'rgba(15, 23, 42, 0.9)' }}
            >
              <option value="ALL">All Branch Locations</option>
              {rosterData?.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>

            {/* Week Navigator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                onClick={() => setWeekOffset((prev) => prev - 1)}
                className="btn btn-secondary btn-sm"
                style={{ padding: '6px 8px' }}
                title="Previous Period"
              >
                <ChevronLeft size={16} />
              </button>

              <button
                onClick={() => setWeekOffset(0)}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '12px', padding: '6px 10px' }}
              >
                Current
              </button>

              <button
                onClick={() => setWeekOffset((prev) => prev + 1)}
                className="btn btn-secondary btn-sm"
                style={{ padding: '6px 8px' }}
                title="Next Period"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <button onClick={fetchRosterData} disabled={loading} className="btn btn-secondary btn-sm" style={{ padding: '8px' }}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </header>

        <main className="pageMainContent" style={{ padding: '24px' }}>
          {/* Conflict Warnings Drawer / Banner */}
          {rosterData && rosterData.conflicts.length > 0 && (
            <div className={styles.conflictBanner}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <AlertTriangle size={22} color="#f43f5e" />
                  <div>
                    <strong style={{ fontSize: '15px', color: '#ffffff' }}>
                      {rosterData.conflicts.length} Roster Conflict Alerts Detected
                    </strong>
                    <div style={{ fontSize: '12.5px', color: '#fca5a5', marginTop: '2px' }}>
                      Automated risk engine found under-staffing thresholds or leave overlaps in this schedule.
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setShowConflictsOnly(!showConflictsOnly)}
                  className="btn btn-danger btn-sm"
                  style={{ fontSize: '12px', fontWeight: 700 }}
                >
                  {showConflictsOnly ? 'Show Full Roster' : 'Filter Conflict Alerts'}
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                {rosterData.conflicts.slice(0, 4).map((c, idx) => (
                  <div key={idx} style={{ fontSize: '12.5px', color: '#ffe4e6', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 800, color: '#f43f5e' }}>● [{c.type}]</span>
                    <span>{c.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Roster Summary Bar */}
          {rosterData && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '12px',
                marginBottom: '20px',
              }}
            >
              <div className="glass-card" style={{ padding: '14px 18px', borderRadius: '12px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Total Active Staff</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff', marginTop: '4px' }}>{rosterData.summaryStats.totalStaff}</div>
              </div>

              <div className="glass-card" style={{ padding: '14px 18px', borderRadius: '12px' }}>
                <div style={{ fontSize: '11px', color: '#fbbf24', fontWeight: 700, textTransform: 'uppercase' }}>Approved Leaves</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#fbbf24', marginTop: '4px' }}>{rosterData.summaryStats.approvedLeavesCount}</div>
              </div>

              <div className="glass-card" style={{ padding: '14px 18px', borderRadius: '12px' }}>
                <div style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase' }}>Approved Shift Swaps</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }}>{rosterData.summaryStats.approvedSwapsCount}</div>
              </div>

              <div className="glass-card" style={{ padding: '14px 18px', borderRadius: '12px' }}>
                <div style={{ fontSize: '11px', color: '#f43f5e', fontWeight: 700, textTransform: 'uppercase' }}>Conflict Warnings</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#f43f5e', marginTop: '4px' }}>{rosterData.summaryStats.totalConflicts}</div>
              </div>
            </div>
          )}

          {/* Roster Calendar Matrix Table */}
          {loading ? (
            <div className="glass-card" style={{ padding: '60px', textAlign: 'center' }}>
              <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 12px auto', color: '#818cf8' }} />
              <p style={{ color: 'var(--text-secondary)' }}>Building shift roster matrix...</p>
            </div>
          ) : !rosterData || rosterData.staffProfiles.length === 0 ? (
            <div className="glass-card" style={{ padding: '60px 24px', textAlign: 'center' }}>
              <Users size={32} color="var(--text-muted)" style={{ margin: '0 auto 12px auto' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>No Active Staff Found</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                No active staff profiles match the selected branch location.
              </p>
            </div>
          ) : (
            <div className={styles.rosterTableWrapper}>
              <table className={styles.rosterTable}>
                <thead>
                  <tr>
                    <th className={styles.staffCol}>Staff Profile</th>
                    {rosterData.datesList.map((dStr) => {
                      const d = new Date(dStr);
                      const dayName = d.toLocaleDateString(undefined, { weekday: 'short' });
                      const dateNum = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

                      return (
                        <th key={dStr} className={styles.dateCol}>
                          <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>{dayName}</div>
                          <div style={{ fontSize: '13.5px', color: '#ffffff', fontWeight: 800, marginTop: '2px' }}>{dateNum}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {rosterData.staffProfiles.map((staff) => {
                    const primaryAssignment = staff.shiftAssignments[0];
                    const pattern = primaryAssignment?.shiftPattern;
                    const branchName = staff.branchAssignments?.[0]?.branch.name || 'General Branch';

                    return (
                      <tr key={staff.id}>
                        {/* Staff Details Column */}
                        <td className={styles.staffCol}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8', fontWeight: 800, fontSize: '12px' }}>
                              {staff.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#ffffff' }}>{staff.name}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                ID: <span style={{ fontFamily: 'var(--font-mono)' }}>{staff.staffId}</span> | {branchName}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Date Columns */}
                        {rosterData.datesList.map((dStr) => {
                          const d = new Date(dStr);
                          const weekdayStr = weekdayMap[d.getDay()];

                          // 1. Check if staff is on approved leave on this date
                          const leaveMatch = rosterData.leaveRequests.find((l) => {
                            const s = new Date(l.startDate);
                            const e = new Date(l.endDate);
                            s.setUTCHours(0, 0, 0, 0);
                            e.setUTCHours(23, 59, 59, 999);
                            return l.staffProfileId === staff.id && d >= s && d <= e;
                          });

                          // 2. Check if staff is involved in an approved shift swap on this date
                          const swapMatch = rosterData.approvedSwaps.find((s) => {
                            const sDate = new Date(s.targetDate).toISOString().split('T')[0];
                            const curDate = d.toISOString().split('T')[0];
                            return sDate === curDate && (s.requester.id === staff.id || s.peer.id === staff.id);
                          });

                          // 3. Check regular weekly shift schedule
                          const weeklyDay = pattern?.weeklyDays.find((w) => w.weekday === weekdayStr);
                          const isScheduled = Boolean(weeklyDay && !weeklyDay.isHoliday);

                          if (leaveMatch) {
                            return (
                              <td key={dStr} className={styles.dateCol}>
                                <div className={`${styles.cellCard} ${styles.shiftCellLeave}`} title={`Approved Leave: ${leaveMatch.type}`}>
                                  <FileText size={12} style={{ marginBottom: '2px' }} />
                                  <span>{leaveMatch.type}</span>
                                </div>
                              </td>
                            );
                          }

                          if (swapMatch) {
                            const isSubstitute = swapMatch.peer.id === staff.id;
                            return (
                              <td key={dStr} className={styles.dateCol}>
                                <div className={`${styles.cellCard} ${styles.shiftCellSwap}`} title={isSubstitute ? `Covering for ${swapMatch.requester.name}` : `Swapped with ${swapMatch.peer.name}`}>
                                  <ArrowLeftRight size={12} style={{ marginBottom: '2px' }} />
                                  <span>{isSubstitute ? 'Subbing Shift' : 'Swapped Out'}</span>
                                </div>
                              </td>
                            );
                          }

                          if (isScheduled) {
                            return (
                              <td key={dStr} className={styles.dateCol}>
                                <div className={`${styles.cellCard} ${styles.shiftCellScheduled}`}>
                                  <Clock size={12} style={{ marginBottom: '2px' }} />
                                  <span>{pattern?.name || 'Shift'}</span>
                                  <span style={{ fontSize: '10px', opacity: 0.8, marginTop: '2px' }}>
                                    {weeklyDay?.startTime} – {weeklyDay?.endTime}
                                  </span>
                                </div>
                              </td>
                            );
                          }

                          return (
                            <td key={dStr} className={styles.dateCol}>
                              <div className={`${styles.cellCard} ${styles.shiftCellOff}`}>
                                <span>OFF</span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>

      <OrgAdminMobileNav organizationCode={organizationCode} />
    </div>
  );
}
