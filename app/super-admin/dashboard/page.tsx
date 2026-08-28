'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SuperAdminSidebar } from '@/components/layout/super-admin-sidebar';
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
  ChevronRight,
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

  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected' | 'history'>('pending');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [adminEmail, setAdminEmail] = useState('Super Admin');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Action State
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [reviewAction, setReviewAction] = useState<'VIEW' | 'APPROVE' | 'REJECT' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

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
        setCounts(data.counts || { pending: 0, approved: 0, rejected: 0 });
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
        body: JSON.stringify({ rejectionReason: rejectionReason.trim() }),
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

  const closeModal = () => {
    setSelectedOrg(null);
    setReviewAction(null);
    setRejectionReason('');
    setIsProcessing(false);
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
        {/* Top Header */}
        <header className={styles.headerBar}>
          <div>
            <h1 className={styles.headerTitle}>Platform Overview</h1>
            <p className={styles.headerSubtitle}>
              Monitor organization registrations, approvals, and platform activity from one place.
            </p>
          </div>

          <div className={styles.headerControls}>
            {/* Search Input */}
            <div className={styles.searchInputWrapper}>
              <Search size={15} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search organizations..."
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
              <span>Refresh</span>
            </button>
          </div>
        </header>

        {/* Dashboard Body */}
        <main style={{ padding: '28px', flex: 1 }}>
          {/* Interactive Metric Cards */}
          <div className={styles.metricsGrid}>
            <div
              className={`${styles.metricCard} ${activeTab === 'pending' ? styles.metricCardActive : ''}`}
              onClick={() => setActiveTab('pending')}
            >
              <div className={styles.metricCardHeader}>
                <span className={styles.metricTitle}>Pending Approvals</span>
                <div
                  className={styles.metricIconBox}
                  style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}
                >
                  <Clock size={20} />
                </div>
              </div>
              <div className={styles.metricValue}>{counts.pending}</div>
              <div className={styles.metricDescription}>Awaiting platform review</div>
            </div>

            <div
              className={`${styles.metricCard} ${activeTab === 'approved' ? styles.metricCardActive : ''}`}
              onClick={() => setActiveTab('approved')}
            >
              <div className={styles.metricCardHeader}>
                <span className={styles.metricTitle}>Active Organizations</span>
                <div
                  className={styles.metricIconBox}
                  style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}
                >
                  <CheckCircle2 size={20} />
                </div>
              </div>
              <div className={styles.metricValue}>{counts.approved}</div>
              <div className={styles.metricDescription}>Active tenant workspaces</div>
            </div>

            <div
              className={`${styles.metricCard} ${activeTab === 'rejected' ? styles.metricCardActive : ''}`}
              onClick={() => setActiveTab('rejected')}
            >
              <div className={styles.metricCardHeader}>
                <span className={styles.metricTitle}>Rejected Applications</span>
                <div
                  className={styles.metricIconBox}
                  style={{ backgroundColor: 'rgba(244, 63, 94, 0.15)', color: '#fb7185' }}
                >
                  <XCircle size={20} />
                </div>
              </div>
              <div className={styles.metricValue}>{counts.rejected}</div>
              <div className={styles.metricDescription}>Declined registration applications</div>
            </div>

            <div
              className={`${styles.metricCard} ${activeTab === 'history' ? styles.metricCardActive : ''}`}
              onClick={() => setActiveTab('history')}
            >
              <div className={styles.metricCardHeader}>
                <span className={styles.metricTitle}>Audit Log Entries</span>
                <div
                  className={styles.metricIconBox}
                  style={{ backgroundColor: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}
                >
                  <History size={20} />
                </div>
              </div>
              <div className={styles.metricValue}>{auditLogs.length}</div>
              <div className={styles.metricDescription}>Governance event history</div>
            </div>
          </div>

          {/* ERROR STATE */}
          {hasError && !isLoading && (
            <div className="glass-card" style={{ padding: '40px', textAlign: 'center', margin: '20px 0' }}>
              <AlertCircle size={36} color="var(--danger-text)" style={{ margin: '0 auto 12px auto' }} />
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff' }}>
                Unable to load organization requests
              </h3>
              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginTop: '4px', marginBottom: '20px' }}>
                Something went wrong while retrieving the latest requests from the platform server.
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
                Loading platform applications...
              </div>
            </div>
          )}

          {!isLoading && !hasError && (
            <>
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
                        All Caught Up!
                      </h3>
                      <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}>
                        All organization registration requests have been reviewed.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Desktop Table View */}
                      <div className={`table-container glass-card ${styles.tableContainerDesktop}`}>
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Organization</th>
                              <th>Contact Person</th>
                              <th>Contact Email</th>
                              <th>Phone</th>
                              <th>Submitted</th>
                              <th>Status</th>
                              <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pendingOrgs.map((org) => (
                              <tr key={org.id}>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div
                                      style={{
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '8px',
                                        backgroundColor: 'rgba(255,255,255,0.05)',
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
                                    <span style={{ fontWeight: 700, color: '#ffffff' }}>{org.name}</span>
                                  </div>
                                </td>
                                <td style={{ color: 'var(--text-primary)' }}>{org.contactPersonName}</td>
                                <td style={{ color: 'var(--text-secondary)' }}>{org.contactEmail}</td>
                                <td style={{ color: 'var(--text-secondary)' }}>{org.phone}</td>
                                <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                                  {new Date(org.createdAt).toLocaleDateString()}
                                </td>
                                <td>
                                  <span className="badge badge-pending">PENDING</span>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <div style={{ display: 'inline-flex', gap: '8px' }}>
                                    <button
                                      onClick={() => {
                                        setSelectedOrg(org);
                                        setReviewAction('VIEW');
                                      }}
                                      className="btn btn-secondary btn-sm"
                                    >
                                      <Eye size={14} />
                                      <span>Review</span>
                                    </button>
                                    <button
                                      onClick={() => {
                                        setSelectedOrg(org);
                                        setReviewAction('APPROVE');
                                      }}
                                      className="btn btn-success btn-sm"
                                    >
                                      <Check size={14} />
                                      <span>Approve</span>
                                    </button>
                                    <button
                                      onClick={() => {
                                        setSelectedOrg(org);
                                        setReviewAction('REJECT');
                                      }}
                                      className="btn btn-danger btn-sm"
                                    >
                                      <X size={14} />
                                      <span>Reject</span>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile Card View (< 768px) */}
                      <div className={styles.mobileCardList}>
                        {pendingOrgs.map((org) => (
                          <div key={org.id} className={styles.mobileOrgCard}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Building2 size={20} color="#818cf8" />
                                <span style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>{org.name}</span>
                              </div>
                              <span className="badge badge-pending">PENDING</span>
                            </div>
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                              <strong>Contact:</strong> {org.contactPersonName} &bull; {org.contactEmail}
                            </div>
                            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '14px' }}>
                              <strong>Submitted:</strong> {new Date(org.createdAt).toLocaleDateString()}
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                onClick={() => {
                                  setSelectedOrg(org);
                                  setReviewAction('APPROVE');
                                }}
                                className="btn btn-success btn-sm"
                                style={{ flex: 1 }}
                              >
                                <Check size={14} />
                                <span>Approve</span>
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedOrg(org);
                                  setReviewAction('REJECT');
                                }}
                                className="btn btn-danger btn-sm"
                                style={{ flex: 1 }}
                              >
                                <X size={14} />
                                <span>Reject</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* TAB 2: APPROVED ORGANIZATIONS */}
              {activeTab === 'approved' && (
                <div>
                  {approvedOrgs.length === 0 ? (
                    <div className="glass-card" style={{ padding: '60px 24px', textAlign: 'center' }}>
                      <p style={{ color: 'var(--text-secondary)' }}>No approved organizations yet.</p>
                    </div>
                  ) : (
                    <div className="table-container glass-card">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Organization Code</th>
                            <th>Organization Name</th>
                            <th>Contact Person</th>
                            <th>Contact Email</th>
                            <th>Approved Date</th>
                            <th>Reviewed By</th>
                            <th style={{ textAlign: 'right' }}>Login Destination</th>
                          </tr>
                        </thead>
                        <tbody>
                          {approvedOrgs.map((org) => (
                            <tr key={org.id}>
                              <td>
                                <span
                                  style={{
                                    fontFamily: 'var(--font-mono)',
                                    fontWeight: 700,
                                    color: '#38bdf8',
                                    backgroundColor: 'rgba(6, 182, 212, 0.1)',
                                    border: '1px solid rgba(6, 182, 212, 0.3)',
                                    padding: '3px 8px',
                                    borderRadius: '4px',
                                  }}
                                >
                                  {org.organizationCode}
                                </span>
                              </td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <div
                                    style={{
                                      width: '32px',
                                      height: '32px',
                                      borderRadius: '6px',
                                      backgroundColor: 'rgba(255,255,255,0.05)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      overflow: 'hidden',
                                    }}
                                  >
                                    <OrgLogo logoUrl={org.logoUrl} name={org.name} size={16} />
                                  </div>
                                  <span style={{ fontWeight: 700, color: '#ffffff' }}>{org.name}</span>
                                </div>
                              </td>
                              <td>{org.contactPersonName}</td>
                              <td style={{ color: 'var(--text-secondary)' }}>{org.contactEmail}</td>
                              <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                                {org.approvedAt ? new Date(org.approvedAt).toLocaleDateString() : 'N/A'}
                              </td>
                              <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                                {org.reviewedBy || 'Super Admin'}
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <Link
                                  href={`/${org.organizationCode}/login`}
                                  target="_blank"
                                  className="btn btn-ghost btn-sm"
                                  style={{ color: '#818cf8', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                >
                                  <span>Portal</span>
                                  <ExternalLink size={13} />
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: REJECTED APPLICATIONS */}
              {activeTab === 'rejected' && (
                <div>
                  {rejectedOrgs.length === 0 ? (
                    <div className="glass-card" style={{ padding: '60px 24px', textAlign: 'center' }}>
                      <p style={{ color: 'var(--text-secondary)' }}>No rejected applications.</p>
                    </div>
                  ) : (
                    <div className="table-container glass-card">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Organization</th>
                            <th>Contact Person</th>
                            <th>Contact Email</th>
                            <th>Rejected Date</th>
                            <th>Reviewed By</th>
                            <th>Rejection Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rejectedOrgs.map((org) => (
                            <tr key={org.id}>
                              <td style={{ fontWeight: 700, color: '#ffffff' }}>{org.name}</td>
                              <td>{org.contactPersonName}</td>
                              <td style={{ color: 'var(--text-secondary)' }}>{org.contactEmail}</td>
                              <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                                {org.rejectedAt ? new Date(org.rejectedAt).toLocaleDateString() : 'N/A'}
                              </td>
                              <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                                {org.reviewedBy || 'Super Admin'}
                              </td>
                              <td style={{ color: 'var(--danger-text)', fontSize: '13px' }}>
                                {org.rejectionReason || 'No reason specified'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: AUDIT HISTORY */}
              {activeTab === 'history' && (
                <div>
                  <div className="table-container glass-card">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Timestamp</th>
                          <th>Action</th>
                          <th>Entity</th>
                          <th>Target / Organization</th>
                          <th>Actor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLogs.map((log) => (
                          <tr key={log.id}>
                            <td style={{ color: 'var(--text-muted)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                              {new Date(log.createdAt).toLocaleString()}
                            </td>
                            <td>
                              <span
                                className={`badge ${
                                  log.action.includes('APPROVED')
                                    ? 'badge-active'
                                    : log.action.includes('REJECTED')
                                    ? 'badge-rejected'
                                    : 'badge-info'
                                }`}
                              >
                                {log.action}
                              </span>
                            </td>
                            <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{log.entityType}</td>
                            <td style={{ color: '#ffffff', fontWeight: 600 }}>
                              {log.organization?.name || log.metadata?.name || log.entityId || 'N/A'}
                            </td>
                            <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                              {log.actorUser?.email || 'System'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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

      {/* CONFIRMATION & REVIEW MODAL SYSTEM */}
      {selectedOrg && reviewAction === 'APPROVE' && (
        <ConfirmationModal
          isOpen={Boolean(selectedOrg && reviewAction === 'APPROVE')}
          onClose={closeModal}
          onConfirm={handleApprove}
          title={`Approve ${selectedOrg.name}?`}
          message="Approving this request will activate the organization, assign a unique Organization Code, create the primary Organization Admin account, and dispatch initial login credentials."
          confirmText={isProcessing ? 'Approving...' : 'Approve Organization'}
          variant="primary"
        />
      )}

      {/* REJECTION REASON MODAL */}
      {selectedOrg && (reviewAction === 'REJECT' || reviewAction === 'VIEW') && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border-medium)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  <OrgLogo logoUrl={selectedOrg.logoUrl} name={selectedOrg.name} size={24} />
                </div>
                <div>
                  <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff' }}>
                    {selectedOrg.name}
                  </h3>
                  <span className="badge badge-pending" style={{ marginTop: '4px' }}>
                    Application Pending
                  </span>
                </div>
              </div>
              <button onClick={closeModal} className="btn btn-ghost btn-sm" style={{ padding: '4px' }}>
                <X size={18} />
              </button>
            </div>

            <div
              style={{
                backgroundColor: 'rgba(13, 18, 31, 0.8)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '20px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px',
                marginBottom: '24px',
                fontSize: '13.5px',
              }}
            >
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>
                  Contact Person
                </div>
                <div style={{ color: '#f8fafc', fontWeight: 600 }}>{selectedOrg.contactPersonName}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>
                  Phone
                </div>
                <div style={{ color: '#f8fafc', fontWeight: 600 }}>{selectedOrg.phone}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>
                  Contact Email
                </div>
                <div style={{ color: '#38bdf8', fontWeight: 600 }}>{selectedOrg.contactEmail}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>
                  Submitted Date
                </div>
                <div style={{ color: '#94a3b8' }}>{new Date(selectedOrg.createdAt).toLocaleString()}</div>
              </div>
            </div>

            {reviewAction === 'REJECT' && (
              <div style={{ marginBottom: '24px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="rejectionReason">
                    Rejection Reason Guidance
                  </label>
                  <textarea
                    id="rejectionReason"
                    rows={3}
                    placeholder="Provide guidance or reason for rejecting this application..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    disabled={isProcessing}
                    className="form-input"
                    style={{ resize: 'vertical' }}
                  />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
              <button type="button" onClick={closeModal} disabled={isProcessing} className="btn btn-secondary">
                Cancel
              </button>

              {reviewAction === 'VIEW' && (
                <>
                  <button
                    type="button"
                    onClick={() => setReviewAction('REJECT')}
                    className="btn btn-danger"
                  >
                    Reject Application
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewAction('APPROVE')}
                    className="btn btn-success"
                  >
                    Approve Application
                  </button>
                </>
              )}

              {reviewAction === 'REJECT' && (
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={isProcessing}
                  className="btn btn-danger"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
                  <span>{isProcessing ? 'Rejecting...' : 'Reject Organization'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
