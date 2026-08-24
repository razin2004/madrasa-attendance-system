'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '../../../components/feedback/toast-provider';
import { OrgAdminSidebar } from '../../../components/layout/org-admin-sidebar';
import { OrgAdminMobileNav } from '../../../components/layout/org-admin-mobile-nav';
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

      // Verify tenant match
      const brandRes = await fetch(`/api/org/${orgCode}/branding`);
      const brandData = await brandRes.json();

      if (brandRes.ok && brandData.organization) {
        setOrgData(brandData.organization);

        // If user does not belong to this organization and is not Super Admin
        if (
          data.user.role !== 'SUPER_ADMIN' &&
          data.user.organizationId !== brandData.organization.id
        ) {
          toast.error('Cross-tenant access denied.');
          router.push(`/${orgCode}/login`);
          return;
        }

        setCurrentUser(data.user);

        // Fetch branches count
        const branchRes = await fetch(`/api/org/${orgCode}/branches`);
        const branchData = await branchRes.json();
        if (branchData.success) {
          setBranchSummary(branchData.counts);
        }

        // Fetch staff count
        const staffRes = await fetch(`/api/org/${orgCode}/staff`);
        const staffData = await staffRes.json();
        if (staffData.success) {
          setStaffSummary({
            total: staffData.counts.total,
            active: staffData.counts.active,
            deviceRegistered: staffData.counts.deviceRegistered,
          });
        }

        // Fetch shift patterns count
        const shiftRes = await fetch(`/api/org/${orgCode}/shift-patterns`);
        const shiftData = await shiftRes.json();
        if (shiftData.success) {
          setShiftSummary({
            total: shiftData.counts.total,
            active: shiftData.counts.active,
          });
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
        {/* Top Header */}
        <header className={styles.headerBar}>
          <div>
            <h1 className={styles.headerTitle}>
              Organization Operations Dashboard
            </h1>
            <p className={styles.headerSubtitle}>
              ShiftGuard Multi-Tenant Operations Workspace &bull; {orgData?.name || orgCode}
            </p>
          </div>

          <div className={styles.headerActions}>
            <button
              onClick={fetchData}
              disabled={isLoading}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>

            <Link href={`/${orgCode}/admin/shifts`} className="btn btn-secondary btn-sm">
              <Clock size={14} />
              <span>Shift Patterns</span>
            </Link>
            <Link href={`/${orgCode}/admin/roster`} className="btn btn-primary btn-sm">
              <Calendar size={14} />
              <span>Roster Schedule</span>
            </Link>
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
                Here&apos;s your organization&apos;s workforce overview for today.
              </p>
            </div>
            <div className={styles.dateBadge}>
              <Calendar size={15} color="#818cf8" />
              <span>{formattedDate}</span>
            </div>
          </div>

          {/* ERROR STATE */}
          {hasError && !isLoading && (
            <div className="glass-card" style={{ padding: '40px', textAlign: 'center', margin: '20px 0' }}>
              <AlertCircle size={36} color="var(--danger-text)" style={{ margin: '0 auto 12px auto' }} />
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff' }}>
                Unable to load your organization overview
              </h3>
              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginTop: '4px', marginBottom: '20px' }}>
                Something went wrong while communicating with the workspace server.
              </p>
              <button onClick={fetchData} className="btn btn-primary btn-sm">
                Try Again
              </button>
            </div>
          )}

          {/* LOADING STATE SKELETON */}
          {isLoading && (
            <div className="glass-card" style={{ padding: '48px 24px', textAlign: 'center' }}>
              <Loader2 size={32} className="animate-spin" style={{ color: '#818cf8', margin: '0 auto 12px auto' }} />
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                Verifying workspace credentials &amp; loading metrics...
              </div>
            </div>
          )}

          {!isLoading && !hasError && (
            <>
              {/* IMPORTANT ALERTS SECTION */}
              <div className={styles.alertsSection}>
                {branchSummary.total === 0 && (
                  <div
                    className={styles.alertCard}
                    style={{
                      backgroundColor: 'rgba(245, 158, 11, 0.08)',
                      border: '1px solid rgba(245, 158, 11, 0.25)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <AlertTriangle size={20} color="#fbbf24" style={{ flexShrink: 0 }} />
                      <div>
                        <div style={{ fontWeight: 700, color: '#ffffff' }}>Branch Setup Required</div>
                        <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                          Register your first workplace branch to configure IP and Geofence attendance parameters.
                        </div>
                      </div>
                    </div>
                    <Link href={`/${orgCode}/admin/branches`} className="btn btn-warning btn-sm">
                      Configure Branches &rarr;
                    </Link>
                  </div>
                )}

                {staffSummary.total === 0 && (
                  <div
                    className={styles.alertCard}
                    style={{
                      backgroundColor: 'rgba(99, 102, 241, 0.08)',
                      border: '1px solid rgba(99, 102, 241, 0.25)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Users size={20} color="#818cf8" style={{ flexShrink: 0 }} />
                      <div>
                        <div style={{ fontWeight: 700, color: '#ffffff' }}>Add Staff Members</div>
                        <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                          Onboard staff members to begin assigning shift patterns and verifying attendance.
                        </div>
                      </div>
                    </div>
                    <Link href={`/${orgCode}/admin/staff`} className="btn btn-primary btn-sm">
                      Add Staff &rarr;
                    </Link>
                  </div>
                )}
              </div>

              {/* Key Metrics Grid */}
              <div className={styles.metricsGrid}>
                {/* Branches Metric */}
                <div className={styles.metricCard} style={{ borderLeft: '3px solid #06b6d4' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Workplace Branches
                    </span>
                    <MapPin size={18} color="#38bdf8" />
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: '#ffffff' }}>
                    {branchSummary.total}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    {branchSummary.active} active workplace locations
                  </div>
                </div>

                {/* Staff Metric */}
                <div className={styles.metricCard} style={{ borderLeft: '3px solid #818cf8' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Onboarded Staff
                    </span>
                    <Users size={18} color="#818cf8" />
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: '#ffffff' }}>
                    {staffSummary.total}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    {staffSummary.active} active staff accounts
                  </div>
                </div>

                {/* Shift Patterns Metric */}
                <div className={styles.metricCard} style={{ borderLeft: '3px solid #a855f7' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Shift Patterns
                    </span>
                    <Clock size={18} color="#c084fc" />
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: '#ffffff' }}>
                    {shiftSummary.total}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    {shiftSummary.active} active weekly schedules
                  </div>
                </div>

                {/* Layer 3 Device Metric */}
                <div className={styles.metricCard} style={{ borderLeft: '3px solid #10b981' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Registered Devices (Layer 3)
                    </span>
                    <Smartphone size={18} color="#34d399" />
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: '#34d399' }}>
                    {staffSummary.deviceRegistered}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Bound hardware security secrets
                  </div>
                </div>
              </div>

              {/* Quick Actions Cards */}
              <div className={styles.quickActionsGrid}>
                {/* Shifts Quick Action */}
                <div className={styles.quickActionCard}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                      <Clock size={20} color="#c084fc" />
                      <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#ffffff' }}>
                        Shift Patterns
                      </h3>
                    </div>
                    <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '20px' }}>
                      Configure weekly working schedules, start/end hours, overnight shifts, and minimum staffing thresholds.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <Link href={`/${orgCode}/admin/shifts/new`} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Plus size={14} />
                      <span>New Pattern</span>
                    </Link>
                    <Link href={`/${orgCode}/admin/shifts`} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>Manage Shifts</span>
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>

                {/* Roster Quick Action */}
                <div className={styles.quickActionCard}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                      <Calendar size={20} color="#38bdf8" />
                      <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#ffffff' }}>
                        Roster Calendar
                      </h3>
                    </div>
                    <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '20px' }}>
                      Interactive weekly roster grid with branch filtering, conflict detection, and staff-specific day overrides.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <Link href={`/${orgCode}/admin/roster`} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>Open Roster Calendar</span>
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>

                {/* Staff Directory Quick Action */}
                <div className={styles.quickActionCard}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                      <Users size={20} color="#818cf8" />
                      <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#ffffff' }}>
                        Staff Directory
                      </h3>
                    </div>
                    <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '20px' }}>
                      Manage staff accounts, branch assignments, registered hardware devices, PIN resets, and active status.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <Link href={`/${orgCode}/admin/staff`} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>View Staff Directory</span>
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              </div>

              {/* 3-Layer Security & Rostering Architecture Overview */}
              <div className="glass-card" style={{ padding: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <Layers size={18} color="#818cf8" />
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>
                    Rostering &amp; Multi-Layer Security Architecture
                  </h3>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                  <div style={{ padding: '16px', backgroundColor: 'rgba(6, 182, 212, 0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(6, 182, 212, 0.25)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <Wifi size={16} color="#38bdf8" />
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#38bdf8' }}>Layer 1: Network IP</span>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Configured via Branch network capture &amp; overrides.
                    </p>
                  </div>

                  <div style={{ padding: '16px', backgroundColor: 'rgba(16, 185, 129, 0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <MapPin size={16} color="#34d399" />
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#34d399' }}>Layer 2: GPS Geofence</span>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Per-branch perimeter configuration.
                    </p>
                  </div>

                  <div style={{ padding: '16px', backgroundColor: 'rgba(168, 85, 247, 0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(168, 85, 247, 0.25)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <Smartphone size={16} color="#c084fc" />
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#c084fc' }}>Layer 3: Device Binding</span>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Opaque cryptographic hardware secrets.
                    </p>
                  </div>

                  <div style={{ padding: '16px', backgroundColor: 'rgba(99, 102, 241, 0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(99, 102, 241, 0.25)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <Calendar size={16} color="#818cf8" />
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#818cf8' }}>Layer 4: Shift Roster</span>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Active scheduled shift patterns &amp; day overrides.
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
