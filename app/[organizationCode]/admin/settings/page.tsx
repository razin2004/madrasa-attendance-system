'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import {
  Settings,
  Building2,
  Phone,
  User,
  Mail,
  Save,
  Loader2,
  Lock,
  Upload,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  X,
  Compass,
  Clock,
  HelpCircle,
} from 'lucide-react';
import { OrgAdminSidebar } from '@/components/layout/org-admin-sidebar';
import { OrgAdminMobileNav } from '@/components/layout/org-admin-mobile-nav';
import { useToast } from '@/components/feedback/toast-provider';
import { OrgLogo } from '@/components/branding/org-logo';

export default function AdminSettingsPage() {
  const params = useParams();
  const organizationCode = (params.organizationCode as string)?.toUpperCase() || '';
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [orgData, setOrgData] = useState<any>(null);

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [contactPersonName, setContactPersonName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  
  // Default Settings State
  const [attendanceCorrectionWindowDays, setAttendanceCorrectionWindowDays] = useState(5);
  const [defaultGeofenceRadius, setDefaultGeofenceRadius] = useState(100);
  const [defaultMaxDailyCycles, setDefaultMaxDailyCycles] = useState(1);

  // Dual Email Change OTP Modal State
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [oldEmailOtp, setOldEmailOtp] = useState('');
  const [newEmailOtp, setNewEmailOtp] = useState('');
  const [otpStep, setOtpStep] = useState<'ENTER_NEW_EMAIL' | 'VERIFY_OTP'>('ENTER_NEW_EMAIL');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, [organizationCode]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/org/${organizationCode}/settings`);
      const data = await res.json();
      if (res.ok && data.success) {
        setOrgData(data.settings);
        setName(data.settings.name || '');
        setPhone(data.settings.phone || '');
        setContactPersonName(data.settings.contactPersonName || '');
        setContactEmail(data.settings.contactEmail || '');
        setLogoUrl(data.settings.logoUrl || '');
        setAttendanceCorrectionWindowDays(data.settings.attendanceCorrectionWindowDays || 5);
      } else {
        toast.error(data.error || 'Failed to load organization settings.');
      }
    } catch {
      toast.error('Network error loading settings.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Logo Upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('File size exceeds 2MB limit.');
      return;
    }

    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/org/${organizationCode}/settings/logo`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setLogoUrl(data.logoUrl);
        setOrgData((prev: any) => ({ ...prev, logoUrl: data.logoUrl }));
        toast.success('Organization logo uploaded and updated!');
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        toast.error(data.error || 'Failed to upload logo image.');
      }
    } catch {
      toast.error('Network error uploading logo.');
    } finally {
      setUploadingLogo(false);
    }
  };

  // Handle Save Settings
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch(`/api/org/${organizationCode}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, // Organization Name (readOnly in UI, sent unchanged)
          phone,
          contactPersonName,
          contactEmail, // Will be changed via OTP modal below
          logoUrl,
          attendanceCorrectionWindowDays: Number(attendanceCorrectionWindowDays),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Workspace settings updated successfully.');
        setOrgData(data.settings);
      } else {
        toast.error(data.error || 'Failed to save settings.');
      }
    } catch {
      toast.error('Network error saving settings.');
    } finally {
      setSaving(false);
    }
  };

  // Request Email Change OTP
  const handleRequestEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!newEmail.trim() || !newEmail.includes('@')) {
      setModalError('Please enter a valid email address.');
      return;
    }

    if (newEmail.trim().toLowerCase() === contactEmail.trim().toLowerCase()) {
      setModalError('New email address must be different from current email.');
      return;
    }

    setIsSendingOtp(true);
    try {
      const res = await fetch(`/api/org/${organizationCode}/settings/email-change/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail: newEmail.trim() }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.info(`OTP verification code sent to ${newEmail.trim()}. Notice sent to current email.`);
        setOtpStep('VERIFY_OTP');
      } else {
        setModalError(data.error || 'Failed to send verification OTP.');
      }
    } catch {
      setModalError('Network error requesting OTP.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Verify Dual OTPs and Complete Email Change
  const handleVerifyEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!oldEmailOtp || oldEmailOtp.trim().length !== 6) {
      setModalError('Please enter the 6-digit authorization code sent to your CURRENT email.');
      return;
    }

    if (!newEmailOtp || newEmailOtp.trim().length !== 6) {
      setModalError('Please enter the 6-digit verification code sent to your NEW email.');
      return;
    }

    setIsVerifyingOtp(true);
    try {
      const res = await fetch(`/api/org/${organizationCode}/settings/email-change/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldEmailOtp: oldEmailOtp.trim(),
          newEmailOtp: newEmailOtp.trim(),
          newEmail: newEmail.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || 'Contact email updated successfully!');
        setContactEmail(newEmail.trim());
        setShowEmailModal(false);
        setOtpStep('ENTER_NEW_EMAIL');
        setOldEmailOtp('');
        setNewEmailOtp('');
        setNewEmail('');
        fetchSettings();
      } else {
        setModalError(data.error || 'Invalid or expired OTP verification code.');
      }
    } catch {
      setModalError('Network error verifying OTPs.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0b0f19' }}>
      <OrgAdminSidebar
        organizationCode={organizationCode}
        organizationName={orgData?.name || name || 'ShiftGuard'}
        logoUrl={logoUrl || orgData?.logoUrl}
      />

      <div style={{ flex: 1, padding: '24px 32px 80px 32px', maxWidth: '1000px' }}>
        {/* Header */}
        <div style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <Settings size={24} color="#818cf8" />
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
              Organization Workspace Settings
            </h1>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
            Manage default workspace rules, update organization logo, and update administrative profiles.
          </p>
        </div>

        {loading ? (
          <div className="glass-card" style={{ padding: '60px 24px', textAlign: 'center' }}>
            <Loader2 size={32} className="animate-spin" style={{ color: '#818cf8', margin: '0 auto 12px auto' }} />
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Loading settings...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* BRANDING LOGO & IDENTITY CARD */}
            <div className="glass-card" style={{ padding: '28px', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building2 size={18} color="#38bdf8" />
                <span>Organization Identity &amp; Logo</span>
              </h2>

              {/* Logo Preview & Uploader Box */}
              <div style={{ display: 'flex', gap: '24px', alignItems: 'center', marginBottom: '24px', padding: '20px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border-subtle)', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '16px', backgroundColor: '#0d121f', border: '2px solid var(--border-medium)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
                  <OrgLogo logoUrl={logoUrl} name={name || 'Organization Logo'} size={36} />
                  {uploadingLogo && (
                    <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Loader2 size={24} className="animate-spin text-indigo-400" />
                    </div>
                  )}
                </div>

                <div style={{ flex: 1, minWidth: '220px' }}>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff' }}>{name || 'Organization Name'}</div>
                  <div style={{ fontSize: '12px', color: '#38bdf8', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                    Workspace Code: {organizationCode}
                  </div>

                  <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/png, image/jpeg, image/webp, image/svg+xml"
                      style={{ display: 'none' }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingLogo}
                      className="btn btn-secondary btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px' }}
                    >
                      <Upload size={14} />
                      <span>{logoUrl ? 'Change Logo Image' : 'Upload Logo Image'}</span>
                    </button>
                    {logoUrl && (
                      <span style={{ fontSize: '11.5px', color: '#34d399', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle2 size={13} /> Logo Uploaded
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                    Supported formats: PNG, JPG, WEBP, SVG (Max 2MB).
                  </div>
                </div>
              </div>

              {/* READONLY ORGANIZATION NAME */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label className="form-label" style={{ margin: 0 }}>
                    Organization Name (Read-Only)
                  </label>
                  <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10.5px' }}>
                    <Lock size={11} /> Locked after approval
                  </span>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="form-input"
                    value={name}
                    readOnly
                    disabled
                    style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', color: 'var(--text-muted)', cursor: 'not-allowed', paddingRight: '40px' }}
                  />
                  <Lock size={16} color="var(--text-muted)" style={{ position: 'absolute', right: '14px', top: '12px' }} />
                </div>
              </div>
            </div>

            {/* DEFAULT WORKSPACE SETTINGS */}
            <div className="glass-card" style={{ padding: '28px', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Compass size={18} color="#c084fc" />
                <span>Default Workspace Rules &amp; Limits</span>
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
                <div className="form-group">
                  <label className="form-label">Default Geofence Radius (Meters)</label>
                  <input
                    type="number"
                    min={20}
                    max={1000}
                    className="form-input"
                    value={defaultGeofenceRadius}
                    onChange={(e) => setDefaultGeofenceRadius(Number(e.target.value))}
                  />
                  <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Default allowed GPS distance perimeter for branch clock-in verification.
                  </p>
                </div>

                <div className="form-group">
                  <label className="form-label">Daily Attendance Cycle Limit</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    className="form-input"
                    value={defaultMaxDailyCycles}
                    onChange={(e) => setDefaultMaxDailyCycles(Number(e.target.value))}
                  />
                  <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    1 Cycle = 1 Clock In &amp; 1 Clock Out session per workday.
                  </p>
                </div>

                <div className="form-group">
                  <label className="form-label">Attendance Correction Request Window (Days)</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    className="form-input"
                    value={attendanceCorrectionWindowDays}
                    onChange={(e) => setAttendanceCorrectionWindowDays(Number(e.target.value))}
                  />
                  <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Staff can request attendance correction up to this many days after punch date.
                  </p>
                </div>
              </div>
            </div>

            {/* CONTACT & ADMINISTRATIVE PROFILE */}
            <div className="glass-card" style={{ padding: '28px', marginBottom: '28px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <User size={18} color="#34d399" />
                <span>Contact Profiles &amp; Administrative Email</span>
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="form-group">
                  <label className="form-label">Contact Person Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={contactPersonName}
                    onChange={(e) => setContactPersonName(e.target.value)}
                    placeholder="Administrator full name"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Contact Phone</label>
                  <input
                    type="text"
                    className="form-input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 555-0199"
                  />
                </div>
              </div>

              {/* CONTACT EMAIL WITH DUAL OTP VERIFICATION TRIGGER */}
              <div className="form-group" style={{ marginBottom: 0, marginTop: '10px' }}>
                <label className="form-label">Official Contact Email</label>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <input
                    type="email"
                    className="form-input"
                    value={contactEmail}
                    readOnly
                    disabled
                    style={{ flex: 1, backgroundColor: 'rgba(255, 255, 255, 0.03)', color: '#ffffff' }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setNewEmail('');
                      setOldEmailOtp('');
                      setNewEmailOtp('');
                      setModalError(null);
                      setOtpStep('ENTER_NEW_EMAIL');
                      setShowEmailModal(true);
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                  >
                    <Mail size={14} />
                    <span>Change Email (Dual OTP)</span>
                  </button>
                </div>
                <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '6px' }}>
                  Security policy: Verification codes will be sent to BOTH your current email and new email. Both OTPs are required to complete the change.
                </p>
              </div>
            </div>

            {/* Submit Action */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                disabled={saving}
                className="btn btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 24px' }}
              >
                {saving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Saving Settings...</span>
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    <span>Save Workspace Settings</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* DUAL-OTP EMAIL CHANGE VERIFICATION MODAL */}
      {showEmailModal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 999999, backgroundColor: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '480px', padding: '28px', backgroundColor: '#0d121f' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <KeyRound size={22} color="#38bdf8" />
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                  {otpStep === 'ENTER_NEW_EMAIL' ? 'Change Contact Email' : 'Verify Dual Email OTPs'}
                </h3>
              </div>
              <button onClick={() => setShowEmailModal(false)} className="btn btn-ghost btn-sm" style={{ padding: '4px' }}>
                <X size={18} />
              </button>
            </div>

            {modalError && (
              <div style={{ backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger-text)', padding: '10px 14px', borderRadius: '8px', fontSize: '12.5px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={16} />
                <span>{modalError}</span>
              </div>
            )}

            {otpStep === 'ENTER_NEW_EMAIL' ? (
              <form onSubmit={handleRequestEmailChange}>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                  Current Email: <strong style={{ color: '#ffffff' }}>{contactEmail}</strong><br />
                  Enter your new contact email below. Security OTP verification codes will be sent to <strong>BOTH</strong> addresses.
                </p>

                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label className="form-label">New Official Email Address *</label>
                  <input
                    type="email"
                    className="form-input"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="newemail@organization.com"
                    required
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button type="button" onClick={() => setShowEmailModal(false)} className="btn btn-secondary btn-sm">
                    Cancel
                  </button>
                  <button type="submit" disabled={isSendingOtp} className="btn btn-primary btn-sm">
                    {isSendingOtp ? 'Sending OTPs...' : 'Send Verification Codes'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyEmailChange}>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                  Verification codes have been dispatched to both email addresses. Please enter both 6-digit codes below:
                </p>

                {/* CURRENT EMAIL OTP CODE INPUT */}
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>1. Current Email Code *</span>
                    <span style={{ fontSize: '11px', color: '#fbbf24' }}>Sent to: {contactEmail}</span>
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    className="form-input"
                    style={{ textAlign: 'center', letterSpacing: '6px', fontSize: '18px', fontWeight: 800, color: '#fbbf24' }}
                    value={oldEmailOtp}
                    onChange={(e) => setOldEmailOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    required
                  />
                </div>

                {/* NEW EMAIL OTP CODE INPUT */}
                <div className="form-group" style={{ marginBottom: '24px' }}>
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>2. New Email Code *</span>
                    <span style={{ fontSize: '11px', color: '#38bdf8' }}>Sent to: {newEmail}</span>
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    className="form-input"
                    style={{ textAlign: 'center', letterSpacing: '6px', fontSize: '18px', fontWeight: 800, color: '#38bdf8' }}
                    value={newEmailOtp}
                    onChange={(e) => setNewEmailOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="654321"
                    required
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setOtpStep('ENTER_NEW_EMAIL')}
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: '12px', color: '#818cf8' }}
                  >
                    &larr; Back
                  </button>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button type="button" onClick={() => setShowEmailModal(false)} className="btn btn-secondary btn-sm">
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isVerifyingOtp || oldEmailOtp.length !== 6 || newEmailOtp.length !== 6}
                      className="btn btn-success btn-sm"
                    >
                      {isVerifyingOtp ? 'Verifying...' : 'Verify Both Codes & Update'}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <OrgAdminMobileNav organizationCode={organizationCode} />
    </div>
  );
}
