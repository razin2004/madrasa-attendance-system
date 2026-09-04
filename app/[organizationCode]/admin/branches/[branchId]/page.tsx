'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  MapPin,
  Wifi,
  Navigation,
  Edit2,
  Power,
  ArrowLeft,
  Users,
  ShieldCheck,
  RefreshCw,
  Plus,
  Trash2,
  Layers,
  Key,
  Network,
  Star,
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { OrgAdminSidebar } from '@/components/layout/org-admin-sidebar';
import { OrgAdminMobileNav } from '@/components/layout/org-admin-mobile-nav';
import { useToast } from '@/components/feedback/toast-provider';
import { ConfirmationModal } from '@/components/feedback/confirmation-modal';
import { getClientPublicIp } from '@/lib/ip-detection';
import styles from './BranchDetails.module.css';

interface BranchNetworkIdentity {
  id: string;
  publicIp: string;
  source: string;
  isActive: boolean;
  overrideReason?: string | null;
  createdAt: string;
}

interface StaffAssignment {
  id: string;
  assignedAt: string;
  staffProfile: {
    id: string;
    staffId: string;
    name: string;
    phone: string;
    user: { status: 'ACTIVE' | 'INACTIVE' };
  };
}

interface BranchDetail {
  id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  geofenceRadiusMeters: number;
  publicIp: string | null;
  ipCapturedAt: string | null;
  ipCapturedBy: string | null;
  ipSource: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
  networkIdentities: BranchNetworkIdentity[];
  staffAssignments: StaffAssignment[];
}

