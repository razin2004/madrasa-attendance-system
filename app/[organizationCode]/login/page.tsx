'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { TenantBrandHeader } from '@/components/branding/tenant-brand-header';
import { useToast } from '@/components/feedback/toast-provider';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  AlertCircle,
  KeyRound,
  MapPin,
  ShieldCheck,
  Navigation,
  Compass,
} from 'lucide-react';
import { getHighAccuracyLocation, getClientPublicIp } from '@/lib/client-location-ip';

interface OrganizationBranding {
  id: string;
  name: string;
  organizationCode: string;
  logoUrl: string | null;
  status: 'PENDING' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED';
  rejectionReason?: string | null;
}

export default function TenantLoginPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();

  const orgCode = (params.organizationCode as string)?.toUpperCase() || '';

  const [branding, setBranding] = useState<OrganizationBranding | null>(null);
  const [isLoadingBranding, setIsLoadingBranding] = useState(true);
  const [brandingError, setBrandingError] = useState<string | null>(null);

  // Geofence & Location State
  const [locationStatus, setLocationStatus] = useState<'IDLE' | 'LOCATING' | 'GRANTED' | 'DENIED'>('IDLE');
  const [locationDetails, setLocationDetails] = useState<{ lat?: number; lng?: number; accuracy?: number; ip?: string } | null>(null);
  const [locationErrorMessage, setLocationErrorMessage] = useState<string | null>(null);

  // Single Login Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Mandatory Password Change State (for Admins with temporary passwords)
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [pendingUser, setPendingUser] = useState<{ id: string; email: string; name: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Fetch Tenant Branding
  const loadBranding = useCallback(async () => {
    setIsLoadingBranding(true);
    setBrandingError(null);

    try {
      const res = await fetch(`/api/org/${orgCode}/branding`);
      const data = await res.json();

      if (res.ok && data.success) {
        setBranding(data.organization);
      } else {
        setBrandingError(data.error || `Organization "${orgCode}" not found.`);
      }
    } catch (err) {
      setBrandingError('Failed to connect to workspace server.');
    } finally {
      setIsLoadingBranding(false);
    }
  }, [orgCode]);

  // Request High Accuracy Geolocation & Detect Public IP
  const requestLocationPermission = useCallback(async () => {
    setLocationStatus('LOCATING');
    setLocationErrorMessage(null);

    try {
      const [loc, publicIp] = await Promise.all([
        getHighAccuracyLocation(),
        getClientPublicIp(),
      ]);

      setLocationDetails({
        lat: loc.latitude,
        lng: loc.longitude,
        accuracy: loc.accuracy,
        ip: publicIp || undefined,
      });
      setLocationStatus('GRANTED');
    } catch (err: any) {
      setLocationStatus('DENIED');
      setLocationErrorMessage(err.message || 'Location permission is required to detect branch geofence.');
    }
  }, []);

  useEffect(() => {
    if (orgCode) {
      loadBranding();
      requestLocationPermission();
    }
  }, [orgCode, loadBranding, requestLocationPermission]);

  // Handle Login Submit
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage('Please enter your account email address and password.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password, requestedOrgCode: orgCode }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        if (data.mustChangePassword) {
          setMustChangePassword(true);
          setPendingUser(data.user);
          toast.info('Please create a new permanent password to continue.');
        } else {
          toast.success(`Welcome, ${data.user?.name || 'User'}!`);
          router.push(data.redirectUrl || `/login`);
        }
      } else {
        setErrorMessage(data.error || 'These credentials cannot be used for this organization.');
        toast.error(data.error || 'Sign in failed.');
      }
    } catch (err) {
      setErrorMessage('Network connection error. Please try again.');
      toast.error('Network error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Forced Password Change Submit
  const handlePasswordChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!newPassword || newPassword.length < 8) {
      setErrorMessage('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('New passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/org/${orgCode}/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: pendingUser?.id,
          currentPassword: password,
          newPassword,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        toast.success('Password updated successfully! Welcome to your workspace.');
        router.push(data.redirectUrl || `/${orgCode}/admin`);
      } else {
        setErrorMessage(data.error || 'Failed to update password.');
        toast.error(data.error || 'Password update failed.');
      }
    } catch (err) {
      setErrorMessage('Network error during password update.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingBranding) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-secondary)' }}>
          <Loader2 size={24} className="animate-spin text-indigo-400" />
          <span>Resolving organization workspace...</span>
        </div>
      </div>
    );
  }

  if (brandingError || !branding) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div className="glass-card" style={{ maxWidth: '460px', padding: '40px 32px', textAlign: 'center' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'var(--danger-bg)',
              border: '1px solid var(--danger-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px auto',
            }}
          >
            <AlertCircle size={28} color="#fb7185" />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff', marginBottom: '8px' }}>
            Workspace Not Found
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '28px' }}>
            {brandingError || `The organization with code "${orgCode}" does not exist.`}
          </p>
          <Link href="/" className="btn btn-primary" style={{ width: '100%' }}>
            <span>Return to ShiftGuard Home</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
        backgroundColor: 'var(--bg-primary)',
      }}
    >
      <div style={{ width: '100%', maxWidth: '440px' }}>
        {/* Dynamic Organization Header */}
        <TenantBrandHeader
          orgName={branding.name}
          logoUrl={branding.logoUrl}
          organizationCode={branding.organizationCode}
          subtitle="Workforce Sign In"
        />

        {/* Status Warning if Not Active */}
        {branding.status !== 'ACTIVE' ? (
          <div className="glass-card" style={{ padding: '32px 24px', textAlign: 'center' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: branding.status === 'PENDING' ? 'var(--warning-bg)' : 'var(--danger-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
              }}
            >
              <AlertCircle size={24} color={branding.status === 'PENDING' ? '#fbbf24' : '#fb7185'} />
            </div>

            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>
              {branding.status === 'PENDING' ? 'Application Under Review' : 'Organization Inactive'}
            </h3>

            <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '24px' }}>
              {branding.status === 'PENDING'
                ? 'This organization registration has been submitted and is awaiting approval by the Super Admin. You will receive an email once approved.'
                : `This organization is currently ${branding.status.toLowerCase()}. Please contact ShiftGuard support.`}
            </p>

            <Link href="/" className="btn btn-secondary" style={{ width: '100%' }}>
              <span>Back to Home</span>
            </Link>
          </div>
        ) : (
          /* Active Login Form */
          <div className="glass-card" style={{ padding: '32px 28px' }}>
            {/* Location & Geofence Detection Card */}
            <div
              style={{
                padding: '14px 16px',
                borderRadius: '8px',
                backgroundColor:
                  locationStatus === 'GRANTED'
                    ? 'rgba(16, 185, 129, 0.1)'
                    : locationStatus === 'DENIED'
                    ? 'rgba(239, 68, 68, 0.1)'
                    : 'rgba(99, 102, 241, 0.1)',
                border:
                  locationStatus === 'GRANTED'
                    ? '1px solid rgba(16, 185, 129, 0.3)'
                    : locationStatus === 'DENIED'
                    ? '1px solid rgba(239, 68, 68, 0.3)'
                    : '1px solid rgba(99, 102, 241, 0.3)',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {locationStatus === 'LOCATING' && (
                  <Loader2 size={18} className="animate-spin text-indigo-400" />
                )}
                {locationStatus === 'GRANTED' && (
                  <MapPin size={18} color="#34d399" />
                )}
                {locationStatus === 'DENIED' && (
                  <AlertCircle size={18} color="#f87171" />
                )}
                {locationStatus === 'IDLE' && (
                  <Compass size={18} color="#818cf8" />
                )}

                <div>
                  <div
                    style={{
                      fontSize: '12.5px',
                      fontWeight: 700,
                      color:
                        locationStatus === 'GRANTED'
                          ? '#34d399'
                          : locationStatus === 'DENIED'
                          ? '#f87171'
                          : '#818cf8',
                    }}
                  >
                    {locationStatus === 'LOCATING' && 'Detecting Location & Geofence...'}
                    {locationStatus === 'GRANTED' &&
                      `GPS Location Verified`}
                    {locationStatus === 'DENIED' && 'Location Permission Required'}
                    {locationStatus === 'IDLE' && 'Location Detection Ready'}
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {locationStatus === 'GRANTED' &&
                      (locationDetails?.ip
                        ? `Public IP: ${locationDetails.ip}`
                        : 'High-accuracy GPS active for 3-layer attendance.')}
                    {locationStatus === 'DENIED' && (locationErrorMessage || 'Allow location access to verify attendance geofence.')}
                    {locationStatus === 'LOCATING' && 'Acquiring high-precision GPS coordinates...'}
                  </div>
                </div>
              </div>

              {locationStatus === 'DENIED' && (
                <button
                  type="button"
                  onClick={requestLocationPermission}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '11.5px', padding: '4px 10px', flexShrink: 0 }}
                >
                  Allow Location
                </button>
              )}
            </div>

            {errorMessage && (
              <div
                style={{
                  backgroundColor: 'var(--danger-bg)',
                  border: '1px solid var(--danger-border)',
                  color: 'var(--danger-text)',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  marginBottom: '20px',
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>{errorMessage}</div>
              </div>
            )}

            {!mustChangePassword ? (
              <form onSubmit={handleLoginSubmit} noValidate>
                {/* Email Field */}
                <div className="form-group">
                  <label className="form-label" htmlFor="email">
                    Email Address
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="email"
                      type="email"
                      placeholder="name@company.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setErrorMessage(null);
                      }}
                      disabled={isSubmitting}
                      className="form-input"
                      style={{ paddingLeft: '40px' }}
                      autoComplete="username"
                      required
                    />
                    <Mail
                      size={17}
                      color="var(--text-muted)"
                      style={{ position: 'absolute', left: '14px', top: '13px' }}
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label className="form-label" htmlFor="password" style={{ margin: 0 }}>
                      Password
                    </label>
                    <Link
                      href="/forgot-password"
                      style={{ fontSize: '12px', color: '#818cf8', fontWeight: 600, textDecoration: 'none' }}
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setErrorMessage(null);
                      }}
                      disabled={isSubmitting}
                      className="form-input"
                      style={{ paddingLeft: '40px', paddingRight: '40px' }}
                      autoComplete="current-password"
                      required
                    />
                    <Lock
                      size={17}
                      color="var(--text-muted)"
                      style={{ position: 'absolute', left: '14px', top: '13px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '12px',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '2px',
                      }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '12px', marginTop: '8px' }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In to {orgCode ? orgCode.toUpperCase() : 'Workspace'}</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* MANDATORY PASSWORD CHANGE FORM */
              <form onSubmit={handlePasswordChangeSubmit} noValidate>
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(245, 158, 11, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 12px auto',
                      color: '#fbbf24',
                    }}
                  >
                    <KeyRound size={20} />
                  </div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>
                    First-Time Security Setup
                  </h3>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Please update your temporary password to a permanent secure password.
                  </p>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="newPassword">
                    New Permanent Password (Min. 8 characters)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="newPassword"
                      type={showNewPassword ? 'text' : 'password'}
                      placeholder="••••••••••••"
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        setErrorMessage(null);
                      }}
                      disabled={isSubmitting}
                      className="form-input"
                      style={{ paddingLeft: '40px', paddingRight: '40px' }}
                      autoComplete="new-password"
                      required
                    />
                    <Lock
                      size={17}
                      color="var(--text-muted)"
                      style={{ position: 'absolute', left: '14px', top: '13px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      tabIndex={-1}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '12px',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '2px',
                      }}
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="confirmPassword">
                    Confirm New Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="confirmPassword"
                      type={showNewPassword ? 'text' : 'password'}
                      placeholder="••••••••••••"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setErrorMessage(null);
                      }}
                      disabled={isSubmitting}
                      className="form-input"
                      style={{ paddingLeft: '40px' }}
                      autoComplete="new-password"
                      required
                    />
                    <Lock
                      size={17}
                      color="var(--text-muted)"
                      style={{ position: 'absolute', left: '14px', top: '13px' }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !newPassword || !confirmPassword}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '12px', marginTop: '8px' }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Updating Security Credentials...</span>
                    </>
                  ) : (
                    <>
                      <span>Set Permanent Password &amp; Enter</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>
            )}

            <div
              style={{
                textAlign: 'center',
                marginTop: '24px',
                paddingTop: '16px',
                borderTop: '1px solid var(--border-subtle)',
                fontSize: '12.5px',
                color: 'var(--text-muted)',
              }}
            >
              Not your organization?{' '}
              <Link href="/" style={{ color: '#818cf8', fontWeight: 600 }}>
                ShiftGuard Home &rarr;
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
