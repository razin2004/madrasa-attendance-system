'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '../../../components/feedback/toast-provider';
import { OrgAdminSidebar } from '../../../components/layout/org-admin-sidebar';
import { OrgAdminMobileNav } from '../../../components/layout/org-admin-mobile-nav';
import { LiveAttendanceFeed } from '../../../components/dashboard/live-attendance-feed';
import { BranchStaffingBanner } from '../../../components/dashboard/branch-staffing-banner';
import styles from './AdminDashboard.module.css';
import {
  Building2,
  Shield,
  User,
  LogOut,
  CheckCircle2,
  Lock,
  Layers,
  Calendar,
  Clock,
  MapPin,
  Smartphone,
  Wifi,
  Loader2,
  ArrowRight,
  Plus,
  Network,
  ShieldCheck,
  Users,
  AlertCircle,
  Sparkles,
  ClipboardCheck,
  RefreshCw,
  AlertTriangle,
  FileText,
  TrendingUp,
  Activity,
  CheckCircle,
  XCircle,
  ExternalLink,
  Menu,
} from 'lucide-react';

export default function OrgAdminLandingPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();

  const orgCode = (params.organizationCode as string)?.toUpperCase() || '';

  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [orgData, setOrgData] = useState<any>(null);
  
  const [branchSummary, setBranchSummary] = useState<{ total: number; active: number; inactive: number }>({
    total: 0,
    active: 0,
    inactive: 0,
  });
  const [staffSummary, setStaffSummary] = useState<{ total: number; active: number; deviceRegistered: number }>({
    total: 0,
    active: 0,
    deviceRegistered: 0,
  });
  const [shiftSummary, setShiftSummary] = useState<{ total: number; active: number }>({
    total: 0,
    active: 0,
  });
  const [pendingLeaveCount, setPendingLeaveCount] = useState<number>(0);
  const [pendingLeaveRequests, setPendingLeaveRequests] = useState<any[]>([]);
  const [pendingCorrectionsCount, setPendingCorrectionsCount] = useState<number>(0);
  const [pendingCorrections, setPendingCorrections] = useState<any[]>([]);
  const [branchesList, setBranchesList] = useState<any[]>([]);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    setHasError(false);

    try {
      const res = await fetch('/api/auth/me');
      if (!res.ok) {
        router.push(`/${orgCode}/login`);
        return;
      }

      const data = await res.json();
      if (!data.user) {
        router.push(`/${orgCode}/login`);
        return;
      }

      // Verify tenant match & branding
      const brandRes = await fetch(`/api/org/${orgCode}/branding`);
      const brandData = await brandRes.json();

      if (brandRes.ok && brandData.organization) {
        setOrgData(brandData.organization);

        if (
          data.user.role !== 'SUPER_ADMIN' &&
          data.user.organizationId !== brandData.organization.id
        ) {
          toast.error('Cross-tenant access denied.');
          router.push(`/${orgCode}/login`);
          return;
        }

        setCurrentUser(data.user);

        // 1. Fetch branches count & list
        const branchRes = await fetch(`/api/org/${orgCode}/branches`);
        const branchData = await branchRes.json();
        if (branchData.success) {
          setBranchSummary(branchData.counts || { total: 0, active: 0, inactive: 0 });
          setBranchesList(branchData.branches || []);
        }

        // 2. Fetch staff count
        const staffRes = await fetch(`/api/org/${orgCode}/staff`);
        const staffData = await staffRes.json();
        if (staffData.success) {
          setStaffSummary({
            total: staffData.counts?.total || 0,
            active: staffData.counts?.active || 0,
            deviceRegistered: staffData.counts?.deviceRegistered || 0,
          });
        }

        // 3. Fetch shift patterns count
        const shiftRes = await fetch(`/api/org/${orgCode}/shift-patterns`);
        const shiftData = await shiftRes.json();
        if (shiftData.success) {
          setShiftSummary({
            total: shiftData.counts?.total || 0,
            active: shiftData.counts?.active || 0,
          });
        }

        // 4. Fetch pending leave requests & attendance corrections needing admin review
        try {
          const leaveRes = await fetch(`/api/org/${orgCode}/leave/admin?status=PENDING`);
          const leaveData = await leaveRes.json();
          if (leaveData.success) {
            setPendingLeaveCount(leaveData.requests?.length || 0);
            setPendingLeaveRequests(leaveData.requests?.slice(0, 5) || []);
          }

          const corrRes = await fetch(`/api/org/${orgCode}/attendance/admin/corrections?status=PENDING`);
          const corrData = await corrRes.json();
          if (corrData.success) {
            setPendingCorrectionsCount(corrData.requests?.length || 0);
            setPendingCorrections(corrData.requests?.slice(0, 5) || []);
          }
        } catch {
          // Non-blocking fetch
        }
      } else {
        router.push('/');
      }
    } catch (err) {
      setHasError(true);
      toast.error('Network error loading workspace overview.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (orgCode) {
      fetchData();
    }
  }, [orgCode]);

  // Greeting Generator
  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className={styles.layoutContainer}>
      {/* Desktop Sidebar */}
      <OrgAdminSidebar
        organizationCode={orgCode}
        organizationName={orgData?.name || 'Organization'}
        logoUrl={orgData?.logoUrl}
        adminEmail={currentUser?.email}
        branchCount={branchSummary.total}
        staffCount={staffSummary.total}
        shiftPatternCount={shiftSummary.total}
      />

      {/* Main Content Area */}
      <div className={styles.mainContent}>
        {/* Top Header Bar */}
        <header className={styles.headerBar}>
          <div>
            <h1 className={styles.headerTitle}>
              Organization Operations Dashboard
            </h1>
            <p className={styles.headerSubtitle}>
              <span>ShiftGuard Multi-Tenant Operations Workspace</span>
              <span>&bull;</span>
              <span style={{ color: '#a5b4fc', fontWeight: 700 }}>{orgData?.name || orgCode}</span>
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
              title="Dashboard Actions Menu"
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
                    minWidth: '200px',
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
                    href={`/${orgCode}/admin/roster`}
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
                    <Calendar size={15} color="#818cf8" />
                    <span>Roster Schedule</span>
                  </Link>

                  <Link
                    href={`/${orgCode}/admin/staff`}
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
                    <Users size={15} color="#38bdf8" />
                    <span>Staff Directory</span>
                  </Link>

                  <Link
                    href={`/${orgCode}/admin/branches`}
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
                    <Building2 size={15} color="#c084fc" />
                    <span>Branches Directory</span>
                  </Link>

                  <button
                    type="button"
                    onClick={() => {
                      setHeaderMenuOpen(false);
                      fetchData();
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
                    <RefreshCw size={15} color="#34d399" className={isLoading ? 'animate-spin' : ''} />
                    <span>Refresh Dashboard</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Content Body */}
        <main className={styles.contentBody}>
          {/* Date & Greeting Banner */}
          <div className={styles.dateBanner}>
            <div>
              <h2 className={styles.greetingText}>
                {greeting}, {currentUser?.name || 'Administrator'}
              </h2>
              <p className={styles.dateSubtext}>
                Here is your live workforce operations summary and 3-layer security overview for today.
              </p>
            </div>
            <div className={styles.dateBadge}>
              <Calendar size={15} color="#818cf8" />
              <span>{formattedDate}</span>
            </div>
          </div>

          {/* ERROR STATE */}
          {hasError && !isLoading && (
            <div className="glass-card" style={{ padding: '40px', textAlign: 'center', margin: '20px 0', borderRadius: '20px' }}>
              <AlertCircle size={36} color="#f43f5e" style={{ margin: '0 auto 12px auto' }} />
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff' }}>
                Unable to load workspace overview
              </h3>
              <p style={{ fontSize: '13.5px', color: '#94a3b8', marginTop: '4px', marginBottom: '20px' }}>
                Something went wrong while communicating with the workspace server.
              </p>
              <button onClick={fetchData} className="btn btn-primary btn-sm" style={{ borderRadius: '10px' }}>
                Try Again
              </button>
            </div>
          )}

          {/* LOADING STATE SKELETON */}
          {isLoading && (
            <div className="glass-card" style={{ padding: '48px 24px', textAlign: 'center', borderRadius: '20px' }}>
              <Loader2 size={32} className="animate-spin" style={{ color: '#818cf8', margin: '0 auto 12px auto' }} />
              <div style={{ fontSize: '14px', color: '#94a3b8' }}>
                Verifying workspace credentials &amp; loading operational metrics...
              </div>
            </div>
          )}

          {!isLoading && !hasError && (
            <>
              {/* IMPORTANT SETUP ALERTS */}
              <div className={styles.alertsSection}>
                {branchSummary.total === 0 && (
                  <div
                    className={styles.alertCard}
                    style={{
                      backgroundColor: 'rgba(245, 158, 11, 0.1)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <AlertTriangle size={22} color="#fbbf24" style={{ flexShrink: 0 }} />
                      <div>
                        <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '14px' }}>Branch Setup Required</div>
                        <div style={{ fontSize: '12.5px', color: '#cbd5e1', marginTop: '2px' }}>
                          Register your first workplace branch to configure IP and GPS Geofence attendance parameters.
                        </div>
                      </div>
                    </div>
                    <Link href={`/${orgCode}/admin/branches`} className="btn btn-warning btn-sm" style={{ borderRadius: '10px', flexShrink: 0 }}>
                      Configure Branches &rarr;
                    </Link>
                  </div>
                )}

                {staffSummary.total === 0 && (
                  <div
                    className={styles.alertCard}
                    style={{
                      backgroundColor: 'rgba(99, 102, 241, 0.1)',
                      border: '1px solid rgba(99, 102, 241, 0.3)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <Users size={22} color="#818cf8" style={{ flexShrink: 0 }} />
                      <div>
                        <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '14px' }}>Add Staff Members</div>
                        <div style={{ fontSize: '12.5px', color: '#cbd5e1', marginTop: '2px' }}>
                          Onboard staff members to begin assigning shift patterns and verifying attendance.
                        </div>
                      </div>
                    </div>
                    <Link href={`/${orgCode}/admin/staff`} className="btn btn-primary btn-sm" style={{ borderRadius: '10px', flexShrink: 0 }}>
                      Add Staff &rarr;
                    </Link>
                  </div>
                )}
              </div>

              {/* Branch Staffing Coverage & Understaffing Warning Banner */}
              <BranchStaffingBanner organizationCode={orgCode} />

              {/* KEY METRICS GRID */}
              <div className={styles.metricsGrid}>
                {/* Workplace Branches */}
                <div className={styles.metricCard} style={{ borderLeft: '4px solid #06b6d4' }}>
                  <div className={styles.metricHeader}>
                    <span className={styles.metricTitle}>Workplace Branches</span>
                    <div style={{ padding: '8px', borderRadius: '10px', backgroundColor: 'rgba(6, 182, 212, 0.12)' }}>
                      <MapPin size={20} color="#38bdf8" />
                    </div>
                  </div>
                  <div className={styles.metricValue}>{branchSummary.total}</div>
                  <div className={styles.metricSubtext}>
                    <span style={{ color: '#34d399', fontWeight: 700 }}>● {branchSummary.active} Active</span>
                    <span>locations</span>
                  </div>
                </div>

                {/* Onboarded Staff */}
                <div className={styles.metricCard} style={{ borderLeft: '4px solid #818cf8' }}>
                  <div className={styles.metricHeader}>
                    <span className={styles.metricTitle}>Active Staff Workforce</span>
                    <div style={{ padding: '8px', borderRadius: '10px', backgroundColor: 'rgba(99, 102, 241, 0.12)' }}>
                      <Users size={20} color="#818cf8" />
                    </div>
                  </div>
                  <div className={styles.metricValue}>{staffSummary.total}</div>
                  <div className={styles.metricSubtext}>
                    <span style={{ color: '#a5b4fc', fontWeight: 700 }}>{staffSummary.active} Active Profiles</span>
                  </div>
                </div>

                {/* Shift Patterns */}
                <div className={styles.metricCard} style={{ borderLeft: '4px solid #a855f7' }}>
                  <div className={styles.metricHeader}>
                    <span className={styles.metricTitle}>Shift Patterns</span>
                    <div style={{ padding: '8px', borderRadius: '10px', backgroundColor: 'rgba(168, 85, 247, 0.12)' }}>
                      <Clock size={20} color="#c084fc" />
                    </div>
                  </div>
                  <div className={styles.metricValue}>{shiftSummary.total}</div>
                  <div className={styles.metricSubtext}>
                    <span style={{ color: '#c084fc', fontWeight: 700 }}>{shiftSummary.active} Shift Rules</span>
                  </div>
                </div>

                {/* Layer 1 Bound Devices */}
                <div className={styles.metricCard} style={{ borderLeft: '4px solid #10b981' }}>
                  <div className={styles.metricHeader}>
                    <span className={styles.metricTitle}>Bound Devices (Layer 1)</span>
                    <div style={{ padding: '8px', borderRadius: '10px', backgroundColor: 'rgba(16, 185, 129, 0.12)' }}>
                      <Smartphone size={20} color="#34d399" />
                    </div>
                  </div>
                  <div className={styles.metricValue} style={{ color: '#34d399' }}>
                    {staffSummary.deviceRegistered}
                  </div>
                  <div className={styles.metricSubtext}>
                    <ShieldCheck size={14} color="#34d399" />
                    <span>Hardware cryptographic secrets</span>
                  </div>
                </div>
              </div>

              {/* PENDING APPROVALS & LEAVE REQUESTS PANEL */}
              <div className={styles.panelCard}>
                <div className={styles.panelHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ padding: '8px', borderRadius: '10px', backgroundColor: 'rgba(245, 158, 11, 0.12)' }}>
                      <FileText size={18} color="#fbbf24" />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                        Pending Leave &amp; Time-Off Applications
                      </h3>
                      <p style={{ fontSize: '12px', color: '#94a3b8', margin: '2px 0 0 0' }}>
                        Staff time-off requests requiring administrator authorization
                      </p>
                    </div>
                  </div>

                  <Link href={`/${orgCode}/admin/leave`} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '8px', fontSize: '12px' }}>
                    <span>View All Leave ({pendingLeaveCount})</span>
                    <ArrowRight size={14} />
                  </Link>
                </div>

                {pendingLeaveRequests.length === 0 ? (
                  <div style={{ padding: '36px 20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                    <CheckCircle2 size={32} color="#34d399" style={{ margin: '0 auto 10px auto' }} />
                    <div>All pending leave applications have been reviewed.</div>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                          <th style={{ padding: '12px 20px', textAlign: 'left', color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700 }}>Staff Member</th>
                          <th style={{ padding: '12px 20px', textAlign: 'left', color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700 }}>Leave Type</th>
                          <th style={{ padding: '12px 20px', textAlign: 'left', color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700 }}>Duration / Dates</th>
                          <th style={{ padding: '12px 20px', textAlign: 'left', color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700 }}>Reason</th>
                          <th style={{ padding: '12px 20px', textAlign: 'right', color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700 }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingLeaveRequests.map((req, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                            <td style={{ padding: '14px 20px', fontWeight: 700, color: '#ffffff' }}>
                              {req.staffProfile?.name || 'Staff Member'}
                              <div style={{ fontSize: '11.5px', color: '#94a3b8', fontWeight: 500 }}>ID: {req.staffProfile?.staffId || '—'}</div>
                            </td>
                            <td style={{ padding: '14px 20px' }}>
                              <span style={{ fontSize: '11px', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8' }}>
                                {req.type}
                              </span>
                            </td>
                            <td style={{ padding: '14px 20px', color: '#cbd5e1', fontSize: '12.5px' }}>
                              {new Date(req.startDate).toLocaleDateString()} &ndash; {new Date(req.endDate).toLocaleDateString()}
                              <div style={{ fontSize: '11px', color: '#818cf8', fontWeight: 700 }}>({req.daysCount} {req.daysCount === 1 ? 'day' : 'days'})</div>
                            </td>
                            <td style={{ padding: '14px 20px', color: '#94a3b8', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {req.reason || 'No reason provided'}
                            </td>
                            <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                              <Link
                                href={`/${orgCode}/admin/leave`}
                                className="btn btn-primary btn-sm"
                                style={{ borderRadius: '8px', fontSize: '12px', padding: '6px 12px' }}
                              >
                                Review &rarr;
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* PENDING ATTENDANCE CORRECTIONS PANEL */}
              <div className={styles.panelCard} style={{ marginTop: '20px' }}>
                <div className={styles.panelHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ padding: '8px', borderRadius: '10px', backgroundColor: 'rgba(99, 102, 241, 0.12)' }}>
                      <Clock size={18} color="#818cf8" />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                        Pending Attendance Correction Requests
                      </h3>
                      <p style={{ fontSize: '12px', color: '#94a3b8', margin: '2px 0 0 0' }}>
                        Staff-submitted punch adjustments requiring administrator approval
                      </p>
                    </div>
                  </div>

                  <Link href={`/${orgCode}/admin/attendance/corrections`} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '8px', fontSize: '12px' }}>
                    <span>View All Corrections ({pendingCorrectionsCount})</span>
                    <ArrowRight size={14} />
                  </Link>
                </div>

                {pendingCorrections.length === 0 ? (
                  <div style={{ padding: '36px 20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                    <CheckCircle2 size={32} color="#34d399" style={{ margin: '0 auto 10px auto' }} />
                    <div>All pending attendance correction requests have been reviewed.</div>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                          <th style={{ padding: '12px 20px', textAlign: 'left', color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700 }}>Staff Member</th>
                          <th style={{ padding: '12px 20px', textAlign: 'left', color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700 }}>Date</th>
                          <th style={{ padding: '12px 20px', textAlign: 'left', color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700 }}>Correction Type</th>
                          <th style={{ padding: '12px 20px', textAlign: 'left', color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700 }}>Reason</th>
                          <th style={{ padding: '12px 20px', textAlign: 'right', color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700 }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingCorrections.map((req, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                            <td style={{ padding: '14px 20px', fontWeight: 700, color: '#ffffff' }}>
                              {req.staff?.name || 'Staff Member'}
                              <div style={{ fontSize: '11.5px', color: '#94a3b8', fontWeight: 500 }}>ID: {req.staff?.staffId || '—'}</div>
                            </td>
                            <td style={{ padding: '14px 20px', color: '#ffffff', fontFamily: 'var(--font-mono)', fontSize: '12.5px' }}>
                              {req.date}
                            </td>
                            <td style={{ padding: '14px 20px' }}>
                              <span style={{ fontSize: '11px', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#fbbf24' }}>
                                {req.type}
                              </span>
                            </td>
                            <td style={{ padding: '14px 20px', color: '#94a3b8', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: 'italic' }}>
                              &ldquo;{req.reason || 'No reason provided'}&rdquo;
                            </td>
                            <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                              <Link
                                href={`/${orgCode}/admin/attendance/corrections`}
                                className="btn btn-primary btn-sm"
                                style={{ borderRadius: '8px', fontSize: '12px', padding: '6px 12px' }}
                              >
                                Review &rarr;
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* LIVE REAL-TIME ATTENDANCE FEED WIDGET */}
              <LiveAttendanceFeed organizationCode={orgCode} />

              {/* QUICK OPERATIONS ACTION TILES */}
              <div className={styles.sectionTitle} style={{ marginTop: '36px' }}>
                <Sparkles size={18} color="#38bdf8" />
                <span>Core Operations Hub</span>
              </div>

              <div className={styles.quickActionsGrid}>
                {/* Shifts Quick Action */}
                <div className={styles.quickActionCard}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                      <div style={{ padding: '10px', borderRadius: '12px', backgroundColor: 'rgba(168, 85, 247, 0.12)' }}>
                        <Clock size={22} color="#c084fc" />
                      </div>
                      <div>
                        <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                          Shift Patterns
                        </h3>
                        <div style={{ fontSize: '12px', color: '#94a3b8' }}>Weekly working hours &amp; rules</div>
                      </div>
                    </div>
                    <p style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.5', marginBottom: '22px' }}>
                      Configure shift start/end hours, overnight rules, break durations, and minimum staffing thresholds per branch.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <Link href={`/${orgCode}/admin/shifts/new`} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '10px', flex: 1, justifyContent: 'center' }}>
                      <Plus size={14} />
                      <span>New Pattern</span>
                    </Link>
                    <Link href={`/${orgCode}/admin/shifts`} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '10px', flex: 1, justifyContent: 'center' }}>
                      <span>Manage</span>
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>

                {/* Roster Quick Action */}
                <div className={styles.quickActionCard}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                      <div style={{ padding: '10px', borderRadius: '12px', backgroundColor: 'rgba(56, 189, 248, 0.12)' }}>
                        <Calendar size={22} color="#38bdf8" />
                      </div>
                      <div>
                        <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                          Roster Schedule
                        </h3>
                        <div style={{ fontSize: '12px', color: '#94a3b8' }}>Interactive calendar &amp; overrides</div>
                      </div>
                    </div>
                    <p style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.5', marginBottom: '22px' }}>
                      Assign staff to shift patterns, view branch coverage, resolve schedule conflicts, and set individual day overrides.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <Link href={`/${orgCode}/admin/roster`} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '10px', width: '100%', justifyContent: 'center' }}>
                      <span>Open Roster Calendar</span>
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>

                {/* Staff Directory Quick Action */}
                <div className={styles.quickActionCard}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                      <div style={{ padding: '10px', borderRadius: '12px', backgroundColor: 'rgba(99, 102, 241, 0.12)' }}>
                        <Users size={22} color="#818cf8" />
                      </div>
                      <div>
                        <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                          Staff Directory
                        </h3>
                        <div style={{ fontSize: '12px', color: '#94a3b8' }}>Workforce onboarding &amp; devices</div>
                      </div>
                    </div>
                    <p style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.5', marginBottom: '22px' }}>
                      Onboard staff members, bind cryptographic device secrets, reset PINs, and manage active branch assignments.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <Link href={`/${orgCode}/admin/staff`} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '10px', width: '100%', justifyContent: 'center' }}>
                      <span>View Staff Directory</span>
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              </div>

              {/* 3-LAYER SECURITY ARCHITECTURE PANEL */}
              <div className="glass-card" style={{ padding: '28px', borderRadius: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
                  <ShieldCheck size={20} color="#818cf8" />
                  <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                    ShiftGuard 3-Layer Security Architecture
                  </h3>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                  <div style={{ padding: '18px', backgroundColor: 'rgba(6, 182, 212, 0.08)', borderRadius: '14px', border: '1px solid rgba(6, 182, 212, 0.25)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <Wifi size={16} color="#38bdf8" />
                      <span style={{ fontSize: '13.5px', fontWeight: 800, color: '#38bdf8' }}>Layer 1: Network IP</span>
                    </div>
                    <p style={{ fontSize: '12px', color: '#cbd5e1', margin: 0, lineHeight: '1.4' }}>
                      Captures and matches WAN public IP addresses per branch to prevent remote attendance spoofing.
                    </p>
                  </div>

                  <div style={{ padding: '18px', backgroundColor: 'rgba(16, 185, 129, 0.08)', borderRadius: '14px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <MapPin size={16} color="#34d399" />
                      <span style={{ fontSize: '13.5px', fontWeight: 800, color: '#34d399' }}>Layer 2: GPS Geofence</span>
                    </div>
                    <p style={{ fontSize: '12px', color: '#cbd5e1', margin: 0, lineHeight: '1.4' }}>
                      Enforces per-branch geographic radius bounds using browser high-accuracy location signals.
                    </p>
                  </div>

                  <div style={{ padding: '18px', backgroundColor: 'rgba(168, 85, 247, 0.08)', borderRadius: '14px', border: '1px solid rgba(168, 85, 247, 0.25)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <Smartphone size={16} color="#c084fc" />
                      <span style={{ fontSize: '13.5px', fontWeight: 800, color: '#c084fc' }}>Layer 3: Device Binding</span>
                    </div>
                    <p style={{ fontSize: '12px', color: '#cbd5e1', margin: 0, lineHeight: '1.4' }}>
                      Binds opaque hardware cryptographic secrets to staff devices to block unauthorized device usage.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {/* Mobile Navigation */}
      <OrgAdminMobileNav organizationCode={orgCode} />
    </div>
  );
}