export default function BranchDetailPage() {
  const params = useParams();
  const organizationCode = (params.organizationCode as string)?.toUpperCase() || '';
  const branchId = params.branchId as string;
  const router = useRouter();
  const toast = useToast();

  const [branding, setBranding] = useState<any>(null);
  const [branch, setBranch] = useState<BranchDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit Metadata State
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [geofenceRadiusMeters, setGeofenceRadiusMeters] = useState('100');
  const [savingMetadata, setSavingMetadata] = useState(false);

  // Recapture Confirmation Modal
  const [recaptureConfirmOpen, setRecaptureConfirmOpen] = useState(false);
  const [recapturingIp, setRecapturingIp] = useState(false);

  // Manual IP Add Modal State
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [manualIp, setManualIp] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);

  // Edit Primary IP Modal State
  const [editPrimaryModalOpen, setEditPrimaryModalOpen] = useState(false);
  const [newPrimaryIpInput, setNewPrimaryIpInput] = useState('');

  // Action Loading States
  const [settingPrimaryIp, setSettingPrimaryIp] = useState<string | null>(null);
  const [removingIp, setRemovingIp] = useState<string | null>(null);
  const [autoDetectingIp, setAutoDetectingIp] = useState(false);

  // Status Toggle Confirmation Modal
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);

  // Recapture Location Modal State
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [capturingGps, setCapturingGps] = useState(false);
  const [newLat, setNewLat] = useState<number | null>(null);
  const [newLng, setNewLng] = useState<number | null>(null);
  const [newAccuracy, setNewAccuracy] = useState<number | null>(null);
  const [savingLocation, setSavingLocation] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  useEffect(() => {
    if (organizationCode && branchId) {
      fetchData();
    }
  }, [organizationCode, branchId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const brandRes = await fetch(`/api/org/${organizationCode}/branding`);
      const brandData = await brandRes.json();
      if (brandData.success) setBranding(brandData.organization);

      const res = await fetch(`/api/org/${organizationCode}/branches/${branchId}`);
      const data = await res.json();
      if (data.success && data.branch) {
        setBranch(data.branch);
        setName(data.branch.name);
        setAddress(data.branch.address);
        setGeofenceRadiusMeters(String(data.branch.geofenceRadiusMeters));
      } else {
        toast.error(data.error || 'Failed to load branch details.');
      }
    } catch {
      toast.error('Network error loading branch details.');
    } finally {
      setLoading(false);
    }
  };

  // 1. Update Branch Profile
  const handleSaveMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !address.trim()) {
      toast.error('Branch Name and Address are required.');
      return;
    }

    try {
      setSavingMetadata(true);
      const res = await fetch(`/api/org/${organizationCode}/branches/${branchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          address: address.trim(),
          geofenceRadiusMeters: parseInt(geofenceRadiusMeters, 10),
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Branch details updated successfully.');
        setBranch(data.branch);
        setIsEditing(false);
      } else {
        toast.error(data.error || 'Failed to update branch.');
      }
    } catch {
      toast.error('Network error updating branch.');
    } finally {
      setSavingMetadata(false);
    }
  };

  // 2. Recapture Current Public IP
  const handleRecaptureIp = async () => {
    try {
      setRecapturingIp(true);
      const res = await fetch(
        `/api/org/${organizationCode}/branches/${branchId}/recapture-ip`,
        { method: 'POST' }
      );

      const data = await res.json();
      if (data.success) {
        toast.success('Branch primary network IP updated.');
        setBranch(data.branch);
        setRecaptureConfirmOpen(false);
      } else {
        toast.error(data.error || 'Failed to re-capture IP.');
      }
    } catch {
      toast.error('Network error re-capturing IP.');
    } finally {
      setRecapturingIp(false);
    }
  };

  // 3. Manual IP Add (Secondary)
  const handleManualAddIp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanIp = manualIp.trim();
    if (!cleanIp) {
      toast.error('Public IP address is required.');
      return;
    }

    // Client-side check for existing IP in current branch
    if (
      branch?.publicIp?.trim() === cleanIp ||
      branch?.networkIdentities?.some((n) => n.isActive && n.publicIp?.trim() === cleanIp)
    ) {
      toast.error(`IP address "${cleanIp}" already exists for this branch.`);
      return;
    }

    try {
      setOverrideSubmitting(true);
      const res = await fetch(`/api/org/${organizationCode}/branches/${branchId}/network-ips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicIp: cleanIp,
          overrideReason: overrideReason.trim() || 'Manual Addition',
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'Authorized public IP registered successfully.');
        fetchData();
        setOverrideModalOpen(false);
        setManualIp('');
        setOverrideReason('');
      } else {
        toast.error(data.error || 'IP address already exists.');
      }
    } catch {
      toast.error('Network error registering public IP.');
    } finally {
      setOverrideSubmitting(false);
    }
  };

  // 4. Set / Change Primary IP
  const handleSetPrimaryIp = async (targetIp: string) => {
    try {
      setSettingPrimaryIp(targetIp);
      const res = await fetch(`/api/org/${organizationCode}/branches/${branchId}/network-ips`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primaryIp: targetIp.trim(),
          overrideReason: 'Set Primary IP via Admin',
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`Primary IP updated to ${targetIp.trim()}`);
        setBranch(data.branch);
        setEditPrimaryModalOpen(false);
        setNewPrimaryIpInput('');
      } else {
        toast.error(data.error || 'Failed to update primary IP.');
      }
    } catch {
      toast.error('Network error updating primary IP.');
    } finally {
      setSettingPrimaryIp(null);
    }
  };

  // 5. Remove IP (with Auto-Promote on Primary Deletion)
  const handleRemoveIp = async (ipToRemove: string) => {
    try {
      setRemovingIp(ipToRemove);
      const res = await fetch(
        `/api/org/${organizationCode}/branches/${branchId}/network-ips?ip=${encodeURIComponent(ipToRemove)}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'Authorized IP removed successfully.');
        fetchData();
      } else {
        toast.error(data.error || 'Failed to remove IP address.');
      }
    } catch {
      toast.error('Network error removing IP address.');
    } finally {
      setRemovingIp(null);
    }
  };

  // 6. Capture GPS Location
  const handleCaptureGps = () => {
    if (!navigator.geolocation) {
      setGpsError('Browser Geolocation is not supported on this device.');
      return;
    }

    setCapturingGps(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setNewLat(pos.coords.latitude);
        setNewLng(pos.coords.longitude);
        setNewAccuracy(pos.coords.accuracy ? Math.round(pos.coords.accuracy) : null);
        setCapturingGps(false);
      },
      (err) => {
        setCapturingGps(false);
        setGpsError(err.message || 'Failed to capture GPS location.');
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  };

  // 7. Save Recaptured Location
  const handleSaveLocation = async () => {
    if (newLat === null || newLng === null) return;
    try {
      setSavingLocation(true);
      const res = await fetch(
        `/api/org/${organizationCode}/branches/${branchId}/recapture-location`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            latitude: newLat,
            longitude: newLng,
            locationAccuracyMeters: newAccuracy,
          }),
        }
      );

      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'Location security updated.');
        setBranch(data.branch);
        setLocationModalOpen(false);
        setNewLat(null);
        setNewLng(null);
      } else {
        toast.error(data.error || 'Failed to update location.');
      }
    } catch {
      toast.error('Network error updating location.');
    } finally {
      setSavingLocation(false);
    }
  };

  // 8. Toggle Branch Status
  const handleToggleStatus = async () => {
    try {
      setTogglingStatus(true);
      const res = await fetch(
        `/api/org/${organizationCode}/branches/${branchId}/toggle-status`,
        { method: 'POST' }
      );

      const data = await res.json();
      if (data.success) {
        toast.success(
          branch?.status === 'ACTIVE'
            ? 'Branch deactivated successfully.'
            : 'Branch re-activated successfully.'
        );
        setBranch(data.branch);
        setStatusModalOpen(false);
      } else {
        toast.error(data.error || 'Failed to toggle branch status.');
      }
    } catch {
      toast.error('Network error toggling branch status.');
    } finally {
      setTogglingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <OrgAdminSidebar organizationCode={organizationCode} organizationName={branding?.name || 'Organization'} />
        <div className={styles.mainContent} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Loader2 size={32} className="animate-spin" style={{ color: '#818cf8' }} />
        </div>
      </div>
    );
  }

  if (!branch) {
    return (
      <div className={styles.container}>
        <OrgAdminSidebar organizationCode={organizationCode} organizationName={branding?.name || 'Organization'} />
        <div className={styles.mainContent} style={{ padding: '32px', textAlign: 'center' }}>
          <AlertTriangle size={36} color="var(--danger-text)" style={{ margin: '0 auto 12px auto' }} />
          <h2>Branch not found</h2>
          <Link href={`/${organizationCode}/admin/branches`} className="btn btn-primary" style={{ marginTop: '16px' }}>
            Back to Branches
          </Link>
        </div>
      </div>
    );
  }

  const isActive = branch.status === 'ACTIVE';

  // Network IP Deduplication Logic
  const primaryIp = branch.publicIp?.trim() || null;
  const secondaryIps = (branch.networkIdentities || []).filter(
    (n) => n.isActive && n.publicIp?.trim() !== primaryIp
  );
  const totalAuthorizedCount = (primaryIp ? 1 : 0) + secondaryIps.length;

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <Link href={`/${organizationCode}/admin/branches`} className="btn btn-secondary btn-sm" style={{ padding: '8px' }}>
              <ArrowLeft size={16} />
            </Link>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 className={styles.title}>{branch.name}</h1>
                <span
                  style={{
                    padding: '3px 10px',
                    borderRadius: '9999px',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    backgroundColor: isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: isActive ? '#34d399' : '#f87171',
                    border: `1px solid ${isActive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  }}
                >
                  {isActive ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {branch.address}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button onClick={() => setIsEditing(!isEditing)} className="btn btn-secondary btn-sm">
              <Edit2 size={14} />
              <span>{isEditing ? 'Cancel Edit' : 'Edit Branch'}</span>
            </button>
            <button
              onClick={() => setStatusModalOpen(true)}
              disabled={togglingStatus}
              className={`btn btn-sm ${isActive ? 'btn-danger-subtle' : 'btn-success-subtle'}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              {togglingStatus ? <Loader2 size={14} className="animate-spin" /> : <Power size={14} />}
              <span>{isActive ? 'Deactivate Branch' : 'Activate Branch'}</span>
            </button>
          </div>
        </header>

        {/* Content Body */}
        <main style={{ padding: '32px', maxWidth: '1280px', width: '100%', margin: '0 auto' }}>
          {/* Warning Banner if Inactive */}
          {!isActive && (
            <div style={{ padding: '16px 20px', borderRadius: '12px', backgroundColor: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', fontSize: '13.5px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <AlertTriangle size={20} />
              <div>
                <strong style={{ color: '#ffffff' }}>This branch is currently inactive.</strong> Staff assigned to this branch cannot use it for attendance verification.
              </div>
            </div>
          )}

          {/* EDIT FORM (When active) */}
          {isEditing && (
            <div className="glass-card" style={{ padding: '24px', marginBottom: '28px', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff', marginBottom: '16px' }}>
                Edit Branch Information
              </h3>
              <form onSubmit={handleSaveMetadata} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '12.5px', color: '#ffffff', fontWeight: 600 }}>Branch Name</label>
                  <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="form-input" style={{ width: '100%', marginTop: '4px' }} />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '12.5px', color: '#ffffff', fontWeight: 600 }}>Address</label>
                  <input type="text" required value={address} onChange={(e) => setAddress(e.target.value)} className="form-input" style={{ width: '100%', marginTop: '4px' }} />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '12.5px', color: '#ffffff', fontWeight: 600 }}>Geofence Radius (Meters)</label>
                  <input type="number" min="20" max="1000" required value={geofenceRadiusMeters} onChange={(e) => setGeofenceRadiusMeters(e.target.value)} className="form-input" style={{ width: '100%', marginTop: '4px' }} />
                </div>
                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
                  <button type="button" onClick={() => setIsEditing(false)} className="btn btn-secondary btn-sm">Cancel</button>
                  <button type="submit" disabled={savingMetadata} className="btn btn-primary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    {savingMetadata ? <Loader2 size={14} className="animate-spin" /> : null}
                    <span>{savingMetadata ? 'Saving...' : 'Save Changes'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TWO COLUMN PANELS */}
          <div className={styles.gridTwoCol}>
            {/* Panel 1: Network Security */}
            <div className={styles.panelCard}>
              <div className={styles.panelHeader}>
                <h3 className={styles.panelTitle}>
                  <Network size={18} color="#38bdf8" />
                  Approved Network Security (Layer 1)
                </h3>
                <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(6, 182, 212, 0.12)', color: '#38bdf8' }}>
                  {branch.ipSource || 'AUTO_DETECTED'}
                </span>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Authorized Public IPs (Up to 5)
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {totalAuthorizedCount}/5 Registered
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
                  {/* PRIMARY PUBLIC IP CARD */}
                  {primaryIp ? (
                    <div style={{ padding: '12px 16px', borderRadius: '12px', backgroundColor: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Star size={14} color="#38bdf8" fill="#38bdf8" />
                          <span style={{ fontSize: '14.5px', fontWeight: 800, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>{primaryIp}</span>
                          <span style={{ fontSize: '10.5px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', textTransform: 'uppercase' }}>Primary IP</span>
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#cbd5e1', marginTop: '2px' }}>
                          Default branch network identifier
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => {
                            setNewPrimaryIpInput(primaryIp);
                            setEditPrimaryModalOpen(true);
                          }}
                          disabled={settingPrimaryIp === primaryIp || removingIp === primaryIp}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '4px 10px', fontSize: '11.5px', borderRadius: '6px' }}
                        >
                          Change
                        </button>
                        <button
                          onClick={() => handleRemoveIp(primaryIp)}
                          disabled={removingIp === primaryIp || settingPrimaryIp === primaryIp}
                          className="btn btn-danger btn-sm"
                          style={{ padding: '4px 10px', fontSize: '11.5px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          {removingIp === primaryIp ? <Loader2 size={12} className="animate-spin" /> : null}
                          <span>{removingIp === primaryIp ? 'Removing...' : 'Remove'}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '12px 16px', borderRadius: '12px', backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', color: '#fbbf24', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>✗ No Primary Public IP set.</span>
                      <button
                        onClick={() => {
                          setNewPrimaryIpInput('');
                          setEditPrimaryModalOpen(true);
                        }}
                        className="btn btn-warning btn-sm"
                        style={{ padding: '4px 10px', fontSize: '11.5px' }}
                      >
                        + Set Primary IP
                      </button>
                    </div>
                  )}

                  {/* SECONDARY AUTHORIZED IPS (DEDUPLICATED) */}
                  {secondaryIps.map((n) => {
                    const isPromoting = settingPrimaryIp === n.publicIp;
                    const isRemoving = removingIp === n.publicIp;
                    return (
                      <div key={n.id} style={{ padding: '10px 14px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <span style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', fontFamily: 'var(--font-mono)' }}>{n.publicIp}</span>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{n.overrideReason || 'Secondary IP'}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={() => handleSetPrimaryIp(n.publicIp)}
                            disabled={isPromoting || isRemoving || !!settingPrimaryIp}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '3px 8px', fontSize: '11px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            title="Set this IP as Primary"
                          >
                            {isPromoting ? <Loader2 size={11} className="animate-spin" /> : null}
                            <span>{isPromoting ? 'Promoting...' : 'Make Primary'}</span>
                          </button>
                          <button
                            onClick={() => handleRemoveIp(n.publicIp)}
                            disabled={isRemoving || isPromoting || !!removingIp}
                            className="btn btn-danger btn-sm"
                            style={{ padding: '3px 8px', fontSize: '11px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            {isRemoving ? <Loader2 size={11} className="animate-spin" /> : null}
                            <span>{isRemoving ? 'Removing...' : 'Remove'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                  Staff connecting from any registered branch IP will pass Layer 1 network verification.
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setRecaptureConfirmOpen(true)}
                  disabled={recapturingIp}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <RefreshCw size={14} className={recapturingIp ? 'animate-spin' : ''} />
                  <span>{recapturingIp ? 'Recapturing...' : 'Recapture Current IP'}</span>
                </button>
                {totalAuthorizedCount < 5 && (
                  <button
                    onClick={() => setOverrideModalOpen(true)}
                    className="btn btn-primary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Key size={14} />
                    <span>+ Add Additional IP</span>
                  </button>
                )}
              </div>
            </div>

            {/* Panel 2: Location Security */}
            <div className={styles.panelCard}>
              <div className={styles.panelHeader}>
                <h3 className={styles.panelTitle}>
                  <Navigation size={18} color="#34d399" />
                  Location Security &amp; Geofence (Layer 2)
                </h3>
                <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#34d399' }}>
                  ✓ {branch.geofenceRadiusMeters} m Radius
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Latitude</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', fontFamily: 'var(--font-mono)' }}>{branch.latitude?.toFixed(6) || 'N/A'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Longitude</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', fontFamily: 'var(--font-mono)' }}>{branch.longitude?.toFixed(6) || 'N/A'}</div>
                </div>
              </div>

              <button
                onClick={() => { setLocationModalOpen(true); handleCaptureGps(); }}
                disabled={capturingGps}
                className="btn btn-secondary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Navigation size={14} className={capturingGps ? 'animate-spin' : ''} />
                <span>{capturingGps ? 'Capturing GPS...' : 'Re-capture GPS Location'}</span>
              </button>
            </div>
          </div>

          {/* 3-LAYER SECURITY ARCHITECTURE OVERVIEW CARD */}
          <div className="glass-card" style={{ padding: '24px', marginBottom: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Layers size={18} color="#818cf8" />
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>
                Three-Layer Attendance Verification Role
              </h3>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              ShiftGuard verifies staff attendance against three security layers simultaneously. This branch configuration supplies <strong>Layer 1 (Public Network IP)</strong> and <strong>Layer 2 (GPS Geofence)</strong> bounds. Staff devices supply <strong>Layer 3 (Bound Hardware Secret)</strong>.
            </p>
          </div>
        </main>
      </div>

      {/* CONFIRMATION & EDIT MODALS */}
      {/* 1. Recapture Confirmation */}
      <ConfirmationModal
        isOpen={recaptureConfirmOpen}
        onClose={() => setRecaptureConfirmOpen(false)}
        onConfirm={handleRecaptureIp}
        title="Recapture Branch Primary Network IP?"
        message="Connect to this branch's Wi-Fi network before continuing. ShiftGuard will capture the current public IP as the Primary IP for Layer 1 attendance verification."
        confirmText="Recapture IP"
      />

      {/* 2. Status Toggle Confirmation */}
      <ConfirmationModal
        isOpen={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        onConfirm={handleToggleStatus}
        title={isActive ? 'Deactivate this branch?' : 'Activate this branch?'}
        message={
          isActive
            ? 'Staff assigned to this branch will no longer be able to use it for attendance verification.'
            : 'Re-activate this branch so assigned staff can resume attendance verification.'
        }
        confirmText={isActive ? 'Deactivate Branch' : 'Activate Branch'}
        variant={isActive ? 'danger' : 'primary'}
      />

      {/* 3. Change Primary IP Modal */}
      {editPrimaryModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999999, backgroundColor: 'rgba(3, 7, 18, 0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '440px', padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#ffffff' }}>Change Primary Public IP</h3>
              <button onClick={() => setEditPrimaryModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleSetPrimaryIp(newPrimaryIpInput); }}>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label className="form-label" style={{ fontSize: '12.5px', color: '#ffffff', fontWeight: 600 }}>Primary Public IP</label>
                  <button
                    type="button"
                    disabled={autoDetectingIp}
                    onClick={async () => {
                      try {
                        setAutoDetectingIp(true);
                        const ip = await getClientPublicIp();
                        if (ip) {
                          setNewPrimaryIpInput(ip);
                          toast.info(`Detected current IP: ${ip}`);
                        }
                      } finally {
                        setAutoDetectingIp(false);
                      }
                    }}
                    style={{ fontSize: '11px', color: '#38bdf8', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    {autoDetectingIp ? <Loader2 size={11} className="animate-spin" /> : '⚡'}
                    <span>{autoDetectingIp ? 'Detecting...' : 'Auto-Detect My IP'}</span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  placeholder="e.g. 49.47.195.139"
                  value={newPrimaryIpInput}
                  onChange={(e) => setNewPrimaryIpInput(e.target.value)}
                  className="form-input"
                  style={{ width: '100%', marginTop: '4px' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setEditPrimaryModalOpen(false)} className="btn btn-secondary btn-sm">Cancel</button>
                <button type="submit" disabled={!!settingPrimaryIp} className="btn btn-primary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  {settingPrimaryIp === newPrimaryIpInput ? <Loader2 size={14} className="animate-spin" /> : null}
                  <span>{settingPrimaryIp === newPrimaryIpInput ? 'Saving...' : 'Save Primary IP'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Manual Add IP Modal */}
      {overrideModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999999, backgroundColor: 'rgba(3, 7, 18, 0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '440px', padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#ffffff' }}>Add Authorized Public IP</h3>
              <button onClick={() => setOverrideModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleManualAddIp}>
              <div style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label className="form-label" style={{ fontSize: '12.5px', color: '#ffffff', fontWeight: 600 }}>Public IP Address</label>
                  <button
                    type="button"
                    disabled={autoDetectingIp}
                    onClick={async () => {
                      try {
                        setAutoDetectingIp(true);
                        const ip = await getClientPublicIp();
                        if (ip) {
                          setManualIp(ip);
                          toast.info(`Detected current IP: ${ip}`);
                        }
                      } finally {
                        setAutoDetectingIp(false);
                      }
                    }}
                    style={{ fontSize: '11px', color: '#38bdf8', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    {autoDetectingIp ? <Loader2 size={11} className="animate-spin" /> : '⚡'}
                    <span>{autoDetectingIp ? 'Detecting...' : 'Auto-Detect My IP'}</span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  placeholder="e.g. 203.0.113.45"
                  value={manualIp}
                  onChange={(e) => setManualIp(e.target.value)}
                  className="form-input"
                  style={{ width: '100%', marginTop: '4px' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label className="form-label" style={{ fontSize: '12.5px', color: '#ffffff', fontWeight: 600 }}>Label / Reason (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Secondary Router / Guest Wi-Fi"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="form-input"
                  style={{ width: '100%', marginTop: '4px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setOverrideModalOpen(false)} className="btn btn-secondary btn-sm">Cancel</button>
                <button type="submit" disabled={overrideSubmitting} className="btn btn-primary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  {overrideSubmitting ? <Loader2 size={14} className="animate-spin" /> : null}
                  <span>{overrideSubmitting ? 'Adding IP...' : 'Add Public IP'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Recapture Location Modal */}
      {locationModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999999, backgroundColor: 'rgba(3, 7, 18, 0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '440px', padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#ffffff' }}>Recapture GPS Geofence Location</h3>
              <button onClick={() => setLocationModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            {gpsError && (
              <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', fontSize: '12.5px', marginBottom: '16px' }}>
                {gpsError}
              </div>
            )}

            <div style={{ padding: '16px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Latitude:</span>
                <strong style={{ color: '#ffffff', fontFamily: 'var(--font-mono)' }}>{newLat !== null ? newLat.toFixed(6) : 'Detecting...'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Longitude:</span>
                <strong style={{ color: '#ffffff', fontFamily: 'var(--font-mono)' }}>{newLng !== null ? newLng.toFixed(6) : 'Detecting...'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Accuracy:</span>
                <strong style={{ color: '#34d399', fontFamily: 'var(--font-mono)' }}>{newAccuracy !== null ? `±${newAccuracy} m` : 'N/A'}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={handleCaptureGps} disabled={capturingGps} className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <RefreshCw size={13} className={capturingGps ? 'animate-spin' : ''} />
                <span>{capturingGps ? 'Capturing...' : 'Re-Detect GPS'}</span>
              </button>
              <button type="button" onClick={handleSaveLocation} disabled={savingLocation || newLat === null} className="btn btn-primary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                {savingLocation ? <Loader2 size={14} className="animate-spin" /> : null}
                <span>{savingLocation ? 'Saving...' : 'Save Location'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Nav */}
      <OrgAdminMobileNav organizationCode={organizationCode} />
    </div>
  );
}
