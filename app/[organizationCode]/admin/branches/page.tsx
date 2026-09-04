'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  MapPin,
  Plus,
  Network,
  Navigation,
  ShieldCheck,
  ShieldAlert,
  Edit2,
  Power,
  ChevronRight,
  Search,
  Filter,
  ArrowUpRight,
  AlertCircle,
  Building,
  RefreshCw,
  X,
  CheckCircle2,
  Loader2,
  Menu,
} from 'lucide-react';
import { OrgAdminSidebar } from '../../../../components/layout/org-admin-sidebar';
import { OrgAdminMobileNav } from '../../../../components/layout/org-admin-mobile-nav';
import { useToast } from '../../../../components/feedback/toast-provider';
import { ConfirmationModal } from '../../../../components/feedback/confirmation-modal';
import styles from './BranchDirectory.module.css';

interface BranchItem {
  id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  locationAccuracyMeters: number | null;
  geofenceRadiusMeters: number;
  publicIp: string | null;
  ipSource: string;
  ipCapturedAt: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

interface OrgBranding {
  id: string;
  name: string;
  logoUrl: string | null;
  organizationCode: string;
  status: string;
}

export default function BranchesListPage() {
  const params = useParams();
  const organizationCode = (params.organizationCode as string)?.toUpperCase() || '';
  const router = useRouter();
  const toast = useToast();

  const [branding, setBranding] = useState<OrgBranding | null>(null);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [counts, setCounts] = useState({ total: 0, active: 0, inactive: 0 });
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [search, setSearch] = useState('');
  const [toggleModalBranch, setToggleModalBranch] = useState<BranchItem | null>(null);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);

