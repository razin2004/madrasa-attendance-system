'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SuperAdminSidebar, SuperAdminTab } from '@/components/layout/super-admin-sidebar';
import { SuperAdminMobileNav } from '@/components/layout/super-admin-mobile-nav';
import { useToast } from '@/components/feedback/toast-provider';
import { ConfirmationModal } from '@/components/feedback/confirmation-modal';
import { OrgLogo } from '@/components/branding/org-logo';
import styles from './SuperAdminDashboard.module.css';
import {
  Shield,
  Clock,
  CheckCircle2,
  XCircle,
  History,
  Building2,
  User,
  Mail,
  Phone,
  Calendar,
  ExternalLink,
  Loader2,
  RefreshCw,
  Eye,
  Check,
  X,
  AlertCircle,
  Search,
  Power,
  Trash2,
  Users,
  MapPin,
  FileText,
  AlertTriangle,
  ChevronRight,
  Sparkles,
  UserCheck,
  LayoutDashboard,
  Edit3,
  ShieldAlert,
  Menu,
  Settings,
  Activity,
  LogOut,
  ShieldCheck,
} from 'lucide-react';

interface Organization {
  id: string;
  organizationCode: string | null;
  name: string;
  phone: string | null;
  contactPersonName: string | null;
  contactEmail: string | null;
  logoUrl: string | null;
  status: 'PENDING' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED';
  rejectionReason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
  _count?: {
    branches: number;
    staffProfiles: number;
    users: number;
    attendanceRecords: number;
  };
}

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: any;
  createdAt: string;
  organization?: { name: string; organizationCode: string | null } | null;
  actorUser?: { name: string; email: string } | null;
}

