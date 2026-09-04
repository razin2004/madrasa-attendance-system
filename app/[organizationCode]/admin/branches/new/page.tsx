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
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Info,
  Building,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { OrgAdminSidebar } from '../../../../../components/layout/org-admin-sidebar';
import { OrgAdminMobileNav } from '../../../../../components/layout/org-admin-mobile-nav';
import { useToast } from '../../../../../components/feedback/toast-provider';
import { getClientPublicIp } from '../../../../../lib/client-location-ip';
import styles from './BranchCreate.module.css';

interface OrgBranding {
  id: string;
  name: string;
  logoUrl: string | null;
  organizationCode: string;
}

export default function RegisterBranchPage() {
  const params = useParams();
  const organizationCode = (params.organizationCode as string)?.toUpperCase() || '';
  const router = useRouter();
  const toast = useToast();

  const [branding, setBranding] = useState<OrgBranding | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [geofenceRadius, setGeofenceRadius] = useState('150');

  // Network State
  const [detectedIp, setDetectedIp] = useState<string | null>(null);
  const [ipLoading, setIpLoading] = useState(true);

  // Location State
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [locationCapturing, setLocationCapturing] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (organizationCode) {
      fetchBranding();
      fetchDetectedIp();
    }
  }, [organizationCode]);

  const fetchBranding = async () => {
    try {
      const res = await fetch(`/api/org/${organizationCode}/branding`);
      const data = await res.json();
      if (data.success) {
        setBranding(data.organization);
      }
    } catch {}
  };

  const fetchDetectedIp = async () => {
    try {
      setIpLoading(true);
      const clientIp = await getClientPublicIp();
      const headers: Record<string, string> = {};
      if (clientIp) headers['x-client-public-ip'] = clientIp;

      const res = await fetch(`/api/org/${organizationCode}/network-ip`, { headers });
      const data = await res.json();
      if (data.success) {
        setDetectedIp(data.detectedIp);
      } else {
        toast.error('Unable to detect the branch network.');
      }
    } catch {
      toast.error('Network error detecting public IP.');
    } finally {
      setIpLoading(false);
    }
  };

  const handleCaptureLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Browser Geolocation is not supported on this device.');
      return;
    }

    setLocationCapturing(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude);
        setLongitude(position.coords.longitude);
        setAccuracy(position.coords.accuracy ? Math.round(position.coords.accuracy) : null);
        setLocationCapturing(false);
        toast.success('Current physical location captured successfully.');
      },
      (error) => {
        setLocationCapturing(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError(
              'Location permission is required. ShiftGuard needs your current location to register this branch. Allow location access in your browser and try again.'
            );
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError('Location information is unavailable. Please ensure GPS/Location services are enabled on your device.');
            break;
          case error.TIMEOUT:
            setLocationError('Location request timed out. Please try capturing again.');
            break;
          default:
            setLocationError('An unknown error occurred while capturing location.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Branch name is required.');
      return;
    }

    if (!address.trim()) {
      toast.error('Branch physical address is required.');
      return;
    }

    if (latitude === null || longitude === null) {
      toast.error('Location access is required. Please capture GPS coordinates before registering.');
      return;
    }

    const radius = parseInt(geofenceRadius, 10);
    if (isNaN(radius) || radius < 20 || radius > 5000) {
      toast.error('Geofence radius must be between 20 and 5000 meters.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`/api/org/${organizationCode}/branches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          address: address.trim(),
          latitude,
          longitude,
          locationAccuracyMeters: accuracy,
          geofenceRadiusMeters: radius,
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(data.message || 'Branch registered successfully.');
        router.push(`/${organizationCode}/admin/branches`);
      } else {
        toast.error(data.error || 'Failed to register branch.');
      }
    } catch (err) {
      toast.error('Network error submitting branch registration.');
    } finally {
      setSubmitting(false);
    }
  };

  const hasName = Boolean(name.trim());
  const hasAddress = Boolean(address.trim());
  const hasLocation = latitude !== null && longitude !== null;

  return (
    <div className={styles.container}>
      {/* Sidebar */}
      <OrgAdminSidebar
        organizationCode={organizationCode}
        organizationName={branding?.name || 'Organization'}
        logoUrl={branding?.logoUrl}
      />

      {/* Main Content Area */}
      <div className={styles.mainContent}>
        {/* Top Header */}
        <header className={styles.headerBar}>
          <Link href={`/${organizationCode}/admin/branches`} className="btn btn-secondary btn-sm" style={{ padding: '8px' }}>
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className={styles.title}>Register Branch</h1>
            <p className={styles.subtitle}>
              Register this branch&apos;s network and location so ShiftGuard can verify attendance at this location.
            </p>
          </div>
        </header>

        {/* Content Body */}
        <main className="pageMainContent" style={{ maxWidth: '1280px' }}>
          <form onSubmit={handleSubmit} className={styles.formGrid}>
            {/* Form Inputs Area */}
            <div>
              {/* 1. Branch Information */}
              <div className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                  <Building size={18} color="#818cf8" />
                  <h3 className={styles.sectionTitle}>Branch Information</h3>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label className="form-label" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
                      Branch Name <span style={{ color: 'var(--danger-text)' }}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Head Office, Warehouse, or Calicut Branch"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="form-input"
                      style={{ width: '100%' }}
                    />
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Use a recognizable name such as Head Office, Warehouse, or Calicut Branch.
                    </p>
                  </div>

                  <div>
                    <label className="form-label" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
                      Physical Address <span style={{ color: 'var(--danger-text)' }}>*</span>
                    </label>
                    <textarea
                      required
                      rows={2}
                      placeholder="e.g. Building 4B, Cyberpark Campus, Kozhikode"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="form-input"
                      style={{ width: '100%', resize: 'vertical' }}
                    />
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Complete street address of the physical workplace.
                    </p>
                  </div>
                </div>
              </div>

              {/* 2. Network / IP Section */}
              <div className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                  <Network size={18} color="#38bdf8" />
                  <h3 className={styles.sectionTitle}>Network Security (Layer 1)</h3>
                </div>

                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.5' }}>
                  Connect this device to the branch Wi-Fi before registering the network. ShiftGuard automatically detects your public IP.
                </p>

                <div className={styles.detectionBox}>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Detected Public IP
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: detectedIp ? '#38bdf8' : 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                      {ipLoading ? (
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <Loader2 size={14} className="animate-spin" /> Detecting network IP...
                        </span>
                      ) : (
                        detectedIp || 'Unable to detect IP'
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={fetchDetectedIp}
                    disabled={ipLoading}
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <RefreshCw size={14} className={ipLoading ? 'animate-spin' : ''} />
                    <span>Retry Detection</span>
                  </button>
                </div>
              </div>

              {/* 3. Location / GPS Section */}
              <div className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                  <Navigation size={18} color="#34d399" />
                  <h3 className={styles.sectionTitle}>GPS Geofence Coordinates (Layer 2)</h3>
                </div>

                <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.5' }}>
                  Allow location access while physically at the branch. ShiftGuard captures exact GPS coordinates to establish the attendance perimeter.
                </p>

                {locationError && (
                  <div
                    style={{
                      padding: '14px 16px',
                      backgroundColor: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: 'var(--radius-md)',
                      marginBottom: '16px',
                      fontSize: '13px',
                      color: '#f87171',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                    }}
                  >
                    <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
                    <div>
                      <div style={{ fontWeight: 700 }}>Location permission is required</div>
                      <div style={{ marginTop: '2px', color: 'var(--text-secondary)' }}>{locationError}</div>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={handleCaptureLocation}
                    disabled={locationCapturing}
                    className="btn btn-primary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                  >
                    {locationCapturing ? <Loader2 size={16} className="animate-spin" /> : <Navigation size={16} />}
                    <span>{hasLocation ? 'Re-capture GPS Location' : 'Capture Current Physical Location'}</span>
                  </button>

                  {hasLocation && (
                    <div style={{ fontSize: '13px', color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle2 size={16} />
                      <span>
                        Lat: {latitude?.toFixed(6)}, Lng: {longitude?.toFixed(6)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* 4. Geofence Radius */}
              <div className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                  <MapPin size={18} color="#c084fc" />
                  <h3 className={styles.sectionTitle}>Geofence Perimeter Radius</h3>
                </div>

                <div>
                  <label className="form-label" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
                    Geofence Radius (meters) <span style={{ color: 'var(--danger-text)' }}>*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={20}
                    max={5000}
                    value={geofenceRadius}
                    onChange={(e) => setGeofenceRadius(e.target.value)}
                    className="form-input"
                    style={{ width: '100%', maxWidth: '240px' }}
                  />
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                    Staff must be within this distance (default 150m) of the registered branch location to verify attendance.
                  </p>
                </div>
              </div>
            </div>

            {/* Sidebar Security Pre-Registration Checklist */}
            <div className={styles.checklistCard}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff', marginBottom: '16px' }}>
                Pre-Registration Summary
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
                  <CheckCircle2 size={16} color={hasName ? '#34d399' : 'var(--text-muted)'} />
                  <span style={{ color: hasName ? '#ffffff' : 'var(--text-muted)' }}>Branch Name entered</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
                  <CheckCircle2 size={16} color={hasAddress ? '#34d399' : 'var(--text-muted)'} />
                  <span style={{ color: hasAddress ? '#ffffff' : 'var(--text-muted)' }}>Address specified</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
                  <CheckCircle2 size={16} color={detectedIp ? '#38bdf8' : 'var(--text-muted)'} />
                  <span style={{ color: detectedIp ? '#ffffff' : 'var(--text-muted)' }}>
                    {detectedIp ? 'Public IP detected' : 'Public IP pending'}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
                  <CheckCircle2 size={16} color={hasLocation ? '#34d399' : 'var(--text-muted)'} />
                  <span style={{ color: hasLocation ? '#ffffff' : 'var(--text-muted)' }}>
                    {hasLocation ? 'GPS coordinates captured' : 'GPS location required'}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
                  <CheckCircle2 size={16} color="#c084fc" />
                  <span style={{ color: '#ffffff' }}>Geofence: {geofenceRadius || '150'}m radius</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || !hasName || !hasAddress || !hasLocation}
                className="btn btn-primary"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Registering Branch...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} />
                    <span>Register Branch</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </main>
      </div>

      {/* Mobile Navigation */}
      <OrgAdminMobileNav organizationCode={organizationCode} />
    </div>
  );
}
