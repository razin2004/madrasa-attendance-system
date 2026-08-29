'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  MapPin,
  Network,
  Navigation,
  ShieldCheck,
  ArrowLeft,
  Edit2,
  RefreshCw,
  Power,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Clock,
  User,
  Building,
  Key,
  Info,
  Loader2,
  X,
  Layers,
  Smartphone,
  Wifi,
  Star,
  Check,
  Plus,
} from 'lucide-react';
import { OrgAdminSidebar } from '@/components/layout/org-admin-sidebar';
import { OrgAdminMobileNav } from '@/components/layout/org-admin-mobile-nav';
import { useToast } from '@/components/feedback/toast-provider';
import { ConfirmationModal } from '@/components/feedback/confirmation-modal';
import { getClientPublicIp } from '@/lib/client-location-ip';
import styles from './BranchDetails.module.css';

interface NetworkIdentity {
  id: string;
  publicIp: string;
  source: string;
  overrideReason: string | null;
  capturedBy: string | null;
  capturedAt: string;
  isActive: boolean;
}

interface BranchDetails {
  id: string;
  organizationId: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  locationAccuracyMeters: number | null;
  geofenceRadiusMeters: number;
  publicIp: string | null;
  ipSource: string;
  ipCapturedAt: string | null;
  ipCapturedBy: string | null;
  locationCapturedAt: string | null;
  locationCapturedBy: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
  networkIdentities: NetworkIdentity[];
}

interface OrgBranding {
  id: string;
  name: string;
  logoUrl: string | null;
  organizationCode: string;
}