export default function SuperAdminDashboardPage() {
  const router = useRouter();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<SuperAdminTab>('overview');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [counts, setCounts] = useState({
    pending: 0,
    approved: 0,
    suspended: 0,
    rejected: 0,
    totalBranches: 0,
    totalStaff: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [adminEmail, setAdminEmail] = useState('Super Admin');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);


  // Governance Action Modals
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [actionType, setActionType] = useState<'VIEW' | 'APPROVE' | 'REJECT' | 'DEACTIVATE' | 'ACTIVATE' | 'DELETE' | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Change Org Admin State
  const [isChangeAdminModalOpen, setIsChangeAdminModalOpen] = useState(false);
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPhone, setNewAdminPhone] = useState('');
  const [sendAdminInvite, setSendAdminInvite] = useState(true);
  const [isUpdatingAdmin, setIsUpdatingAdmin] = useState(false);

  // Fetch Dashboard Data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      // 1. Verify Session
      const meRes = await fetch('/api/auth/me');
      if (!meRes.ok) {
        router.push('/super-admin/login');
        return;
      }
      const meData = await meRes.json();
      if (meData.user?.role !== 'SUPER_ADMIN') {
        router.push('/super-admin/login');
        return;
      }
      setAdminEmail(meData.user.email);

      // 2. Fetch Organizations & Audit Logs
      const res = await fetch('/api/super-admin/organizations');
      const data = await res.json();

      if (res.ok && data.success) {
        setOrganizations(data.organizations || []);
        setAuditLogs(data.auditLogs || []);
        setCounts(data.counts || { pending: 0, approved: 0, suspended: 0, rejected: 0, totalBranches: 0, totalStaff: 0 });
      } else {
        setHasError(true);
        toast.error(data.error || 'Failed to fetch organizations.');
      }
    } catch (err) {
      setHasError(true);
      toast.error('Network error fetching dashboard data.');
    } finally {
      setIsLoading(false);
    }
  }, [router, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Organization Approval
  const handleApprove = async () => {
    if (!selectedOrg) return;
    setIsProcessing(true);

    try {
      const res = await fetch(`/api/super-admin/organizations/${selectedOrg.id}/approve`, {
        method: 'POST',
      });
      const data = await res.json();

      if (res.ok && data.success) {
        toast.success(`Organization approved! Code: ${data.organization?.organizationCode}`);
        closeModal();
        fetchData();
      } else {
        toast.error(data.error || 'Failed to approve organization.');
      }
    } catch (err) {
      toast.error('Network error during approval.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Organization Rejection
  const handleReject = async () => {
    if (!selectedOrg) return;
    setIsProcessing(true);

    try {
      const res = await fetch(`/api/super-admin/organizations/${selectedOrg.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason: actionReason.trim() }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        toast.info('Organization application rejected.');
        closeModal();
        fetchData();
      } else {
        toast.error(data.error || 'Failed to reject organization.');
      }
    } catch (err) {
      toast.error('Network error during rejection.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Organization Deactivation / Suspension
  const handleDeactivate = async () => {
    if (!selectedOrg) return;
    setIsProcessing(true);

    try {
      const res = await fetch(`/api/super-admin/organizations/${selectedOrg.id}/deactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: actionReason.trim() || 'Deactivated by Super Admin' }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        toast.warning(`Organization "${selectedOrg.name}" has been deactivated.`);
        closeModal();
        fetchData();
      } else {
        toast.error(data.error || 'Failed to deactivate organization.');
      }
    } catch (err) {
      toast.error('Network error during deactivation.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Organization Activation / Restoration
  const handleActivate = async () => {
    if (!selectedOrg) return;
    setIsProcessing(true);

    try {
      const res = await fetch(`/api/super-admin/organizations/${selectedOrg.id}/activate`, {
        method: 'POST',
      });
      const data = await res.json();

      if (res.ok && data.success) {
        toast.success(`Organization "${selectedOrg.name}" is now ACTIVE.`);
        closeModal();
        fetchData();
      } else {
        toast.error(data.error || 'Failed to activate organization.');
      }
    } catch (err) {
      toast.error('Network error during activation.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Organization Deletion
  const handleDelete = async () => {
    if (!selectedOrg) return;
    setIsProcessing(true);

    try {
      const res = await fetch(`/api/super-admin/organizations/${selectedOrg.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (res.ok && data.success) {
        toast.success(`Organization "${selectedOrg.name}" deleted permanently.`);
        closeModal();
        fetchData();
      } else {
        toast.error(data.error || 'Failed to delete organization.');
      }
    } catch (err) {
      toast.error('Network error during deletion.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Changing Org Admin
  const handleChangeAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrg) return;
    if (!newAdminName.trim() || !newAdminEmail.trim()) {
      toast.error('Admin name and email address are required.');
      return;
    }

    setIsUpdatingAdmin(true);
    try {
      const res = await fetch(`/api/super-admin/organizations/${selectedOrg.id}/change-admin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactPersonName: newAdminName.trim(),
          contactEmail: newAdminEmail.trim(),
          phone: newAdminPhone.trim(),
          sendInvitation: sendAdminInvite,
        }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        toast.success(data.message || 'Organization Admin updated successfully!');
        if (data.organization) {
          setSelectedOrg(data.organization);
        }
        setIsChangeAdminModalOpen(false);
        fetchData();
      } else {
        toast.error(data.error || 'Failed to update Organization Admin.');
      }
    } catch (err) {
      toast.error('Network error updating Organization Admin.');
    } finally {
      setIsUpdatingAdmin(false);
    }
  };

  const closeModal = () => {
    setSelectedOrg(null);
    setActionType(null);
    setActionReason('');
    setDeleteConfirmText('');
    setIsProcessing(false);
    setIsChangeAdminModalOpen(false);
  };

  // Real-time Search Filtering
  const filteredOrgs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return organizations;
    return organizations.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        (o.organizationCode && o.organizationCode.toLowerCase().includes(q)) ||
        (o.contactPersonName && o.contactPersonName.toLowerCase().includes(q)) ||
        (o.contactEmail && o.contactEmail.toLowerCase().includes(q))
    );
  }, [organizations, searchQuery]);

  const pendingOrgs = useMemo(() => filteredOrgs.filter((o) => o.status === 'PENDING'), [filteredOrgs]);
  const approvedOrgs = useMemo(() => filteredOrgs.filter((o) => o.status === 'ACTIVE'), [filteredOrgs]);
  const suspendedOrgs = useMemo(() => filteredOrgs.filter((o) => o.status === 'SUSPENDED'), [filteredOrgs]);
  const rejectedOrgs = useMemo(() => filteredOrgs.filter((o) => o.status === 'REJECTED'), [filteredOrgs]);

  return (
    <div className={styles.layoutContainer}>
      {/* Desktop Sidebar */}
      <SuperAdminSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        counts={counts}
        adminEmail={adminEmail}
      />

      {/* Main Content Area */}
      <div className={styles.mainContent}>
        {/* Sticky Top Main Header Bar (Exact match to ShiftGuard Main Header) */}
        <header className={styles.headerBar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #4f46e5 0%, #8b5cf6 100%)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(99, 102, 241, 0.4)',
                flexShrink: 0,
              }}
            >
              <img
                src="/logo.svg"
                alt="ShiftGuard Logo"
                style={{ width: '26px', height: '26px', objectFit: 'contain' }}
              />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '17px', fontWeight: 800, letterSpacing: '-0.4px', color: '#ffffff' }}>
                  ShiftGuard
                </span>
                <span className={styles.headerSuperAdminBadge}>
                  <Shield size={10} /> Super Admin
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                Control Panel &amp; Governance
              </div>
            </div>
          </div>

          <div className={styles.headerControls}>
            {/* Search Input */}
            <div className={styles.searchInputWrapper}>
              <Search size={15} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search organizations or codes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />
            </div>

            <button
              onClick={fetchData}
              disabled={isLoading}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              <span className="desktop-only">Refresh</span>
            </button>

            {/* Mobile Line Button (Hamburger Menu) */}
            <button
              type="button"
              onClick={() => setIsMobileDrawerOpen(true)}
              className={styles.hamburgerBtn}
              title="Control Panel"
              aria-label="Control Panel"
            >
              <Menu size={20} />
            </button>
          </div>
        </header>

        {/* Dashboard Body */}
        <main style={{ padding: '16px', flex: 1 }}>
          {/* CONDITIONAL WARNING BANNER: Shown ONLY if there are pending requests */}
          {counts.pending > 0 && (
            <div
              style={{
                marginBottom: '16px',
                padding: '12px 16px',
                borderRadius: '12px',
                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                color: '#fbbf24',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(245, 158, 11, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <AlertTriangle size={18} color="#fbbf24" />
                </div>
                <div>
                  <strong style={{ color: '#ffffff', fontSize: '13.5px', fontWeight: 800 }}>
                    Attention: Pending Approvals ({counts.pending})
                  </strong>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('pending')}
                className="btn btn-warning btn-xs"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', fontWeight: 700 }}
              >
                <span>Review ({counts.pending})</span>
                <ChevronRight size={14} />
              </button>
            </div>
          )}

          {/* ERROR STATE */}
          {hasError && !isLoading && (
            <div className="glass-card" style={{ padding: '32px 20px', textAlign: 'center', margin: '16px 0' }}>
              <AlertCircle size={32} color="var(--danger-text)" style={{ margin: '0 auto 10px auto' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>
                Unable to load records
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', marginBottom: '16px' }}>
                Something went wrong while retrieving data from server.
              </p>
              <button onClick={fetchData} className="btn btn-primary btn-sm">
                Try Again
              </button>
            </div>
          )}

          {/* LOADING SKELETON */}
          {isLoading && (
            <div className="glass-card" style={{ padding: '36px 20px', textAlign: 'center' }}>
              <Loader2 size={28} className="animate-spin" style={{ color: '#818cf8', margin: '0 auto 10px auto' }} />
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Loading platform applications...
              </div>
            </div>
          )}

          {!isLoading && !hasError && (
            <>
              {/* TAB 0: PLATFORM OVERVIEW PANEL */}
              {activeTab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Metric Cards Panel (2 per row on mobile) */}
                  <div className={styles.metricsGrid}>
                    <div
                      className={styles.metricCard}
                      onClick={() => setActiveTab('pending')}
                    >
                      <div className={styles.metricCardHeader}>
                        <span className={styles.metricTitle}>Pending</span>
                        <div className={styles.metricIconBox} style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
                          <Clock size={16} />
                        </div>
                      </div>
                      <div className={styles.metricValue}>{counts.pending}</div>
                      <div className={styles.metricDescription}>Awaiting review</div>
                    </div>

                    <div
                      className={styles.metricCard}
                      onClick={() => setActiveTab('approved')}
                    >
                      <div className={styles.metricCardHeader}>
                        <span className={styles.metricTitle}>Active</span>
                        <div className={styles.metricIconBox} style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
                          <CheckCircle2 size={16} />
                        </div>
                      </div>
                      <div className={styles.metricValue}>{counts.approved}</div>
                      <div className={styles.metricDescription}>Active tenants</div>
                    </div>

                    <div
                      className={styles.metricCard}
                      onClick={() => setActiveTab('suspended')}
                    >
                      <div className={styles.metricCardHeader}>
                        <span className={styles.metricTitle}>Suspended</span>
                        <div className={styles.metricIconBox} style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }}>
                          <Power size={16} />
                        </div>
                      </div>
                      <div className={styles.metricValue}>{counts.suspended || 0}</div>
                      <div className={styles.metricDescription}>Deactivated access</div>
                    </div>

                    <div
                      className={styles.metricCard}
                      onClick={() => setActiveTab('history')}
                    >
                      <div className={styles.metricCardHeader}>
                        <span className={styles.metricTitle}>Audit Logs</span>
                        <div className={styles.metricIconBox} style={{ backgroundColor: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
                          <History size={16} />
                        </div>
                      </div>
                      <div className={styles.metricValue}>{auditLogs.length}</div>
                      <div className={styles.metricDescription}>Governance history</div>
                    </div>
                  </div>

                  {/* Overview Quick Previews Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                    {/* Active Workspaces Card */}
                    <div className="glass-card" style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <h3 style={{ fontSize: '14.5px', fontWeight: 700, color: '#ffffff', margin: 0 }}>Active Organizations</h3>
                        <button onClick={() => setActiveTab('approved')} className="btn btn-ghost btn-xs" style={{ color: '#38bdf8' }}>
                          View All ({approvedOrgs.length}) →
                        </button>
                      </div>
                      {approvedOrgs.length === 0 ? (
                        <p style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>No active organizations yet.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {approvedOrgs.slice(0, 4).map((org) => (
                            <div
                              key={org.id}
                              style={{
                                padding: '10px 12px',
                                borderRadius: '10px',
                                backgroundColor: 'rgba(255,255,255,0.03)',
                                border: '1px solid var(--border-subtle)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '8px',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
                                  <OrgLogo logoUrl={org.logoUrl} name={org.name} size={16} />
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{org.name}</div>
                                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {org.contactPersonName || org.contactEmail}
                                  </div>
                                </div>
                              </div>
                              <button
                                onClick={() => {
                                  setSelectedOrg(org);
                                  setActionType('VIEW');
                                }}
                                className="btn btn-secondary btn-xs"
                                style={{ padding: '4px 8px', fontSize: '11.5px', flexShrink: 0 }}
                              >
                                <Eye size={13} />
                                <span>Details</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Recent Governance Activity Stream (Item 6 Format) */}
                    <div className="glass-card" style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <h3 style={{ fontSize: '14.5px', fontWeight: 700, color: '#ffffff', margin: 0 }}>Recent Governance Activity</h3>
                        <button onClick={() => setActiveTab('history')} className="btn btn-ghost btn-xs" style={{ color: '#818cf8' }}>
                          Full Audit Log →
                        </button>
                      </div>
                      {auditLogs.length === 0 ? (
                        <p style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>No governance logs recorded yet.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {auditLogs.slice(0, 4).map((log) => (
                            <div
                              key={log.id}
                              style={{
                                padding: '10px 12px',
                                borderRadius: '10px',
                                backgroundColor: 'rgba(255,255,255,0.02)',
                                border: '1px solid var(--border-subtle)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px',
                              }}
                            >
                              {/* Line 1: Action on left, timestamp on right */}
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontWeight: 700, color: '#ffffff', fontSize: '12px', letterSpacing: '0.2px' }}>
                                  {log.action}
                                </span>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>
                                  {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              {/* Line 2: Org name at bottom of line 1 */}
                              <div style={{ fontSize: '11.5px', color: '#38bdf8', fontWeight: 600 }}>
                                {log.organization?.name || log.metadata?.organizationName || log.metadata?.name || 'Platform Level'}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 1: PENDING APPROVALS */}
              {activeTab === 'pending' && (
                <div>
                  {pendingOrgs.length === 0 ? (
                    <div className="glass-card" style={{ padding: '60px 24px', textAlign: 'center' }}>
                      <div
                        style={{
                          width: '56px',
                          height: '56px',
                          borderRadius: '50%',
                          backgroundColor: 'rgba(16, 185, 129, 0.12)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          margin: '0 auto 16px auto',
                        }}
                      >
                        <CheckCircle2 size={28} color="#34d399" />
                      </div>
                      <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>
                        All Pending Requests Reviewed!
                      </h3>
                      <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}>
                        There are currently no new organization applications awaiting review.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Desktop Table View */}
                      <div className={`table-container glass-card ${styles.tableContainerDesktop}`}>
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th style={{ padding: '14px 20px', fontSize: '11.5px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
                                Organization
                              </th>
                              <th style={{ padding: '14px 20px', fontSize: '11.5px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
                                Primary Contact
                              </th>
                              <th style={{ padding: '14px 20px', fontSize: '11.5px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
                                Submitted Date
                              </th>
                              <th style={{ padding: '14px 20px', fontSize: '11.5px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
                                Status
                              </th>
                              <th style={{ padding: '14px 20px', fontSize: '11.5px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'right' }}>
                                Action
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {pendingOrgs.map((org) => (
                              <tr key={org.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                <td style={{ padding: '16px 20px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div
                                      style={{
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '10px',
                                        backgroundColor: 'rgba(255,255,255,0.03)',
                                        border: '1px solid var(--border-subtle)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        overflow: 'hidden',
                                        flexShrink: 0,
                                      }}
                                    >
                                      <OrgLogo logoUrl={org.logoUrl} name={org.name} size={20} />
                                    </div>
                                    <span style={{ fontWeight: 700, color: '#ffffff', fontSize: '14.5px' }}>{org.name}</span>
                                  </div>
                                </td>
                                <td style={{ padding: '16px 20px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
                                    <User size={13} color="var(--text-muted)" />
                                    <span>{org.contactPersonName || 'N/A'}</span>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '3px' }}>
                                    <Mail size={12} color="var(--text-muted)" />
                                    <span>{org.contactEmail || 'N/A'}</span>
                                  </div>
                                </td>
                                <td style={{ padding: '16px 20px', color: 'var(--text-muted)', fontSize: '12.5px' }}>
                                  {new Date(org.createdAt).toLocaleDateString()}
                                </td>
                                <td style={{ padding: '16px 20px' }}>
                                  <span className="badge badge-pending">PENDING</span>
                                </td>
                                <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                                  <button
                                    onClick={() => {
                                      setSelectedOrg(org);
                                      setActionType('VIEW');
                                    }}
                                    className="btn btn-secondary btn-sm"
                                  >
                                    <Eye size={14} />
                                    <span>Details</span>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile Card List */}
                      <div className={styles.mobileCardList}>
                        {pendingOrgs.map((org) => (
                          <div key={org.id} className={styles.mobileOrgCard}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '38px', height: '38px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0 }}>
                                  <OrgLogo logoUrl={org.logoUrl} name={org.name} size={18} />
                                </div>
                                <div>
                                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff' }}>{org.name}</div>
                                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                    Contact: {org.contactPersonName || org.contactEmail}
                                  </div>
                                </div>
                              </div>
                              <span className="badge badge-pending">PENDING</span>
                            </div>

                            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                              <div style={{ flex: 1, padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.2)', textAlign: 'center' }}>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Branches</div>
                                <div style={{ fontSize: '14px', fontWeight: 800, color: '#38bdf8', marginTop: '2px' }}>{org._count?.branches || 0}</div>
                              </div>
                              <div style={{ flex: 1, padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(192, 132, 252, 0.08)', border: '1px solid rgba(192, 132, 252, 0.2)', textAlign: 'center' }}>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Active Staff</div>
                                <div style={{ fontSize: '14px', fontWeight: 800, color: '#c084fc', marginTop: '2px' }}>{org._count?.staffProfiles || 0}</div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                              <button
                                onClick={() => { setSelectedOrg(org); setActionType('VIEW'); }}
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '8px 12px' }}
                                title="View Details"
                                aria-label="View Details"
                              >
                                <Eye size={16} />
                              </button>
                              <button
                                onClick={() => { setSelectedOrg(org); handleApprove(); }}
                                className="btn btn-success btn-sm"
                                style={{ padding: '8px 12px' }}
                                title="Approve Organization"
                                aria-label="Approve Organization"
                              >
                                <Check size={16} />
                              </button>
                              <button
                                onClick={() => { setSelectedOrg(org); setActionType('REJECT'); }}
                                className="btn btn-danger btn-sm"
                                style={{ padding: '8px 12px' }}
                                title="Reject Application"
                                aria-label="Reject Application"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* TAB 2: ACTIVE ORGANIZATIONS */}
              {activeTab === 'approved' && (
                <div>
                  {approvedOrgs.length === 0 ? (
                    <div className="glass-card" style={{ padding: '60px 24px', textAlign: 'center' }}>
                      <p style={{ color: 'var(--text-secondary)' }}>No active organizations registered yet.</p>
                    </div>
                  ) : (
                    <>
                      {/* Desktop Table */}
                      <div className={`table-container glass-card ${styles.tableContainerDesktop}`}>
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th style={{ padding: '14px 20px', fontSize: '11.5px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
                                Organization &amp; Code
                              </th>
                              <th style={{ padding: '14px 20px', fontSize: '11.5px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
                                Primary Contact
                              </th>
                              <th style={{ padding: '14px 20px', fontSize: '11.5px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
                                Workforce &amp; Geofence
                              </th>
                              <th style={{ padding: '14px 20px', fontSize: '11.5px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
                                Status
                              </th>
                              <th style={{ padding: '14px 20px', fontSize: '11.5px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'right' }}>
                                Action
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {approvedOrgs.map((org) => (
                              <tr key={org.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                {/* 1. Organization & Code */}
                                <td style={{ padding: '16px 20px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div
                                      style={{
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '10px',
                                        backgroundColor: 'rgba(255,255,255,0.03)',
                                        border: '1px solid var(--border-subtle)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        overflow: 'hidden',
                                        flexShrink: 0,
                                      }}
                                    >
                                      <OrgLogo logoUrl={org.logoUrl} name={org.name} size={20} />
                                    </div>
                                    <div>
                                      <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '14.5px' }}>{org.name}</div>
                                      {org.organizationCode && (
                                        <span
                                          style={{
                                            fontSize: '10.5px',
                                            fontFamily: 'var(--font-mono)',
                                            fontWeight: 800,
                                            color: '#38bdf8',
                                            backgroundColor: 'rgba(6, 182, 212, 0.12)',
                                            border: '1px solid rgba(6, 182, 212, 0.3)',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            marginTop: '3px',
                                            display: 'inline-block',
                                          }}
                                        >
                                          CODE: {org.organizationCode}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </td>

                                {/* 2. Primary Contact */}
                                <td style={{ padding: '16px 20px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
                                    <User size={13} color="var(--text-muted)" />
                                    <span>{org.contactPersonName || 'N/A'}</span>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '3px' }}>
                                    <Mail size={12} color="var(--text-muted)" />
                                    <span>{org.contactEmail || 'N/A'}</span>
                                  </div>
                                </td>

                                {/* 3. Workforce & Geofence */}
                                <td style={{ padding: '16px 20px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <span
                                      style={{
                                        fontSize: '12px',
                                        fontWeight: 700,
                                        padding: '3px 9px',
                                        borderRadius: '6px',
                                        backgroundColor: 'rgba(56, 189, 248, 0.12)',
                                        color: '#38bdf8',
                                        border: '1px solid rgba(56, 189, 248, 0.25)',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                      }}
                                    >
                                      <MapPin size={12} /> {org._count?.branches || 0} {org._count?.branches === 1 ? 'Branch' : 'Branches'}
                                    </span>
                                    <span
                                      style={{
                                        fontSize: '12px',
                                        fontWeight: 700,
                                        padding: '3px 9px',
                                        borderRadius: '6px',
                                        backgroundColor: 'rgba(192, 132, 252, 0.12)',
                                        color: '#c084fc',
                                        border: '1px solid rgba(192, 132, 252, 0.25)',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                      }}
                                    >
                                      <Users size={12} /> {org._count?.staffProfiles || 0} Staff
                                    </span>
                                  </div>
                                </td>

                                {/* 4. Status */}
                                <td style={{ padding: '16px 20px' }}>
                                  <span className="badge badge-active">ACTIVE</span>
                                </td>

                                {/* 5. Action */}
                                <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                                  <button
                                    onClick={() => {
                                      setSelectedOrg(org);
                                      setActionType('VIEW');
                                    }}
                                    className="btn btn-secondary btn-sm"
                                    title="View Organization Details & Actions"
                                  >
                                    <Eye size={14} />
                                    <span>Details</span>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile Card List */}
                      <div className={styles.mobileCardList}>
                        {approvedOrgs.map((org) => (
                          <div key={org.id} className={styles.mobileOrgCard}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '38px', height: '38px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0 }}>
                                  <OrgLogo logoUrl={org.logoUrl} name={org.name} size={18} />
                                </div>
                                <div>
                                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff' }}>{org.name}</div>
                                  {org.organizationCode && (
                                    <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#38bdf8', fontWeight: 700 }}>
                                      CODE: {org.organizationCode}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span className="badge badge-active">ACTIVE</span>
                            </div>

                            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                              <div style={{ flex: 1, padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.2)', textAlign: 'center' }}>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Branches</div>
                                <div style={{ fontSize: '14px', fontWeight: 800, color: '#38bdf8', marginTop: '2px' }}>{org._count?.branches || 0}</div>
                              </div>
                              <div style={{ flex: 1, padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(192, 132, 252, 0.08)', border: '1px solid rgba(192, 132, 252, 0.2)', textAlign: 'center' }}>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Active Staff</div>
                                <div style={{ fontSize: '14px', fontWeight: 800, color: '#c084fc', marginTop: '2px' }}>{org._count?.staffProfiles || 0}</div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                              <button
                                onClick={() => { setSelectedOrg(org); setActionType('VIEW'); }}
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '8px 12px' }}
                                title="View Details"
                                aria-label="View Details"
                              >
                                <Eye size={16} />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedOrg(org);
                                  setNewAdminName(org.contactPersonName || '');
                                  setNewAdminEmail(org.contactEmail || '');
                                  setNewAdminPhone(org.phone || '');
                                  setIsChangeAdminModalOpen(true);
                                }}
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '8px 12px' }}
                                title="Edit Admin"
                                aria-label="Edit Admin"
                              >
                                <Edit3 size={16} />
                              </button>
                              <button
                                onClick={() => { setSelectedOrg(org); setActionType('DEACTIVATE'); }}
                                className="btn btn-warning btn-sm"
                                style={{ padding: '8px 12px' }}
                                title="Deactivate Organization"
                                aria-label="Deactivate Organization"
                              >
                                <ShieldAlert size={16} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* TAB 3: DEACTIVATED / SUSPENDED ORGANIZATIONS */}
              {activeTab === 'suspended' && (
                <div>
                  {suspendedOrgs.length === 0 ? (
                    <div className="glass-card" style={{ padding: '60px 24px', textAlign: 'center' }}>
                      <p style={{ color: 'var(--text-secondary)' }}>No deactivated or suspended organizations.</p>
                    </div>
                  ) : (
                    <>
                      <div className={`table-container glass-card ${styles.tableContainerDesktop}`}>
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th style={{ padding: '14px 20px', fontSize: '11.5px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
                                Organization &amp; Code
                              </th>
                              <th style={{ padding: '14px 20px', fontSize: '11.5px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
                                Primary Contact
                              </th>
                              <th style={{ padding: '14px 20px', fontSize: '11.5px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
                                Deactivation Reason
                              </th>
                              <th style={{ padding: '14px 20px', fontSize: '11.5px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
                                Status
                              </th>
                              <th style={{ padding: '14px 20px', fontSize: '11.5px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'right' }}>
                                Action
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {suspendedOrgs.map((org) => (
                              <tr key={org.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                <td style={{ padding: '16px 20px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div
                                      style={{
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '10px',
                                        backgroundColor: 'rgba(255,255,255,0.03)',
                                        border: '1px solid var(--border-subtle)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        overflow: 'hidden',
                                        flexShrink: 0,
                                      }}
                                    >
                                      <OrgLogo logoUrl={org.logoUrl} name={org.name} size={20} />
                                    </div>
                                    <div>
                                      <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '14.5px' }}>{org.name}</div>
                                      {org.organizationCode && (
                                        <span
                                          style={{
                                            fontSize: '10.5px',
                                            fontFamily: 'var(--font-mono)',
                                            fontWeight: 800,
                                            color: '#f87171',
                                            backgroundColor: 'rgba(239, 68, 68, 0.12)',
                                            border: '1px solid rgba(239, 68, 68, 0.3)',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            marginTop: '3px',
                                            display: 'inline-block',
                                          }}
                                        >
                                          CODE: {org.organizationCode}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </td>

                                <td style={{ padding: '16px 20px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
                                    <User size={13} color="var(--text-muted)" />
                                    <span>{org.contactPersonName || 'N/A'}</span>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '3px' }}>
                                    <Mail size={12} color="var(--text-muted)" />
                                    <span>{org.contactEmail || 'N/A'}</span>
                                  </div>
                                </td>

                                <td style={{ padding: '16px 20px', color: '#f87171', fontSize: '13px' }}>
                                  {org.rejectionReason || 'Deactivated by Super Admin'}
                                </td>

                                <td style={{ padding: '16px 20px' }}>
                                  <span className="badge badge-danger">SUSPENDED</span>
                                </td>

                                <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                                  <button
                                    onClick={() => {
                                      setSelectedOrg(org);
                                      setActionType('VIEW');
                                    }}
                                    className="btn btn-secondary btn-sm"
                                  >
                                    <Eye size={14} />
                                    <span>Details</span>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile View */}
                      <div className={styles.mobileCardList}>
                        {suspendedOrgs.map((org) => (
                          <div key={org.id} className={styles.mobileOrgCard}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '38px', height: '38px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0 }}>
                                  <OrgLogo logoUrl={org.logoUrl} name={org.name} size={18} />
                                </div>
                                <div>
                                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff' }}>{org.name}</div>
                                  <span style={{ fontSize: '11px', color: '#f87171', fontWeight: 700 }}>CODE: {org.organizationCode}</span>
                                </div>
                              </div>
                              <span className="badge badge-danger">SUSPENDED</span>
                            </div>

                            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                              <div style={{ flex: 1, padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.2)', textAlign: 'center' }}>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Branches</div>
                                <div style={{ fontSize: '14px', fontWeight: 800, color: '#38bdf8', marginTop: '2px' }}>{org._count?.branches || 0}</div>
                              </div>
                              <div style={{ flex: 1, padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(192, 132, 252, 0.08)', border: '1px solid rgba(192, 132, 252, 0.2)', textAlign: 'center' }}>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Active Staff</div>
                                <div style={{ fontSize: '14px', fontWeight: 800, color: '#c084fc', marginTop: '2px' }}>{org._count?.staffProfiles || 0}</div>
                              </div>
                            </div>

                            <div style={{ fontSize: '12.5px', color: '#f87171', marginBottom: '12px', padding: '8px 12px', backgroundColor: 'rgba(239, 68, 68, 0.08)', borderRadius: '6px' }}>
                              Reason: {org.rejectionReason || 'Deactivated by Super Admin'}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                              <button
                                onClick={() => { setSelectedOrg(org); setActionType('VIEW'); }}
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '8px 12px' }}
                                title="View Details"
                                aria-label="View Details"
                              >
                                <Eye size={16} />
                              </button>
                              <button
                                onClick={() => { setSelectedOrg(org); setActionType('ACTIVATE'); }}
                                className="btn btn-success btn-sm"
                                style={{ padding: '8px 12px' }}
                                title="Reactivate Organization"
                                aria-label="Reactivate Organization"
                              >
                                <Power size={16} />
                              </button>
                              <button
                                onClick={() => { setSelectedOrg(org); setActionType('DELETE'); }}
                                className="btn btn-danger btn-sm"
                                style={{ padding: '8px 12px' }}
                                title="Delete Organization"
                                aria-label="Delete Organization"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* TAB 4: REJECTED APPLICATIONS */}
              {activeTab === 'rejected' && (
                <div>
                  {rejectedOrgs.length === 0 ? (
                    <div className="glass-card" style={{ padding: '60px 24px', textAlign: 'center' }}>
                      <p style={{ color: 'var(--text-secondary)' }}>No rejected applications.</p>
                    </div>
                  ) : (
                    <>
                      <div className={`table-container glass-card ${styles.tableContainerDesktop}`}>
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th style={{ padding: '14px 20px', fontSize: '11.5px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
                                Organization
                              </th>
                              <th style={{ padding: '14px 20px', fontSize: '11.5px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
                                Primary Contact
                              </th>
                              <th style={{ padding: '14px 20px', fontSize: '11.5px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
                                Rejection Reason
                              </th>
                              <th style={{ padding: '14px 20px', fontSize: '11.5px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
                                Status
                              </th>
                              <th style={{ padding: '14px 20px', fontSize: '11.5px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'right' }}>
                                Action
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {rejectedOrgs.map((org) => (
                              <tr key={org.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                <td style={{ padding: '16px 20px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0 }}>
                                      <OrgLogo logoUrl={org.logoUrl} name={org.name} size={20} />
                                    </div>
                                    <span style={{ fontWeight: 700, color: '#ffffff', fontSize: '14.5px' }}>{org.name}</span>
                                  </div>
                                </td>
                                <td style={{ padding: '16px 20px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
                                    <User size={13} color="var(--text-muted)" />
                                    <span>{org.contactPersonName || 'N/A'}</span>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '3px' }}>
                                    <Mail size={12} color="var(--text-muted)" />
                                    <span>{org.contactEmail || 'N/A'}</span>
                                  </div>
                                </td>
                                <td style={{ padding: '16px 20px', color: 'var(--danger-text)', fontSize: '13px' }}>
                                  {org.rejectionReason || 'No reason specified'}
                                </td>
                                <td style={{ padding: '16px 20px' }}>
                                  <span className="badge badge-rejected">REJECTED</span>
                                </td>
                                <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                                  <button
                                    onClick={() => {
                                      setSelectedOrg(org);
                                      setActionType('VIEW');
                                    }}
                                    className="btn btn-secondary btn-sm"
                                  >
                                    <Eye size={14} />
                                    <span>Details</span>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile View */}
                      <div className={styles.mobileCardList}>
                        {rejectedOrgs.map((org) => (
                          <div key={org.id} className={styles.mobileOrgCard}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '38px', height: '38px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0 }}>
                                  <OrgLogo logoUrl={org.logoUrl} name={org.name} size={18} />
                                </div>
                                <span style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff' }}>{org.name}</span>
                              </div>
                              <span className="badge badge-rejected">REJECTED</span>
                            </div>

                            <div style={{ fontSize: '12.5px', color: '#f87171', marginBottom: '12px', padding: '8px 12px', backgroundColor: 'rgba(239, 68, 68, 0.08)', borderRadius: '6px' }}>
                              Reason: {org.rejectionReason || 'No reason specified'}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                              <button
                                onClick={() => { setSelectedOrg(org); setActionType('VIEW'); }}
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '8px 12px' }}
                                title="View Details"
                                aria-label="View Details"
                              >
                                <Eye size={16} />
                              </button>
                              <button
                                onClick={() => { setSelectedOrg(org); setActionType('ACTIVATE'); }}
                                className="btn btn-success btn-sm"
                                style={{ padding: '8px 12px' }}
                                title="Re-evaluate / Activate"
                                aria-label="Re-evaluate / Activate"
                              >
                                <RefreshCw size={16} />
                              </button>
                              <button
                                onClick={() => { setSelectedOrg(org); setActionType('DELETE'); }}
                                className="btn btn-danger btn-sm"
                                style={{ padding: '8px 12px' }}
                                title="Delete Organization"
                                aria-label="Delete Organization"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* TAB 5: AUDIT HISTORY */}
              {activeTab === 'history' && (
                <div>
                  {/* Desktop Table View */}
                  <div className={`table-container glass-card ${styles.tableContainerDesktop}`}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th style={{ padding: '14px 20px', fontSize: '11.5px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Timestamp</th>
                          <th style={{ padding: '14px 20px', fontSize: '11.5px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Action</th>
                          <th style={{ padding: '14px 20px', fontSize: '11.5px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Entity</th>
                          <th style={{ padding: '14px 20px', fontSize: '11.5px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Target Organization</th>
                          <th style={{ padding: '14px 20px', fontSize: '11.5px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Actor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLogs.map((log) => (
                          <tr key={log.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '16px 20px', color: 'var(--text-muted)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                              {new Date(log.createdAt).toLocaleString()}
                            </td>
                            <td style={{ padding: '16px 20px' }}>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  fontWeight: 700,
                                  fontSize: '12px',
                                  color: log.action.includes('APPROVED') || log.action.includes('ACTIVATED') ? '#34d399' : log.action.includes('REJECTED') || log.action.includes('DEACTIVATED') || log.action.includes('DELETED') ? '#f87171' : '#38bdf8'
                                }}
                              >
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: log.action.includes('APPROVED') || log.action.includes('ACTIVATED') ? '#10b981' : log.action.includes('REJECTED') || log.action.includes('DEACTIVATED') || log.action.includes('DELETED') ? '#ef4444' : '#38bdf8' }} />
                                {log.action}
                              </span>
                            </td>
                            <td style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontSize: '13px' }}>{log.entityType}</td>
                            <td style={{ padding: '16px 20px', color: '#ffffff', fontWeight: 600 }}>
                              {log.organization?.name || log.metadata?.organizationName || log.metadata?.name || log.entityId || 'N/A'}
                            </td>
                            <td style={{ padding: '16px 20px', color: 'var(--text-muted)', fontSize: '12px' }}>
                              {log.actorUser?.email || 'Super Admin'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card List View */}
                  <div className={styles.mobileCardList}>
                    {auditLogs.map((log) => (
                      <div key={log.id} className={styles.mobileOrgCard}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontWeight: 700,
                              fontSize: '12.5px',
                              color: log.action.includes('APPROVED') || log.action.includes('ACTIVATED') ? '#34d399' : log.action.includes('REJECTED') || log.action.includes('DEACTIVATED') || log.action.includes('DELETED') ? '#f87171' : '#38bdf8'
                            }}
                          >
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: log.action.includes('APPROVED') || log.action.includes('ACTIVATED') ? '#10b981' : log.action.includes('REJECTED') || log.action.includes('DEACTIVATED') || log.action.includes('DELETED') ? '#ef4444' : '#38bdf8' }} />
                            {log.action}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {new Date(log.createdAt).toLocaleDateString()} {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', marginBottom: '4px' }}>
                          {log.organization?.name || log.metadata?.organizationName || log.metadata?.name || 'Platform Governance'}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                          <span>Entity: {log.entityType}</span>
                          <span>Actor: {log.actorUser?.email || 'Super Admin'}</span>
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

      {/* Mobile Bottom Navigation Bar */}
      <SuperAdminMobileNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        counts={counts}
      />

      {/* MODAL 1: APPROVE CONFIRMATION */}
      {selectedOrg && actionType === 'APPROVE' && (
        <ConfirmationModal
          isOpen={Boolean(selectedOrg && actionType === 'APPROVE')}
          onClose={closeModal}
          onConfirm={handleApprove}
          title={`Approve ${selectedOrg.name}?`}
          message="Approving this request will activate the organization, assign a unique Organization Code, create the primary Organization Admin account, and dispatch initial login credentials."
          confirmText={isProcessing ? 'Approving...' : 'Approve Organization'}
          variant="primary"
          isLoading={isProcessing}
        />
      )}

      {/* MODAL 2: ACTIVATE CONFIRMATION */}
      {selectedOrg && actionType === 'ACTIVATE' && (
        <ConfirmationModal
          isOpen={Boolean(selectedOrg && actionType === 'ACTIVATE')}
          onClose={closeModal}
          onConfirm={handleActivate}
          title={`Reactivate ${selectedOrg.name}?`}
          message="Reactivating this organization will restore login access and attendance punching capabilities for all assigned staff members and organization admins."
          confirmText={isProcessing ? 'Activating...' : 'Reactivate Organization'}
          variant="primary"
          isLoading={isProcessing}
        />
      )}

      {/* MODAL 3: DEACTIVATE MODAL */}
      {selectedOrg && actionType === 'DEACTIVATE' && (
        <div className="modal-overlay" onClick={closeModal}>
          <div
            className="modal-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby="deactivate-org-title"
            onClick={(e) => e.stopPropagation()}
            style={{ padding: '28px', maxWidth: '480px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Power size={22} color="#f87171" />
                <h3 id="deactivate-org-title" style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff' }}>
                  Deactivate Organization
                </h3>
              </div>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '16px' }}>
              Are you sure you want to deactivate <strong>{selectedOrg.name}</strong> ({selectedOrg.organizationCode})? Staff and admins trying to log in will be shown a deactivation message.
            </p>

            <div style={{ marginBottom: '20px' }}>
              <label className="form-label" htmlFor="deactivateReason" style={{ fontSize: '12.5px', fontWeight: 600, color: '#ffffff' }}>
                Deactivation Reason (Optional)
              </label>
              <textarea
                id="deactivateReason"
                rows={3}
                placeholder="e.g. Non-payment of subscription / Compliance review..."
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                disabled={isProcessing}
                className="form-input"
                style={{ width: '100%', resize: 'vertical', marginTop: '6px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={closeModal} disabled={isProcessing} className="btn btn-secondary btn-sm">
                Cancel
              </button>
              <button type="button" onClick={handleDeactivate} disabled={isProcessing} className="btn btn-danger btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Power size={14} />}
                <span>{isProcessing ? 'Deactivating...' : 'Deactivate Organization'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: DELETE CONFIRMATION MODAL */}
      {selectedOrg && actionType === 'DELETE' && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: '28px', maxWidth: '480px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertTriangle size={22} color="var(--danger-text)" />
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff' }}>
                  Delete Organization Permanently
                </h3>
              </div>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <div style={{ padding: '14px', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', fontSize: '13px', marginBottom: '16px' }}>
              ⚠️ <strong>Warning:</strong> This action cannot be undone. Deleting <strong>{selectedOrg.name}</strong> will remove all registered branches ({selectedOrg._count?.branches || 0}), staff profiles ({selectedOrg._count?.staffProfiles || 0}), and attendance records ({selectedOrg._count?.attendanceRecords || 0}) permanently.
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              To confirm deletion, type <strong>{selectedOrg.organizationCode || selectedOrg.name}</strong> below:
            </p>

            <input
              type="text"
              placeholder={`Type "${selectedOrg.organizationCode || selectedOrg.name}"`}
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="form-input"
              style={{ width: '100%', marginBottom: '20px', fontFamily: 'var(--font-mono)' }}
            />

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={closeModal} disabled={isProcessing} className="btn btn-secondary btn-sm">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isProcessing || deleteConfirmText.trim() !== (selectedOrg.organizationCode || selectedOrg.name)}
                className="btn btn-danger btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span>{isProcessing ? 'Deleting...' : 'Delete Organization'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: PREMIUM ORGANIZATION DETAILS POPUP (STAFF-PROFILE STYLE) */}
      {selectedOrg && (actionType === 'REJECT' || actionType === 'VIEW') && !isChangeAdminModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div
            className={`modal-content glass-card ${actionType === 'VIEW' ? styles.fullScreenMobileModal : ''}`}
            onClick={(e) => e.stopPropagation()}
            style={{
              padding: '24px',
              maxWidth: '680px',
              width: '100%',
              borderRadius: '20px',
              border: '1px solid rgba(99, 102, 241, 0.35)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            {/* Header Banner */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div
                  style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '16px',
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border-medium)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    flexShrink: 0,
                    boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
                  }}
                >
                  <OrgLogo logoUrl={selectedOrg.logoUrl} name={selectedOrg.name} size={28} />
                </div>
                <div>
                  <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.3px' }}>
                    {selectedOrg.name}
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                    {selectedOrg.organizationCode && (
                      <span
                        style={{
                          fontSize: '11.5px',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 800,
                          color: '#38bdf8',
                          backgroundColor: 'rgba(6, 182, 212, 0.15)',
                          border: '1px solid rgba(6, 182, 212, 0.35)',
                          padding: '2px 8px',
                          borderRadius: '6px',
                        }}
                      >
                        CODE: {selectedOrg.organizationCode}
                      </span>
                    )}
                    <span className={`badge badge-${selectedOrg.status.toLowerCase()}`}>
                      {selectedOrg.status}
                    </span>
                  </div>
                </div>
              </div>
              <button onClick={closeModal} className="btn btn-ghost btn-sm" style={{ padding: '6px', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            {/* Quick Metrics Cards (Branches & Staff Profiles) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '24px' }}>
              <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)', textAlign: 'center' }}>
                <MapPin size={18} color="#38bdf8" style={{ margin: '0 auto 4px auto' }} />
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Branches</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#38bdf8', marginTop: '2px' }}>{selectedOrg._count?.branches || 0}</div>
              </div>

              <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: 'rgba(192, 132, 252, 0.08)', border: '1px solid rgba(192, 132, 252, 0.25)', textAlign: 'center' }}>
                <Users size={18} color="#c084fc" style={{ margin: '0 auto 4px auto' }} />
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Staff Profiles</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#c084fc', marginTop: '2px' }}>{selectedOrg._count?.staffProfiles || 0}</div>
              </div>
            </div>

            {/* Information Grid Box */}
            <div
              style={{
                backgroundColor: 'rgba(13, 18, 31, 0.85)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '14px',
                padding: '20px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '16px',
                marginBottom: '24px',
                fontSize: '13.5px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <User size={13} color="#818cf8" /> Contact Person
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNewAdminName(selectedOrg.contactPersonName || '');
                      setNewAdminEmail(selectedOrg.contactEmail || '');
                      setNewAdminPhone(selectedOrg.phone || '');
                      setIsChangeAdminModalOpen(true);
                    }}
                    className="btn btn-secondary btn-xs"
                    style={{ fontSize: '11px', padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    title="Change primary Organization Admin"
                  >
                    <UserCheck size={12} />
                    <span>Change Admin</span>
                  </button>
                </div>
                <div style={{ color: '#ffffff', fontWeight: 700 }}>{selectedOrg.contactPersonName || 'N/A'}</div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Mail size={13} color="#38bdf8" /> Contact Email
                </div>
                <div style={{ color: '#38bdf8', fontWeight: 700, wordBreak: 'break-all' }}>{selectedOrg.contactEmail || 'N/A'}</div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Phone size={13} color="#34d399" /> Phone Number
                </div>
                <div style={{ color: '#ffffff', fontWeight: 700 }}>{selectedOrg.phone || 'N/A'}</div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={13} color="#c084fc" /> Registration Date
                </div>
                <div style={{ color: '#cbd5e1' }}>{new Date(selectedOrg.createdAt).toLocaleString()}</div>
              </div>

              {selectedOrg.reviewedBy && (
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>
                    Reviewed By
                  </div>
                  <div style={{ color: '#cbd5e1' }}>{selectedOrg.reviewedBy}</div>
                </div>
              )}

              {selectedOrg.approvedAt && (
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>
                    Approved At
                  </div>
                  <div style={{ color: '#cbd5e1' }}>{new Date(selectedOrg.approvedAt).toLocaleString()}</div>
                </div>
              )}
            </div>

            {/* Suspended or Rejected Reason Alert Box */}
            {(selectedOrg.status === 'SUSPENDED' || selectedOrg.status === 'REJECTED') && selectedOrg.rejectionReason && (
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#f87171',
                  fontSize: '13px',
                  marginBottom: '24px',
                }}
              >
                <strong style={{ color: '#ffffff', display: 'block', marginBottom: '2px' }}>
                  {selectedOrg.status === 'SUSPENDED' ? 'Deactivation Reason Note:' : 'Rejection Guidance Note:'}
                </strong>
                {selectedOrg.rejectionReason}
              </div>
            )}

            {/* Direct Tenant Login Portal Card */}
            {selectedOrg.organizationCode && selectedOrg.status === 'ACTIVE' && (
              <div
                style={{
                  padding: '16px 20px',
                  borderRadius: '14px',
                  backgroundColor: 'rgba(56, 189, 248, 0.08)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '24px',
                }}
              >
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>Tenant Login Portal</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Access this organization&apos;s workspace portal URL: <strong>/{selectedOrg.organizationCode}/login</strong>
                  </div>
                </div>
                <Link
                  href={`/${selectedOrg.organizationCode}/login`}
                  target="_blank"
                  className="btn btn-primary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <span>Open Portal</span>
                  <ExternalLink size={14} />
                </Link>
              </div>
            )}

            {actionType === 'REJECT' && (
              <div style={{ marginBottom: '24px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="rejectionReason" style={{ fontWeight: 700, color: '#ffffff' }}>
                    Rejection Guidance Note
                  </label>
                  <textarea
                    id="rejectionReason"
                    rows={3}
                    placeholder="Provide guidance or reason for rejecting this application..."
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    disabled={isProcessing}
                    className="form-input"
                    style={{ resize: 'vertical', marginTop: '6px' }}
                  />
                </div>
              </div>
            )}

            {/* Bottom Actions Bar (All Governance Actions inside Details Popup) */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
              <button type="button" onClick={closeModal} disabled={isProcessing} className="btn btn-secondary btn-sm">
                Close
              </button>

              {/* PENDING ACTIONS */}
              {actionType === 'VIEW' && selectedOrg.status === 'PENDING' && (
                <>
                  <button
                    type="button"
                    onClick={() => setActionType('REJECT')}
                    className="btn btn-danger btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <X size={14} />
                    <span>Reject Application</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApprove()}
                    disabled={isProcessing}
                    className="btn btn-success btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    <span>{isProcessing ? 'Approving...' : 'Approve Application'}</span>
                  </button>
                </>
              )}

              {/* ACTIVE ACTIONS */}
              {actionType === 'VIEW' && selectedOrg.status === 'ACTIVE' && (
                <>
                  <button
                    type="button"
                    onClick={() => setActionType('DEACTIVATE')}
                    className="btn btn-warning btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Power size={14} />
                    <span>Deactivate</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionType('DELETE')}
                    className="btn btn-danger btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Trash2 size={14} />
                    <span>Delete</span>
                  </button>
                </>
              )}

              {/* SUSPENDED ACTIONS */}
              {actionType === 'VIEW' && selectedOrg.status === 'SUSPENDED' && (
                <>
                  <button
                    type="button"
                    onClick={() => setActionType('ACTIVATE')}
                    className="btn btn-success btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <CheckCircle2 size={14} />
                    <span>Reactivate</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionType('DELETE')}
                    className="btn btn-danger btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Trash2 size={14} />
                    <span>Delete</span>
                  </button>
                </>
              )}

              {/* REJECTED ACTIONS */}
              {actionType === 'VIEW' && selectedOrg.status === 'REJECTED' && (
                <>
                  <button
                    type="button"
                    onClick={() => setActionType('ACTIVATE')}
                    className="btn btn-success btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <RefreshCw size={14} />
                    <span>Re-evaluate / Activate</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionType('DELETE')}
                    className="btn btn-danger btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Trash2 size={14} />
                    <span>Delete</span>
                  </button>
                </>
              )}

              {/* SUBMIT REJECT FORM */}
              {actionType === 'REJECT' && (
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={isProcessing}
                  className="btn btn-danger btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                  <span>{isProcessing ? 'Rejecting...' : 'Reject Organization'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: CHANGE ORG ADMIN MODAL */}
      {isChangeAdminModalOpen && selectedOrg && (
        <div className="modal-overlay" onClick={() => setIsChangeAdminModalOpen(false)}>
          <div
            className="modal-content glass-card"
            onClick={(e) => e.stopPropagation()}
            style={{ padding: '28px', maxWidth: '480px', width: '100%', borderRadius: '16px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(99, 102, 241, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <UserCheck size={20} color="#818cf8" />
                </div>
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                    Change Organization Admin
                  </h3>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Reassign primary admin for <strong>{selectedOrg.name}</strong>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsChangeAdminModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleChangeAdmin}>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" htmlFor="newAdminName" style={{ fontSize: '12.5px', fontWeight: 600, color: '#ffffff' }}>
                  Admin Full Name
                </label>
                <input
                  id="newAdminName"
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={newAdminName}
                  onChange={(e) => setNewAdminName(e.target.value)}
                  disabled={isUpdatingAdmin}
                  className="form-input"
                  style={{ width: '100%', marginTop: '4px' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" htmlFor="newAdminEmail" style={{ fontSize: '12.5px', fontWeight: 600, color: '#ffffff' }}>
                  Admin Email Address
                </label>
                <input
                  id="newAdminEmail"
                  type="email"
                  required
                  placeholder="e.g. admin@organization.com"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  disabled={isUpdatingAdmin}
                  className="form-input"
                  style={{ width: '100%', marginTop: '4px' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label" htmlFor="newAdminPhone" style={{ fontSize: '12.5px', fontWeight: 600, color: '#ffffff' }}>
                  Phone Number (Optional)
                </label>
                <input
                  id="newAdminPhone"
                  type="tel"
                  placeholder="e.g. +91 9876543210"
                  value={newAdminPhone}
                  onChange={(e) => setNewAdminPhone(e.target.value)}
                  disabled={isUpdatingAdmin}
                  className="form-input"
                  style={{ width: '100%', marginTop: '4px' }}
                />
              </div>

              <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  id="sendAdminInvite"
                  type="checkbox"
                  checked={sendAdminInvite}
                  onChange={(e) => setSendAdminInvite(e.target.checked)}
                  disabled={isUpdatingAdmin}
                  style={{ width: '16px', height: '16px', accentColor: '#818cf8', cursor: 'pointer' }}
                />
                <label htmlFor="sendAdminInvite" style={{ fontSize: '12.5px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  Send account setup/invitation email to new admin
                </label>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setIsChangeAdminModalOpen(false)}
                  disabled={isUpdatingAdmin}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingAdmin}
                  className="btn btn-primary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  {isUpdatingAdmin ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />}
                  <span>{isUpdatingAdmin ? 'Updating...' : 'Save & Update Admin'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mobile Slide-Over Control Panel Drawer */}
      {isMobileDrawerOpen && (
        <div className={styles.mobileDrawerOverlay} onClick={() => setIsMobileDrawerOpen(false)}>
          <div className={styles.mobileControlDrawer} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldCheck size={22} color="#818cf8" />
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                  Control Panel
                </h3>
              </div>
              <button
                onClick={() => setIsMobileDrawerOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Authenticated Account Info Card */}
            <div
              style={{
                padding: '14px',
                borderRadius: '12px',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                marginBottom: '20px',
              }}
            >
              <div style={{ fontSize: '11px', color: '#818cf8', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>
                Authenticated Account
              </div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', wordBreak: 'break-all' }}>
                {adminEmail}
              </div>
              <span className="badge badge-info" style={{ marginTop: '8px', fontSize: '10px' }}>
                Platform Super Admin
              </span>
            </div>

            {/* Navigation & Control Action Items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
              <button
                onClick={() => {
                  toast.info('Global system configuration & feature flags are active.');
                  setIsMobileDrawerOpen(false);
                }}
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start', padding: '12px 16px', width: '100%' }}
              >
                <Settings size={18} color="#38bdf8" />
                <span>Global Settings</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('history');
                  setIsMobileDrawerOpen(false);
                }}
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start', padding: '12px 16px', width: '100%' }}
              >
                <History size={18} color="#c084fc" />
                <span>Audit Logs ({auditLogs.length})</span>
              </button>

              <button
                onClick={() => {
                  toast.success('All core services, database, & authentication services are operational.');
                  setIsMobileDrawerOpen(false);
                }}
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start', padding: '12px 16px', width: '100%' }}
              >
                <Activity size={18} color="#34d399" />
                <span>System Health</span>
              </button>
            </div>

            {/* Drawer Footer: Logout */}
            <div style={{ paddingTop: '16px', borderTop: '1px solid var(--border-subtle)', marginTop: 'auto' }}>
              <button
                onClick={async () => {
                  try {
                    await fetch('/api/auth/logout', { method: 'POST' });
                  } catch (e) {
                    // Ignore
                  }
                  router.push('/super-admin/login');
                }}
                className="btn btn-danger"
                style={{ width: '100%', justifyContent: 'center', gap: '8px' }}
              >
                <LogOut size={16} />
                <span>Sign Out / Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

