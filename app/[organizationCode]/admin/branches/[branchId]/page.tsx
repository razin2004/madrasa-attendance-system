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
  const [manualIp, setManualIp] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);

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
        toast.success('Branch security network IP updated.');
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

  // 3. Manual IP Override
  const handleManualOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualIp.trim()) {
      toast.error('Public IP address is required.');
      return;
    }
    if (!overrideReason.trim()) {
      toast.error('Override reason is required for security auditing.');
      return;
    }

    try {
      const res = await fetch(`/api/org/${organizationCode}/branches/${branchId}/network-ips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicIp: manualIp.trim(),
          overrideReason: overrideReason.trim() || 'Manual Override',
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
        toast.error(data.error || 'Failed to override public IP.');
      }
    } catch {
      toast.error('Network error registering public IP.');
    } finally {
      setOverrideSubmitting(false);
    }
  };

  const handleRemoveIp = async (ipToRemove: string) => {
    try {
      const res = await fetch(`/api/org/${organizationCode}/branches/${branchId}/network-ips?ip=${encodeURIComponent(ipToRemove)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'Authorized IP removed successfully.');
        fetchData();
      } else {
        toast.error(data.error || 'Failed to remove IP address.');
      }
    } catch {
      toast.error('Network error removing IP address.');
    }
  };

  // 4. Capture GPS Location
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

  // 5. Save Recaptured Location
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

  // 6. Toggle Active Status
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
              className={`btn btn-sm ${isActive ? 'btn-danger-subtle' : 'btn-success-subtle'}`}
            >
              <Power size={14} />
              <span>{isActive ? 'Deactivate Branch' : 'Activate Branch'}</span>
            </button>
          </div>
        </header>

        {/* Content Body */}
        <main style={{ padding: '32px', maxWidth: '1280px', width: '100%', margin: '0 auto' }}>
          {/* INACTIVE NOTICE BANNER */}
          {!isActive && (
            <div
              style={{
                padding: '16px 20px',
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: 'var(--radius-md)',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontSize: '13.5px',
                color: '#f87171',
              }}
            >
              <ShieldAlert size={20} style={{ flexShrink: 0 }} />
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
                  <label className="form-label" style={{ fontSize: '12.5px', color: '#ffffff', fontWeight: 600 }}>Geofence Radius (m)</label>
                  <input type="number" min={20} max={5000} value={geofenceRadius} onChange={(e) => setGeofenceRadius(e.target.value)} className="form-input" style={{ width: '100%', marginTop: '4px' }} />
                </div>
                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
                  <button type="button" onClick={() => setIsEditing(false)} className="btn btn-secondary btn-sm">Cancel</button>
                  <button type="submit" disabled={savingMetadata} className="btn btn-primary btn-sm">
                    {savingMetadata ? 'Saving...' : 'Save Changes'}
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Authorized Public IPs (Up to 5)
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {((branch.publicIp ? 1 : 0) + (branch.networkIdentities?.length || 0))}/5 Active
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                  {branch.publicIp && (
                    <div style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>{branch.publicIp} (Primary)</span>
                      <button onClick={() => handleRemoveIp(branch.publicIp!)} className="btn btn-danger btn-sm" style={{ padding: '2px 8px', fontSize: '11px' }}>Remove</button>
                    </div>
                  )}
                  {branch.networkIdentities?.map((n) => (
                    <div key={n.id} style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', fontFamily: 'var(--font-mono)' }}>{n.publicIp}</span>
                      <button onClick={() => handleRemoveIp(n.publicIp)} className="btn btn-danger btn-sm" style={{ padding: '2px 8px', fontSize: '11px' }}>Remove</button>
                    </div>
                  ))}
                  {!branch.publicIp && (!branch.networkIdentities || branch.networkIdentities.length === 0) && (
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>✗ No public IPs configured. Staff network verification will fail.</div>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                  Up to 5 authorized public IP addresses can be registered for this branch.
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
                  <span>Recapture Current IP</span>
                </button>
                {((branch.publicIp ? 1 : 0) + (branch.networkIdentities?.length || 0)) < 5 && (
                  <button
                    onClick={() => setOverrideModalOpen(true)}
                    className="btn btn-primary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Key size={14} />
                    <span>+ Add IP</span>
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
                className="btn btn-secondary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Navigation size={14} />
                <span>Re-capture GPS Location</span>
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

          {/* NETWORK IDENTITIES AUDIT HISTORY */}
          {branch.networkIdentities && branch.networkIdentities.length > 0 && (
            <div className="glass-card" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', marginBottom: '16px' }}>
                Registered Network Identities History
              </h3>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                    <th style={{ padding: '8px 12px' }}>Public IP</th>
                    <th style={{ padding: '8px 12px' }}>Source</th>
                    <th style={{ padding: '8px 12px' }}>Reason</th>
                    <th style={{ padding: '8px 12px' }}>Captured At</th>
                  </tr>
                </thead>
                <tbody>
                  {branch.networkIdentities.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#38bdf8' }}>{item.publicIp}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{item.source}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{item.overrideReason || '—'}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{new Date(item.capturedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>

      {/* CONFIRMATION MODALS */}
      {/* 1. Recapture Confirmation */}
      <ConfirmationModal
        isOpen={recaptureConfirmOpen}
        onClose={() => setRecaptureConfirmOpen(false)}
        onConfirm={handleRecaptureIp}
        title="Recapture Branch Network IP?"
        message="Connect to this branch's Wi-Fi network before continuing. ShiftGuard will capture the current public IP for Layer 1 attendance verification."
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

      {/* 3. Manual Override Modal */}
      {overrideModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999999, backgroundColor: 'rgba(3, 7, 18, 0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '440px', padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#ffffff' }}>Manual IP Override</h3>
              <button onClick={() => setOverrideModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleManualOverride}>
              <div style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontSize: '12.5px', color: '#ffffff', fontWeight: 600 }}>Static Public IP</label>
                <input type="text" required placeholder="e.g. 103.15.22.4" value={manualIp} onChange={(e) => setManualIp(e.target.value)} className="form-input" style={{ width: '100%', marginTop: '4px' }} />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label className="form-label" style={{ fontSize: '12.5px', color: '#ffffff', fontWeight: 600 }}>Reason for Override</label>
                <textarea required rows={2} placeholder="e.g. Static IP assigned by ISP" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} className="form-input" style={{ width: '100%', marginTop: '4px', resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setOverrideModalOpen(false)} className="btn btn-secondary btn-sm">Cancel</button>
                <button type="submit" disabled={overrideSubmitting} className="btn btn-primary btn-sm">
                  {overrideSubmitting ? 'Saving...' : 'Register Override'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. GPS Recapture Modal */}
      {locationModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999999, backgroundColor: 'rgba(3, 7, 18, 0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '440px', padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#ffffff' }}>Re-capture GPS Location</h3>
              <button onClick={() => setLocationModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Ensure you are physically at the branch location before saving new GPS coordinates.
            </p>
            {capturingGps ? (
              <div style={{ padding: '24px', textAlign: 'center' }}>
                <Loader2 size={28} className="animate-spin" style={{ color: '#34d399', margin: '0 auto 8px auto' }} />
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Requesting device location...</div>
              </div>
            ) : newLat !== null ? (
              <div style={{ padding: '16px', backgroundColor: 'rgba(16, 185, 129, 0.08)', borderRadius: 'var(--radius-md)', marginBottom: '20px', fontSize: '13px', color: '#34d399' }}>
                ✓ Lat: {newLat.toFixed(6)}, Lng: {newLng?.toFixed(6)}
              </div>
            ) : null}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button type="button" onClick={() => setLocationModalOpen(false)} className="btn btn-secondary btn-sm">Cancel</button>
              <button type="button" onClick={handleSaveLocation} disabled={newLat === null || savingLocation} className="btn btn-primary btn-sm">
                {savingLocation ? 'Saving...' : 'Save Coordinates'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Navigation */}
      <OrgAdminMobileNav organizationCode={organizationCode} />
    </div>
  );
}