export default function BranchDetailsPage() {
  const params = useParams();
  const organizationCode = (params.organizationCode as string)?.toUpperCase() || '';
  const branchId = params.branchId as string;
  const router = useRouter();
  const toast = useToast();

  const [branding, setBranding] = useState<OrgBranding | null>(null);
  const [branch, setBranch] = useState<BranchDetails | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit Metadata Form
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [geofenceRadius, setGeofenceRadius] = useState('150');
  const [isEditing, setIsEditing] = useState(false);
  const [savingMetadata, setSavingMetadata] = useState(false);

  // IP Recapture & Override
  const [recapturingIp, setRecapturingIp] = useState(false);
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [editPrimaryModalOpen, setEditPrimaryModalOpen] = useState(false);
  const [manualIp, setManualIp] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);
  const [newPrimaryIpInput, setNewPrimaryIpInput] = useState('');

  // Action Loading States
  const [settingPrimaryIp, setSettingPrimaryIp] = useState<string | null>(null);
  const [deletingIp, setDeletingIp] = useState<string | null>(null);
  const [detectingCurrentIp, setDetectingCurrentIp] = useState(false);

  // Location Recapture
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [newLat, setNewLat] = useState<number | null>(null);
  const [newLng, setNewLng] = useState<number | null>(null);
  const [newAccuracy, setNewAccuracy] = useState<number | null>(null);
  const [capturingGps, setCapturingGps] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [savingLocation, setSavingLocation] = useState(false);

  // Confirmation Modals
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusToggling, setStatusToggling] = useState(false);
  const [recaptureConfirmOpen, setRecaptureConfirmOpen] = useState(false);

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
      if (brandData.success) {
        setBranding(brandData.organization);
      }

      const branchRes = await fetch(`/api/org/${organizationCode}/branches/${branchId}`);
      const branchData = await branchRes.json();

      if (branchData.success) {
        setBranch(branchData.branch);
        setName(branchData.branch.name);
        setAddress(branchData.branch.address);
        setGeofenceRadius(branchData.branch.geofenceRadiusMeters.toString());
      } else {
        toast.error(branchData.error || 'Failed to load branch details.');
      }
    } catch (err) {
      toast.error('Network error loading branch details.');
    } finally {
      setLoading(false);
    }
  };

  // 1. Update Metadata
  const handleSaveMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingMetadata(true);
      const radius = parseInt(geofenceRadius, 10);
      if (isNaN(radius) || radius < 20 || radius > 5000) {
        toast.error('Geofence radius must be between 20 and 5000 meters.');
        return;
      }

      const res = await fetch(`/api/org/${organizationCode}/branches/${branchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          address: address.trim(),
          geofenceRadiusMeters: radius,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'Branch updated successfully.');
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

  // 2. Re-capture IP
  const handleRecaptureIp = async () => {
    try {
      setRecapturingIp(true);
      const clientIp = await getClientPublicIp();
      const headers: Record<string, string> = {};
      if (clientIp) headers['x-client-public-ip'] = clientIp;

      const res = await fetch(
        `/api/org/${organizationCode}/branches/${branchId}/recapture-ip`,
        { method: 'POST', headers }
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
    if (!manualIp.trim()) {
      toast.error('Public IP address is required.');
      return;
    }

    try {
      setOverrideSubmitting(true);
      const res = await fetch(`/api/org/${organizationCode}/branches/${branchId}/network-ips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicIp: manualIp.trim(),
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
        toast.error(data.error || 'Failed to add public IP.');
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

  // Remove IP (auto-promotes secondary IP if primary IP was deleted)
  const handleRemoveIp = async (ipToRemove: string) => {
    try {
      setDeletingIp(ipToRemove);
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
      setDeletingIp(null);
    }
  };

  // Detect Client IP helper
  const handleDetectClientIp = async (targetField: 'PRIMARY' | 'SECONDARY') => {
    try {
      setDetectingCurrentIp(true);
      const detected = await getClientPublicIp();
      if (detected) {
        if (targetField === 'PRIMARY') setNewPrimaryIpInput(detected);
        else setManualIp(detected);
        toast.info(`Detected current public IP: ${detected}`);
      } else {
        toast.error('Could not auto-detect public IP.');
      }
    } catch {
      toast.error('Failed to detect public IP.');
    } finally {
      setDetectingCurrentIp(false);
    }
  };

  // 5. Capture GPS Location
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

  // 6. Save Recaptured Location
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

  // 7. Toggle Active Status
  const handleToggleStatus = async () => {
    try {
      setStatusToggling(true);
      const res = await fetch(
        `/api/org/${organizationCode}/branches/${branchId}/toggle-status`,
        { method: 'POST' }
      );

      const data = await res.json();
      if (data.success) {
        toast.success(
          branch?.status === 'ACTIVE'
            ? 'Branch deactivated successfully.'
            : 'Branch activated successfully.'
        );
        setBranch(data.branch);
        setStatusModalOpen(false);
      } else {
        toast.error(data.error || 'Failed to update branch status.');
      }
    } catch {
      toast.error('Network error toggling status.');
    } finally {
      setStatusToggling(false);
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

  // Deduplicate IP lists so Primary IP is NOT duplicated in secondary list
  const primaryIp = branch.publicIp;
  const secondaryIps = branch.networkIdentities?.filter((n) => n.publicIp !== primaryIp) || [];
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
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="btn btn-secondary btn-sm"
              disabled={savingMetadata}
            >
              <Edit2 size={14} />
              <span>{isEditing ? 'Cancel Edit' : 'Edit Branch Info'}</span>
            </button>
            <button
              onClick={() => setStatusModalOpen(true)}
              disabled={statusToggling}
              className={`btn btn-sm ${isActive ? 'btn-danger-subtle' : 'btn-success-subtle'}`}
            >
              {statusToggling ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Power size={14} />
              )}
              <span>{isActive ? 'Deactivate Branch' : 'Activate Branch'}</span>
            </button>
          </div>
        </header>

        {/* Content Body */}
        <main style={{ padding: '32px', maxWidth: '1280px', width: '100%', margin: '0 auto' }}>
          {/* EDIT METADATA FORM */}
          {isEditing && (
            <div className="glass-card" style={{ padding: '24px', marginBottom: '28px', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff', marginBottom: '16px' }}>Edit Branch Information</h3>
              <form onSubmit={handleSaveMetadata} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '16px', alignItems: 'end' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '12.5px', color: '#ffffff', fontWeight: 600 }}>Branch Name</label>
                  <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="form-input" style={{ width: '100%', marginTop: '4px' }} />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '12.5px', color: '#ffffff', fontWeight: 600 }}>Geofence Radius (Meters)</label>
                  <input type="number" min="20" max="5000" required value={geofenceRadius} onChange={(e) => setGeofenceRadius(e.target.value)} className="form-input" style={{ width: '100%', marginTop: '4px' }} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label" style={{ fontSize: '12.5px', color: '#ffffff', fontWeight: 600 }}>Physical Address</label>
                  <input type="text" required value={address} onChange={(e) => setAddress(e.target.value)} className="form-input" style={{ width: '100%', marginTop: '4px' }} />
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

          {/* TWO COLUMN GRID: NETWORK IP SECURITY (LEFT) vs LOCATION GEOFENCE (RIGHT) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '28px' }}>
            {/* PANEL 1: NETWORK IP SECURITY (DEDUPLICATED) */}
            <div className={styles.panelCard}>
              <div className={styles.panelHeader}>
                <h3 className={styles.panelTitle}>
                  <Wifi size={18} color="#38bdf8" />
                  <span>Layer 1 Network Security (Public IP)</span>
                </h3>
                <span style={{ fontSize: '11.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                  {totalAuthorizedCount}/5 Authorized
                </span>
              </div>

              <div style={{ padding: '24px' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.5 }}>
                  Staff clock-in requests verify against authorized workplace public IP addresses. You can set 1 Primary IP and up to 4 Secondary IPs.
                </p>

                {/* PRIMARY PUBLIC IP CARD */}
                {primaryIp ? (
                  <div
                    style={{
                      padding: '18px 20px',
                      borderRadius: '14px',
                      backgroundColor: 'rgba(99, 102, 241, 0.08)',
                      border: '1px solid rgba(99, 102, 241, 0.3)',
                      marginBottom: '20px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Star size={16} color="#818cf8" fill="#818cf8" />
                        <span style={{ fontSize: '13px', fontWeight: 800, color: '#ffffff' }}>Primary Network IP</span>
                        <span style={{ fontSize: '10.5px', fontWeight: 800, padding: '1px 7px', borderRadius: '4px', backgroundColor: 'rgba(99, 102, 241, 0.2)', color: '#818cf8' }}>
                          Primary
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => {
                            setNewPrimaryIpInput(primaryIp);
                            setEditPrimaryModalOpen(true);
                          }}
                          disabled={settingPrimaryIp !== null}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '4px 10px', fontSize: '11.5px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Edit2 size={12} />
                          <span>Change Primary IP</span>
                        </button>
                        <button
                          onClick={() => handleRemoveIp(primaryIp)}
                          disabled={deletingIp === primaryIp}
                          className="btn btn-danger btn-sm"
                          style={{ padding: '4px 10px', fontSize: '11.5px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          {deletingIp === primaryIp ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <X size={12} />
                          )}
                          <span>{deletingIp === primaryIp ? 'Deleting...' : 'Remove'}</span>
                        </button>
                      </div>
                    </div>

                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 800, color: '#818cf8', letterSpacing: '0.5px' }}>
                      {primaryIp}
                    </div>

                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '6px' }}>
                      Source: {branch.ipSource} &bull; Captured: {branch.ipCapturedAt ? new Date(branch.ipCapturedAt).toLocaleString() : 'N/A'}
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '16px', borderRadius: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', fontSize: '13px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>No Primary Public IP configured for this branch.</span>
                    <button
                      onClick={() => {
                        setNewPrimaryIpInput('');
                        setEditPrimaryModalOpen(true);
                      }}
                      className="btn btn-primary btn-sm"
                      style={{ fontSize: '11.5px' }}
                    >
                      Set Primary IP
                    </button>
                  </div>
                )}

                {/* SECONDARY AUTHORIZED IPS LIST (PRIMARY EXCLUDED) */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Secondary Authorized IPs ({secondaryIps.length})</span>
                    {totalAuthorizedCount < 5 && (
                      <button
                        onClick={() => {
                          setManualIp('');
                          setOverrideReason('');
                          setOverrideModalOpen(true);
                        }}
                        disabled={overrideSubmitting}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '11.5px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        {overrideSubmitting ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                        <span>Add Authorized IP</span>
                      </button>
                    )}
                  </div>

                  {secondaryIps.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {secondaryIps.map((item) => {
                        const isSettingThisPrimary = settingPrimaryIp === item.publicIp;
                        const isDeletingThis = deletingIp === item.publicIp;

                        return (
                          <div
                            key={item.id}
                            style={{
                              padding: '12px 16px',
                              borderRadius: '10px',
                              backgroundColor: 'rgba(255, 255, 255, 0.03)',
                              border: '1px solid var(--border-subtle)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <div>
                              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>
                                {item.publicIp}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                {item.overrideReason || 'Secondary IP'} &bull; Added {new Date(item.capturedAt).toLocaleDateString()}
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                onClick={() => handleSetPrimaryIp(item.publicIp)}
                                disabled={isSettingThisPrimary || isDeletingThis}
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '4px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                title="Make this IP the Primary IP"
                              >
                                {isSettingThisPrimary ? (
                                  <Loader2 size={11} className="animate-spin" />
                                ) : (
                                  <Star size={11} color="#fbbf24" />
                                )}
                                <span>{isSettingThisPrimary ? 'Setting...' : 'Make Primary'}</span>
                              </button>

                              <button
                                onClick={() => handleRemoveIp(item.publicIp)}
                                disabled={isDeletingThis || isSettingThisPrimary}
                                className="btn btn-ghost btn-sm"
                                style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--danger-text)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                title="Remove authorized IP"
                              >
                                {isDeletingThis ? (
                                  <Loader2 size={11} className="animate-spin" />
                                ) : (
                                  <X size={13} />
                                )}
                                <span>{isDeletingThis ? 'Deleting...' : 'Remove'}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px dashed var(--border-subtle)', fontSize: '12.5px', color: 'var(--text-muted)', textAlign: 'center' }}>
                      No secondary authorized IPs. Click "Add Authorized IP" to register backup WiFi/router IPs.
                    </div>
                  )}
                </div>

                {/* Recapture Action Button */}
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setRecaptureConfirmOpen(true)}
                    disabled={recapturingIp}
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    {recapturingIp ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    <span>{recapturingIp ? 'Detecting Network IP...' : 'Recapture Current Network IP'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* PANEL 2: LOCATION & GEOFENCE SECURITY (RIGHT) */}
            <div className={styles.panelCard}>
              <div className={styles.panelHeader}>
                <h3 className={styles.panelTitle}>
                  <MapPin size={18} color="#34d399" />
                  <span>Layer 2 GPS Geofence Security</span>
                </h3>
              </div>

              <div style={{ padding: '24px' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.5 }}>
                  GPS perimeter restriction requires staff to be within allowed distance of physical coordinates when clocking in.
                </p>

                {/* COORDINATES DISPLAY */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
                  <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Latitude</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 800, color: '#ffffff', marginTop: '4px' }}>
                      {branch.latitude !== null ? branch.latitude.toFixed(6) : 'Not set'}
                    </div>
                  </div>

                  <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Longitude</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 800, color: '#ffffff', marginTop: '4px' }}>
                      {branch.longitude !== null ? branch.longitude.toFixed(6) : 'Not set'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', marginBottom: '24px' }}>
                  <div><span style={{ color: 'var(--text-muted)' }}>Allowed Geofence Radius: </span><strong style={{ color: '#ffffff' }}>{branch.geofenceRadiusMeters} meters</strong></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>GPS Signal Accuracy: </span><strong style={{ color: '#ffffff' }}>{branch.locationAccuracyMeters ? `${branch.locationAccuracyMeters}m` : 'N/A'}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Last Location Update: </span><strong style={{ color: '#ffffff' }}>{branch.locationCapturedAt ? new Date(branch.locationCapturedAt).toLocaleString() : 'N/A'}</strong></div>
                </div>

                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => {
                      setNewLat(branch.latitude);
                      setNewLng(branch.longitude);
                      setNewAccuracy(branch.locationAccuracyMeters);
                      setGpsError(null);
                      setLocationModalOpen(true);
                    }}
                    disabled={savingLocation}
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    {savingLocation ? <Loader2 size={14} className="animate-spin" /> : <Navigation size={14} />}
                    <span>{savingLocation ? 'Saving Location...' : 'Recapture GPS Coordinates'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* MODALS */}

      {/* 1. EDIT / CHANGE PRIMARY IP MODAL */}
      {editPrimaryModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999999, backgroundColor: 'rgba(3, 7, 18, 0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '440px', padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#ffffff' }}>Set / Change Primary Network IP</h3>
              <button onClick={() => setEditPrimaryModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              if (!newPrimaryIpInput.trim()) return toast.error('Primary IP is required.');
              handleSetPrimaryIp(newPrimaryIpInput.trim());
            }}>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ fontSize: '12.5px', color: '#ffffff', fontWeight: 600 }}>Primary Public IP Address *</label>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <input
                    type="text"
                    required
                    value={newPrimaryIpInput}
                    onChange={(e) => setNewPrimaryIpInput(e.target.value)}
                    placeholder="e.g. 49.47.195.139"
                    className="form-input"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => handleDetectClientIp('PRIMARY')}
                    disabled={detectingCurrentIp}
                    className="btn btn-secondary btn-sm"
                    style={{ whiteSpace: 'nowrap', fontSize: '11.5px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    title="Auto-detect my current public IP"
                  >
                    {detectingCurrentIp ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                    <span>{detectingCurrentIp ? 'Detecting...' : 'Auto-Detect'}</span>
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" onClick={() => setEditPrimaryModalOpen(false)} className="btn btn-secondary btn-sm">Cancel</button>
                <button
                  type="submit"
                  disabled={settingPrimaryIp !== null}
                  className="btn btn-primary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  {settingPrimaryIp !== null ? <Loader2 size={14} className="animate-spin" /> : null}
                  <span>{settingPrimaryIp !== null ? 'Saving Primary IP...' : 'Save Primary IP'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. MANUAL ADD SECONDARY IP MODAL */}
      {overrideModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999999, backgroundColor: 'rgba(3, 7, 18, 0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '440px', padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#ffffff' }}>Add Authorized Secondary IP</h3>
              <button onClick={() => setOverrideModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <form onSubmit={handleManualAddIp}>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ fontSize: '12.5px', color: '#ffffff', fontWeight: 600 }}>Public IP Address *</label>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <input
                    type="text"
                    required
                    value={manualIp}
                    onChange={(e) => setManualIp(e.target.value)}
                    placeholder="e.g. 157.48.201.12"
                    className="form-input"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => handleDetectClientIp('SECONDARY')}
                    disabled={detectingCurrentIp}
                    className="btn btn-secondary btn-sm"
                    style={{ whiteSpace: 'nowrap', fontSize: '11.5px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    {detectingCurrentIp ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                    <span>{detectingCurrentIp ? 'Detecting...' : 'Auto-Detect'}</span>
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label" style={{ fontSize: '12.5px', color: '#ffffff', fontWeight: 600 }}>Reason / Description</label>
                <input
                  type="text"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g. Backup Router / Fiber Connection"
                  className="form-input"
                  style={{ width: '100%', marginTop: '4px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setOverrideModalOpen(false)} className="btn btn-secondary btn-sm">Cancel</button>
                <button type="submit" disabled={overrideSubmitting} className="btn btn-primary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  {overrideSubmitting ? <Loader2 size={14} className="animate-spin" /> : null}
                  <span>{overrideSubmitting ? 'Registering IP...' : 'Register Authorized IP'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. RECAPTURE CONFIRM MODAL */}
      <ConfirmationModal
        isOpen={recaptureConfirmOpen}
        onClose={() => setRecaptureConfirmOpen(false)}
        onConfirm={handleRecaptureIp}
        title="Recapture Network IP?"
        message="This will update the branch's Primary IP to your current network's public IP address."
        confirmText="Recapture IP"
        variant="primary"
      />

      {/* 4. LOCATION RECAPTURE MODAL */}
      {locationModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999999, backgroundColor: 'rgba(3, 7, 18, 0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '460px', padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#ffffff' }}>Recapture GPS Location</h3>
              <button onClick={() => setLocationModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            {gpsError && (
              <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', fontSize: '12.5px', marginBottom: '16px' }}>
                {gpsError}
              </div>
            )}

            <div style={{ padding: '16px', borderRadius: '12px', backgroundColor: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-subtle)', marginBottom: '20px' }}>
              <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>Captured Coordinates:</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '15px', fontWeight: 800, color: '#ffffff', marginTop: '4px' }}>
                {newLat !== null && newLng !== null ? `${newLat.toFixed(6)}, ${newLng.toFixed(6)}` : 'No GPS coordinates captured yet'}
              </div>
              {newAccuracy !== null && (
                <div style={{ fontSize: '11.5px', color: '#34d399', marginTop: '4px' }}>Accuracy: {newAccuracy} meters</div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                onClick={handleCaptureGps}
                disabled={capturingGps}
                className="btn btn-secondary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                {capturingGps ? <Loader2 size={14} className="animate-spin" /> : <Navigation size={14} />}
                <span>{capturingGps ? 'Capturing GPS...' : 'Detect My Location'}</span>
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => setLocationModalOpen(false)} className="btn btn-secondary btn-sm">Cancel</button>
                <button
                  type="button"
                  onClick={handleSaveLocation}
                  disabled={savingLocation || newLat === null}
                  className="btn btn-primary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  {savingLocation ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  <span>{savingLocation ? 'Saving...' : 'Save Location'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. STATUS TOGGLE CONFIRM MODAL */}
      <ConfirmationModal
        isOpen={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        onConfirm={handleToggleStatus}
        title={isActive ? 'Deactivate branch?' : 'Activate branch?'}
        message={
          isActive
            ? `Deactivating ${branch.name} will prevent staff assigned to this branch from clocking in.`
            : `Re-activating ${branch.name} will restore location and IP attendance validation.`
        }
        confirmText={isActive ? 'Deactivate Branch' : 'Activate Branch'}
        variant={isActive ? 'danger' : 'primary'}
      />

      {/* Mobile Nav */}
      <OrgAdminMobileNav organizationCode={organizationCode} />
    </div>
  );
}