  useEffect(() => {
    if (organizationCode) {
      fetchInitialData();
    }
  }, [organizationCode]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      setHasError(false);

      // Fetch Branding
      const brandRes = await fetch(`/api/org/${organizationCode}/branding`);
      const brandData = await brandRes.json();
      if (brandData.success) {
        setBranding(brandData.organization);
      }

      // Fetch Branches
      const branchRes = await fetch(`/api/org/${organizationCode}/branches`);
      const branchData = await branchRes.json();
      if (branchData.success) {
        setBranches(branchData.branches);
        setCounts(branchData.counts);
      } else {
        setHasError(true);
        toast.error(branchData.error || 'Failed to load branches.');
      }
    } catch (err) {
      setHasError(true);
      toast.error('Network error loading branch data.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!toggleModalBranch) return;
    try {
      setToggleLoading(true);
      const res = await fetch(
        `/api/org/${organizationCode}/branches/${toggleModalBranch.id}/toggle-status`,
        { method: 'POST' }
      );
      const data = await res.json();
      if (data.success) {
        toast.success(
          toggleModalBranch.status === 'ACTIVE'
            ? 'Branch deactivated successfully.'
            : 'Branch activated successfully.'
        );
        setToggleModalBranch(null);
        fetchInitialData();
      } else {
        toast.error(data.error || 'Failed to update branch status.');
      }
    } catch (err) {
      toast.error('Network error while toggling branch status.');
    } finally {
      setToggleLoading(false);
    }
  };

  const filteredBranches = branches.filter((b) => {
    if (filter === 'ACTIVE' && b.status !== 'ACTIVE') return false;
    if (filter === 'INACTIVE' && b.status !== 'INACTIVE') return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        b.name.toLowerCase().includes(q) ||
        b.address.toLowerCase().includes(q) ||
        (b.publicIp && b.publicIp.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className={styles.container}>
      {/* Desktop Sidebar */}
      <OrgAdminSidebar
        organizationCode={organizationCode}
        organizationName={branding?.name || 'Organization'}
        logoUrl={branding?.logoUrl}
        branchCount={counts.total}
      />

      {/* Main Content Area */}
      <div className={styles.mainContent}>
        {/* Top Header */}
        <header className={styles.headerBar}>
          <div>
            <h1 className={styles.title}>Branches</h1>
            <p className={styles.subtitle}>
              Manage your organization&apos;s branch locations, network configuration, and attendance verification settings.
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
              title="Branch Directory Actions Menu"
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
                    href={`/${organizationCode}/admin/branches/new`}
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
                    <span>Register Branch</span>
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
                    <span>Refresh Branches</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Content Body */}
        <main className="pageMainContent" style={{ maxWidth: '1280px' }}>
          {/* Filter & Search Bar */}
          <div className={styles.filterSearchRow}>
            {/* Filter Tabs */}
            <div className={styles.tabsGroup}>
              {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFilter(tab)}
                  className={`${styles.tabButton} ${filter === tab ? styles.tabButtonActive : ''}`}
                >
                  {tab === 'ALL' ? `All Branches (${counts.total})` : tab === 'ACTIVE' ? `Active (${counts.active})` : `Inactive (${counts.inactive})`}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className={styles.searchInputWrapper}>
              <Search size={15} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search branches..."
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
                Unable to load branch information
              </h3>
              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginTop: '4px', marginBottom: '20px' }}>
                There was an error communicating with the branch management server.
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
                Loading registered workplace branches...
              </div>
            </div>
          )}

          {/* EMPTY STATE - NO BRANCHES REGISTERED */}
          {!loading && !hasError && branches.length === 0 && (
            <div className="glass-card" style={{ padding: '48px 24px', textAlign: 'center' }}>
              <MapPin size={40} color="#818cf8" style={{ margin: '0 auto 16px auto', opacity: 0.8 }} />
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff' }}>
                No branches registered
              </h3>
              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', maxWidth: '420px', margin: '8px auto 24px auto', lineHeight: '1.5' }}>
                Register your first branch to configure network IP and GPS geofence location parameters for attendance verification.
              </p>
              <Link href={`/${organizationCode}/admin/branches/new`} className="btn btn-primary">
                Register First Branch
              </Link>
            </div>
          )}

          {/* EMPTY STATE - NO SEARCH MATCHES */}
          {!loading && !hasError && branches.length > 0 && filteredBranches.length === 0 && (
            <div className="glass-card" style={{ padding: '40px 24px', textAlign: 'center' }}>
              <Search size={32} color="var(--text-muted)" style={{ margin: '0 auto 12px auto' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>
                No branches match your search
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', marginBottom: '16px' }}>
                Try searching for a different branch name, address, or IP address.
              </p>
              <button onClick={() => setSearch('')} className="btn btn-secondary btn-sm">
                Clear Search
              </button>
            </div>
          )}

          {/* DESKTOP DATA TABLE */}
          {!loading && !hasError && filteredBranches.length > 0 && (
            <>
              <div className={`${styles.tableDesktop} glass-card`} style={{ overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                      <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '11.5px', textTransform: 'uppercase' }}>
                        Branch Name
                      </th>
                      <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '11.5px', textTransform: 'uppercase' }}>
                        Address
                      </th>
                      <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '11.5px', textTransform: 'uppercase' }}>
                        Status
                      </th>
                      <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '11.5px', textTransform: 'uppercase' }}>
                        Registered Network
                      </th>
                      <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '11.5px', textTransform: 'uppercase' }}>
                        Geofence Boundary
                      </th>
                      <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '11.5px', textTransform: 'uppercase', textAlign: 'right' }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBranches.map((branch) => {
                      const isActive = branch.status === 'ACTIVE';
                      const hasIp = Boolean(branch.publicIp);
                      const hasGps = Boolean(branch.latitude && branch.longitude);

                      return (
                        <tr
                          key={branch.id}
                          style={{
                            borderBottom: '1px solid var(--border-subtle)',
                            transition: 'background 0.15s ease',
                          }}
                        >
                          <td style={{ padding: '16px 20px', fontWeight: 700, color: '#ffffff' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <MapPin size={18} color={isActive ? '#38bdf8' : 'var(--text-muted)'} />
                              <div>
                                <div>{branch.name}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '16px 20px', color: 'var(--text-secondary)', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {branch.address}
                          </td>
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
                          <td style={{ padding: '16px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: hasIp ? '#38bdf8' : 'var(--text-muted)' }}>
                              <Network size={14} color={hasIp ? '#38bdf8' : 'var(--text-muted)'} />
                              <span>{hasIp ? branch.publicIp : '✗ Not Configured'}</span>
                            </div>
                          </td>
                          <td style={{ padding: '16px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: hasGps ? '#34d399' : 'var(--text-muted)' }}>
                              <Navigation size={14} color={hasGps ? '#34d399' : 'var(--text-muted)'} />
                              <span>{hasGps ? `✓ ${branch.geofenceRadiusMeters} m` : '✗ Not Configured'}</span>
                            </div>
                          </td>
                          <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                              <Link
                                href={`/${organizationCode}/admin/branches/${branch.id}`}
                                className="btn btn-secondary btn-sm"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              >
                                <span>Details</span>
                                <ChevronRight size={14} />
                              </Link>
                              <button
                                onClick={() => setToggleModalBranch(branch)}
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
                {filteredBranches.map((branch) => {
                  const isActive = branch.status === 'ACTIVE';
                  const hasIp = Boolean(branch.publicIp);

                  return (
                    <div key={branch.id} className={styles.mobileCard}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <div style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff' }}>
                          {branch.name}
                        </div>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
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

                      <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                        {branch.address}
                      </div>

                      <div style={{ display: 'flex', gap: '12px', fontSize: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                        <div style={{ color: hasIp ? '#38bdf8' : 'var(--text-muted)' }}>
                          IP: {hasIp ? branch.publicIp : '✗ Not Configured'}
                        </div>
                        <div style={{ color: '#34d399' }}>
                          Geofence: {branch.geofenceRadiusMeters}m
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <Link
                          href={`/${organizationCode}/admin/branches/${branch.id}`}
                          className="btn btn-secondary btn-sm"
                          style={{ flex: 1, textAlign: 'center' }}
                        >
                          Details
                        </Link>
                        <button
                          onClick={() => setToggleModalBranch(branch)}
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

      {/* Toggle Status Confirmation Modal */}
      <ConfirmationModal
        isOpen={Boolean(toggleModalBranch)}
        onClose={() => setToggleModalBranch(null)}
        onConfirm={handleToggleStatus}
        title={toggleModalBranch?.status === 'ACTIVE' ? 'Deactivate this branch?' : 'Activate this branch?'}
        message={
          toggleModalBranch?.status === 'ACTIVE'
            ? `Staff assigned to ${toggleModalBranch?.name} will no longer be able to use this branch for attendance verification.`
            : `Re-activate ${toggleModalBranch?.name} so assigned staff can resume attendance verification.`
        }
        confirmText={toggleModalBranch?.status === 'ACTIVE' ? 'Deactivate Branch' : 'Activate Branch'}
        variant={toggleModalBranch?.status === 'ACTIVE' ? 'danger' : 'primary'}
      />

      {/* Mobile Navigation */}
      <OrgAdminMobileNav organizationCode={organizationCode} />
    </div>
  );
}
