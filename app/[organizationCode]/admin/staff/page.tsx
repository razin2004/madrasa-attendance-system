'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Users,
  Plus,
  Search,
  MapPin,
  Smartphone,
  ShieldAlert,
  ShieldCheck,
  Power,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Building,
  Phone,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Mail,
  X,
  Loader2,
} from 'lucide-react';
import { OrgAdminSidebar } from '@/components/layout/org-admin-sidebar';
import { OrgAdminMobileNav } from '@/components/layout/org-admin-mobile-nav';
import { useToast } from '@/components/feedback/toast-provider';
import { ConfirmationModal } from '@/components/feedback/confirmation-modal';
import styles from './StaffDirectory.module.css';

interface BranchAssignment {
  branch: {
    id: string;
    name: string;
    status: string;
  };
}

interface StaffItem {
  id: string;
  staffId: string;
  name: string;
  phone: string;
  address: string;
  idDocType: string;
  idDocLast4: string | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
    status: 'ACTIVE' | 'INACTIVE';
    role: string;
    lastLoginAt: string | null;
  };
  branchAssignments: BranchAssignment[];
  devices: any[];
}

interface OrgBranding {
  id: string;
  name: string;
  logoUrl: string | null;
  organizationCode: string;
}

export default function StaffDirectoryPage() {
  const params = useParams();
  const organizationCode = (params.organizationCode as string)?.toUpperCase() || '';
  const router = useRouter();
  const toast = useToast();

  const [branding, setBranding] = useState<OrgBranding | null>(null);
  const [staffList, setStaffList] = useState<StaffItem[]>([]);
  const [counts, setCounts] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    deviceRegistered: 0,
    deviceResetRequired: 0,
  });
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE' | 'DEVICE_REGISTERED' | 'RESET_REQUIRED'>('ALL');
  const [search, setSearch] = useState('');
  const [toggleStaff, setToggleStaff] = useState<StaffItem | null>(null);
  const [toggleLoading, setToggleLoading] = useState(false);

  useEffect(() => {
    if (organizationCode) {
      fetchInitialData();
    }
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

      const staffRes = await fetch(`/api/org/${organizationCode}/staff`);
      const staffData = await staffRes.json();
      if (staffData.success) {
        setStaffList(staffData.staff);
        setCounts(staffData.counts);
      } else {
        setHasError(true);
        toast.error(staffData.error || 'Failed to load staff list.');
      }
    } catch {
      setHasError(true);
      toast.error('Network error loading staff directory.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!toggleStaff) return;
    try {
      setToggleLoading(true);
      const res = await fetch(
        `/api/org/${organizationCode}/staff/${toggleStaff.id}/toggle-status`,
        { method: 'POST' }
      );
      const data = await res.json();
      if (data.success) {
        toast.success(
          toggleStaff.user.status === 'ACTIVE'
            ? 'Staff account deactivated.'
            : 'Staff account activated.'
        );
        setToggleStaff(null);
        fetchInitialData();
      } else {
        toast.error(data.error || 'Failed to update status.');
      }
    } catch {
      toast.error('Network error updating status.');
    } finally {
      setToggleLoading(false);
    }
  };

  const filteredStaff = staffList.filter((s) => {
    if (filter === 'ACTIVE' && s.user.status !== 'ACTIVE') return false;
    if (filter === 'INACTIVE' && s.user.status !== 'INACTIVE') return false;
    if (filter === 'DEVICE_REGISTERED' && !s.devices?.some((d: any) => d.status === 'REGISTERED')) return false;
    if (filter === 'RESET_REQUIRED' && !s.devices?.some((d: any) => d.status === 'RESET_REQUIRED')) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchBranch = s.branchAssignments.some((b) => b.branch.name.toLowerCase().includes(q));
      return (
        s.staffId.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.user.email.toLowerCase().includes(q) ||
        s.phone.toLowerCase().includes(q) ||
        matchBranch
      );
    }
    return true;
  });

  const getInitials = (nameStr: string) => {
    const parts = nameStr.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return nameStr.slice(0, 2).toUpperCase();
  };

  return (
    <div className={styles.container}>
      {/* Desktop Sidebar */}
      <OrgAdminSidebar
        organizationCode={organizationCode}
        organizationName={branding?.name || 'Organization'}
        logoUrl={branding?.logoUrl}
        staffCount={counts.total}
      />

      {/* Main Content Area */}
      <div className={styles.mainContent}>
        {/* Top Header */}
        <header className={styles.headerBar}>
          <div>
            <h1 className={styles.title}>Staff</h1>
            <p className={styles.subtitle}>
              Manage staff accounts, branch assignments, schedules, and registered devices.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={fetchInitialData}
              disabled={loading}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>

            <Link
              href={`/${organizationCode}/admin/staff/new`}
              className="btn btn-primary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={16} />
              <span>Add Staff Member</span>
            </Link>
          </div>
        </header>

        {/* Content Body */}
        <main style={{ padding: '32px', maxWidth: '1280px', width: '100%', margin: '0 auto' }}>
          {/* Filters & Search */}
          <div className={styles.filterSearchRow}>
            {/* Filter Tabs */}
            <div className={styles.tabsGroup}>
              {[
                { id: 'ALL', label: `All Staff (${counts.total})` },
                { id: 'ACTIVE', label: `Active (${counts.active})` },
                { id: 'DEVICE_REGISTERED', label: `Device Bound (${counts.deviceRegistered})` },
                { id: 'RESET_REQUIRED', label: `Reset Req (${counts.deviceResetRequired})` },
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
            <div className={styles.searchInputWrapper}>
              <Search size={15} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search staff by name, ID, or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={styles.searchInput}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '9px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
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
              <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#ffffff' }}>
                Unable to load staff members
              </h3>
              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginTop: '4px', marginBottom: '20px' }}>
                There was an error communicating with the staff management server.
              </p>
              <button onClick={fetchInitialData} className="btn btn-primary btn-sm">
                Try Again
              </button>
            </div>
          )}

          {/* LOADING STATE SKELETON */}
          {loading && (
            <div className="glass-card" style={{ padding: '48px 24px', textAlign: 'center' }}>
              <Loader2 size={32} className="animate-spin" style={{ color: '#818cf8', margin: '0 auto 12px auto' }} />
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                Loading workforce directory...
              </div>
            </div>
          )}

          {/* EMPTY STATE - NO STAFF MEMBER */}
          {!loading && !hasError && staffList.length === 0 && (
            <div className="glass-card" style={{ padding: '48px 24px', textAlign: 'center' }}>
              <Users size={40} color="#818cf8" style={{ margin: '0 auto 16px auto', opacity: 0.8 }} />
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff' }}>
                No staff members yet
              </h3>
              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', maxWidth: '440px', margin: '8px auto 24px auto', lineHeight: '1.5' }}>
                Add your first staff member to begin assigning workplace branches, shift schedules, and verifying attendance.
              </p>
              <Link href={`/${organizationCode}/admin/staff/new`} className="btn btn-primary">
                Add Staff Member
              </Link>
            </div>
          )}

          {/* EMPTY STATE - NO SEARCH MATCHES */}
          {!loading && !hasError && staffList.length > 0 && filteredStaff.length === 0 && (
            <div className="glass-card" style={{ padding: '40px 24px', textAlign: 'center' }}>
              <Search size={32} color="var(--text-muted)" style={{ margin: '0 auto 12px auto' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>
                No staff members match your search
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', marginBottom: '16px' }}>
                Try searching for a different staff member name, ID, or email address.
              </p>
              <button onClick={() => { setSearch(''); setFilter('ALL'); }} className="btn btn-secondary btn-sm">
                Clear Filters
              </button>
            </div>
          )}

          {/* DESKTOP DATA TABLE */}
          {!loading && !hasError && filteredStaff.length > 0 && (
            <>
              <div className={`${styles.tableDesktop} glass-card`} style={{ overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                      <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '11.5px', textTransform: 'uppercase' }}>
                        Staff Member
                      </th>
                      <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '11.5px', textTransform: 'uppercase' }}>
                        Account Email
                      </th>
                      <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '11.5px', textTransform: 'uppercase' }}>
                        Assigned Branches
                      </th>
                      <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '11.5px', textTransform: 'uppercase' }}>
                        Status
                      </th>
                      <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '11.5px', textTransform: 'uppercase' }}>
                        Layer 3 Device
                      </th>
                      <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '11.5px', textTransform: 'uppercase', textAlign: 'right' }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStaff.map((staff) => {
                      const isActive = staff.user.status === 'ACTIVE';

                      return (
                        <tr
                          key={staff.id}
                          style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.15s ease' }}
                        >
                          {/* Staff Name & ID */}
                          <td style={{ padding: '16px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div className={styles.avatarBadge}>
                                {getInitials(staff.name)}
                              </div>
                              <div>
                                <div style={{ fontWeight: 700, color: '#ffffff' }}>{staff.name}</div>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#818cf8', marginTop: '1px' }}>
                                  ID: {staff.staffId}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Email */}
                          <td style={{ padding: '16px 20px', color: 'var(--text-secondary)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px' }}>
                              <Mail size={13} color="var(--text-muted)" />
                              <span>{staff.user.email}</span>
                            </div>
                            {staff.phone && (
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                Phone: {staff.phone}
                              </div>
                            )}
                          </td>

                          {/* Assigned Branches */}
                          <td style={{ padding: '16px 20px' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {staff.branchAssignments.length > 0 ? (
                                staff.branchAssignments.map((b) => (
                                  <span
                                    key={b.branch.id}
                                    style={{
                                      fontSize: '11px',
                                      padding: '2px 8px',
                                      borderRadius: '4px',
                                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                      border: '1px solid var(--border-subtle)',
                                      color: '#f8fafc',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                    }}
                                  >
                                    <MapPin size={10} color="#818cf8" />
                                    <span>{b.branch.name}</span>
                                  </span>
                                ))
                              ) : (
                                <span style={{ fontSize: '11.5px', color: 'var(--warning-text)' }}>
                                  No branch assigned
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Status */}
                          <td style={{ padding: '16px 20px' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '3px 10px',
                                borderRadius: '9999px',
                                fontSize: '11.5px',
                                fontWeight: 700,
                                backgroundColor: isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                color: isActive ? '#34d399' : '#f87171',
                                border: `1px solid ${isActive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                              }}
                            >
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isActive ? '#34d399' : '#f87171' }} />
                              {isActive ? 'ACTIVE' : 'INACTIVE'}
                            </span>
                          </td>

                          {/* Device Status */}
                          <td style={{ padding: '16px 20px' }}>
                            {staff.devices?.some((d: any) => d.status === 'REGISTERED') ? (
                              <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#34d399', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <CheckCircle2 size={13} />
                                <span>{staff.devices.filter((d: any) => d.status === 'REGISTERED').length} Device(s) Bound</span>
                              </span>
                            ) : staff.devices?.some((d: any) => d.status === 'RESET_REQUIRED') ? (
                              <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#fbbf24', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <AlertTriangle size={13} />
                                <span>Reset Required</span>
                              </span>
                            ) : (
                              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                — Not Registered
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                              <Link
                                href={`/${organizationCode}/admin/staff/${staff.id}`}
                                className="btn btn-secondary btn-sm"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              >
                                <span>Profile</span>
                                <ChevronRight size={14} />
                              </Link>
                              <button
                                onClick={() => setToggleStaff(staff)}
                                className={`btn btn-sm ${isActive ? 'btn-danger-subtle' : 'btn-success-subtle'}`}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              >
                                <Power size={13} />
                                <span>{isActive ? 'Deactivate' : 'Activate'}</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* MOBILE RESPONSIVE CARDS */}
              <div className={styles.cardsMobile}>
                {filteredStaff.map((staff) => {
                  const isActive = staff.user.status === 'ACTIVE';

                  return (
                    <div key={staff.id} className={styles.mobileCard}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div className={styles.avatarBadge}>{getInitials(staff.name)}</div>
                          <div>
                            <div style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff' }}>{staff.name}</div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#818cf8' }}>ID: {staff.staffId}</div>
                          </div>
                        </div>

                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: isActive ? '#34d399' : '#f87171',
                          }}
                        >
                          {isActive ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </div>

                      <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                        Email: {staff.user.email}
                      </div>

                      <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
                        <Link
                          href={`/${organizationCode}/admin/staff/${staff.id}`}
                          className="btn btn-secondary btn-sm"
                          style={{ flex: 1, textAlign: 'center' }}
                        >
                          Profile
                        </Link>
                        <button
                          onClick={() => setToggleStaff(staff)}
                          className={`btn btn-sm ${isActive ? 'btn-danger-subtle' : 'btn-success-subtle'}`}
                          style={{ flex: 1 }}
                        >
                          {isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </main>
      </div>

      {/* Status Confirmation Modal */}
      <ConfirmationModal
        isOpen={Boolean(toggleStaff)}
        onClose={() => setToggleStaff(null)}
        onConfirm={handleToggleStatus}
        title={toggleStaff?.user.status === 'ACTIVE' ? 'Deactivate staff account?' : 'Activate staff account?'}
        message={
          toggleStaff?.user.status === 'ACTIVE'
            ? `Deactivating ${toggleStaff?.name} (${toggleStaff?.staffId}) will prevent login and attendance recording. Historical records remain preserved.`
            : `Re-activate ${toggleStaff?.name} (${toggleStaff?.staffId}) to restore login and attendance eligibility.`
        }
        confirmText={toggleStaff?.user.status === 'ACTIVE' ? 'Deactivate Account' : 'Activate Account'}
        variant={toggleStaff?.user.status === 'ACTIVE' ? 'danger' : 'primary'}
      />

      {/* Mobile Navigation */}
      <OrgAdminMobileNav organizationCode={organizationCode} />
    </div>
  );
}
