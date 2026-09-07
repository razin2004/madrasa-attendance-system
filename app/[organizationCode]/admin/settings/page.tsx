'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Settings,
  Building2,
  Phone,
  User,
  Mail,
  Save,
  Loader2,
  Lock,
  Unlock,
  Edit2,
  Upload,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  KeyRound,
  X,
  Compass,
  Clock,
  HelpCircle,
  Menu,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from 'lucide-react';
import { OrgAdminSidebar } from '@/components/layout/org-admin-sidebar';
import { OrgAdminMobileNav } from '@/components/layout/org-admin-mobile-nav';
import { useToast } from '@/components/feedback/toast-provider';
import { OrgLogo } from '@/components/branding/org-logo';
import styles from './AdminSettings.module.css';

import { OrgAdminHeader } from '@/components/layout/org-admin-header';

export default function AdminSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const organizationCode = (params.organizationCode as string)?.toUpperCase() || '';
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const headerMenuRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [orgData, setOrgData] = useState<any>(null);

  // Mobile Accordion State
  const [openSections, setOpenSections] = useState<{ [key: string]: boolean }>({
    identity: true,
    rules: true,
    contact: true,
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Section Read-Only / Editing States (Default: ALL LOCKED / READ-ONLY)
  const [editingSections, setEditingSections] = useState<{ [key: string]: boolean }>({
    identity: false,
    rules: false,
    contact: false,
  });

  const toggleEditSection = (key: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

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

  // Baseline Initial Data for Unsaved Changes tracking
  const [initialSettings, setInitialSettings] = useState<any>(null);

  // Unsaved Changes Navigation Modal State
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Dual Email Change OTP Modal State
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [oldEmailOtp, setOldEmailOtp] = useState('');
  const [newEmailOtp, setNewEmailOtp] = useState('');
  const [otpStep, setOtpStep] = useState<'ENTER_NEW_EMAIL' | 'VERIFY_OTP'>('ENTER_NEW_EMAIL');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);

  // Calculate dirty state
  const isDirty =
    initialSettings !== null &&
    (phone !== (initialSettings.phone || '') ||
      contactPersonName !== (initialSettings.contactPersonName || '') ||
      logoUrl !== (initialSettings.logoUrl || '') ||
      Number(attendanceCorrectionWindowDays) !== Number(initialSettings.attendanceCorrectionWindowDays || 5) ||
      Number(defaultGeofenceRadius) !== Number(initialSettings.defaultGeofenceRadius || 100) ||
      Number(defaultMaxDailyCycles) !== Number(initialSettings.defaultMaxDailyCycles || 1));

  // Header Menu Click Outside Dismissal
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(event.target as Node)) {
        setHeaderMenuOpen(false);
      }
    };
    if (headerMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [headerMenuOpen]);

  // Intercept anchor link navigation when form is dirty
  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      if (!isDirty) return;

      const target = e.target as HTMLElement;
      const anchor = target.closest('a');

      if (anchor && anchor.href) {
        const targetUrl = anchor.href;
        const currentUrl = window.location.href;

        if (targetUrl !== currentUrl && anchor.target !== '_blank') {
          e.preventDefault();
          e.stopPropagation();
          const hrefAttr = anchor.getAttribute('href');
          setPendingAction(() => () => {
            if (hrefAttr) {
              router.push(hrefAttr);
            } else {
              window.location.href = targetUrl;
            }
          });
          setShowUnsavedModal(true);
        }
      }
    };

    document.addEventListener('click', handleAnchorClick, true);
    return () => {
      document.removeEventListener('click', handleAnchorClick, true);
    };
  }, [isDirty, router]);

  // Window BeforeUnload Listener for Unsaved Changes (browser reload/close)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);

  useEffect(() => {
    fetchSettings();
  }, [organizationCode]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/org/${organizationCode}/settings`);
      const data = await res.json();
      if (res.ok && data.success) {
        const s = data.settings;
        setOrgData(s);
        setName(s.name || '');
        setPhone(s.phone || '');
        setContactPersonName(s.contactPersonName || '');
        setContactEmail(s.contactEmail || '');
        setLogoUrl(s.logoUrl || '');
        setAttendanceCorrectionWindowDays(s.attendanceCorrectionWindowDays || 5);
        setDefaultGeofenceRadius(100);
        setDefaultMaxDailyCycles(1);

        setInitialSettings({
          name: s.name || '',
          phone: s.phone || '',
          contactPersonName: s.contactPersonName || '',
          contactEmail: s.contactEmail || '',
          logoUrl: s.logoUrl || '',
          attendanceCorrectionWindowDays: s.attendanceCorrectionWindowDays || 5,
          defaultGeofenceRadius: 100,
          defaultMaxDailyCycles: 1,
        });

        // Ensure default state is locked/read-only
        setEditingSections({ identity: false, rules: false, contact: false });
      } else {
        toast.error(data.error || 'Failed to load organization settings.');
      }
    } catch {
      toast.error('Network error loading settings.');
    } finally {
      setLoading(false);
    }
  };

  // Revert form state back to initial baseline
  const handleDiscardChanges = () => {
    if (!initialSettings) return;
    setPhone(initialSettings.phone || '');
    setContactPersonName(initialSettings.contactPersonName || '');
    setLogoUrl(initialSettings.logoUrl || '');
    setAttendanceCorrectionWindowDays(initialSettings.attendanceCorrectionWindowDays || 5);
    setDefaultGeofenceRadius(initialSettings.defaultGeofenceRadius || 100);
    setDefaultMaxDailyCycles(initialSettings.defaultMaxDailyCycles || 1);
    setEditingSections({ identity: false, rules: false, contact: false });
    setShowUnsavedModal(false);
    toast.info('Form changes discarded and restored to last saved state.');
    if (pendingAction) {
      const action = pendingAction;
      setPendingAction(null);
      action();
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
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch(`/api/org/${organizationCode}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          contactPersonName,
          contactEmail,
          logoUrl,
          attendanceCorrectionWindowDays: Number(attendanceCorrectionWindowDays),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Workspace settings updated successfully.');
        setOrgData(data.settings);
        setInitialSettings({
          name,
          phone,
          contactPersonName,
          contactEmail,
          logoUrl,
          attendanceCorrectionWindowDays: Number(attendanceCorrectionWindowDays),
          defaultGeofenceRadius: Number(defaultGeofenceRadius),
          defaultMaxDailyCycles: Number(defaultMaxDailyCycles),
        });
        // Lock all sections upon saving
        setEditingSections({ identity: false, rules: false, contact: false });
        if (pendingAction) {
          pendingAction();
          setPendingAction(null);
        }
        setShowUnsavedModal(false);
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
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-primary, #030712)', color: 'var(--text-primary, #f9fafb)' }}>
      <OrgAdminSidebar
        organizationCode={organizationCode}
        organizationName={orgData?.name || name || 'ShiftGuard'}
        logoUrl={logoUrl || orgData?.logoUrl}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, paddingBottom: '80px' }}>
        {/* Sticky Mobile Header */}
        <OrgAdminHeader
          organizationCode={organizationCode}
          logoUrl={logoUrl || orgData?.logoUrl}
          panelTitle="Workspace Settings"
          panelSubtitle="Manage default workspace rules, update organization logo, and administrative profiles."
          headerMenuOpen={headerMenuOpen}
          onToggleHeaderMenu={() => setHeaderMenuOpen(!headerMenuOpen)}
        >
          {headerMenuOpen && (
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
              <button
                type="button"
                onClick={() => {
                  setHeaderMenuOpen(false);
                  if (isDirty) {
                    setPendingAction(() => () => fetchSettings());
                    setShowUnsavedModal(true);
                  } else {
                    fetchSettings();
                  }
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
                <span>Refresh Settings</span>
              </button>
            </div>
          )}
        </OrgAdminHeader>

        <main className="pageMainContent" style={{ maxWidth: '1000px', padding: '0 16px' }}>
          {loading ? (
            <div className="glass-card" style={{ padding: '60px 24px', textAlign: 'center' }}>
              <Loader2 size={32} className="animate-spin" style={{ color: '#818cf8', margin: '0 auto 12px auto' }} />
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Loading settings...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {/* BRANDING LOGO & IDENTITY CARD */}
              <div className={styles.sectionCard}>
                <div className={styles.sectionHeader} onClick={() => toggleSection('identity')}>
                  <div className={styles.sectionHeaderTitleWrapper}>
                    <div className={styles.sectionHeaderTitleRow}>
                      <Building2 size={18} color="#38bdf8" style={{ flexShrink: 0 }} />
                      <span className={styles.sectionHeaderTitleText}>Organization Identity &amp; Logo</span>
                    </div>
                    <div className={styles.sectionHeaderBadgeRow}>
                      {editingSections.identity ? (
                        <span className="badge badge-primary" style={{ fontSize: '10.5px', padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Unlock size={11} /> Editing Mode
                        </span>
                      ) : (
                        <span className="badge badge-secondary" style={{ fontSize: '10.5px', padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Lock size={11} /> Read-Only
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={(e) => toggleEditSection('identity', e)}
                      className={`btn btn-sm ${editingSections.identity ? 'btn-secondary' : 'btn-primary'} ${styles.sectionEditBtn}`}
                      title={editingSections.identity ? 'Lock Section' : 'Edit Section'}
                    >
                      {editingSections.identity ? (
                        <>
                          <Lock size={13} />
                          <span>Lock Section</span>
                        </>
                      ) : (
                        <>
                          <Edit2 size={13} />
                          <span>Edit Section</span>
                        </>
                      )}
                    </button>
                    <div className={styles.accordionChevron}>
                      {openSections.identity ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </div>
                </div>

                <div className={`${styles.sectionBody} ${!openSections.identity ? styles.sectionBodyHidden : ''}`}>
                  {/* Logo Preview & Uploader Box */}
                  <div className={styles.logoUploaderBox}>
                    <div className={styles.logoPreview}>
                      <OrgLogo logoUrl={logoUrl} name={name || 'Organization Logo'} size={36} />
                      {uploadingLogo && (
                        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Loader2 size={24} className="animate-spin text-indigo-400" />
                        </div>
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: '180px' }}>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff' }}>{name || 'Organization Name'}</div>
                      <div style={{ fontSize: '12px', color: '#38bdf8', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                        Workspace Code: {organizationCode}
                      </div>

                      <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileChange}
                          accept="image/png, image/jpeg, image/webp, image/svg+xml"
                          style={{ display: 'none' }}
                        />
                        {editingSections.identity ? (
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadingLogo}
                            className="btn btn-primary btn-sm"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
                          >
                            <Upload size={14} />
                            <span>{logoUrl ? 'Change Logo' : 'Upload Logo'}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled
                            className="btn btn-secondary btn-sm"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', opacity: 0.6, cursor: 'not-allowed' }}
                            title="Click Edit Section above to enable changing logo"
                          >
                            <Lock size={13} />
                            <span>Change Logo (Locked)</span>
                          </button>
                        )}
                        {logoUrl && (
                          <span style={{ fontSize: '11.5px', color: '#34d399', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={13} /> Logo Set
                          </span>
                        )}
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
                        <Lock size={11} /> Locked System Name
                      </span>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        className={`form-input ${styles.readOnlyInput}`}
                        value={name}
                        readOnly
                        disabled
                        style={{ paddingRight: '40px' }}
                      />
                      <Lock size={16} color="var(--text-muted)" style={{ position: 'absolute', right: '14px', top: '12px' }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* DEFAULT WORKSPACE SETTINGS */}
              <div className={styles.sectionCard}>
                <div className={styles.sectionHeader} onClick={() => toggleSection('rules')}>
                  <div className={styles.sectionHeaderTitleWrapper}>
                    <div className={styles.sectionHeaderTitleRow}>
                      <Compass size={18} color="#c084fc" style={{ flexShrink: 0 }} />
                      <span className={styles.sectionHeaderTitleText}>Default Workspace Rules &amp; Limits</span>
                    </div>
                    <div className={styles.sectionHeaderBadgeRow}>
                      {editingSections.rules ? (
                        <span className="badge badge-primary" style={{ fontSize: '10.5px', padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Unlock size={11} /> Editing Mode
                        </span>
                      ) : (
                        <span className="badge badge-secondary" style={{ fontSize: '10.5px', padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Lock size={11} /> Read-Only
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={(e) => toggleEditSection('rules', e)}
                      className={`btn btn-sm ${editingSections.rules ? 'btn-secondary' : 'btn-primary'} ${styles.sectionEditBtn}`}
                      title={editingSections.rules ? 'Lock Section' : 'Edit Section'}
                    >
                      {editingSections.rules ? (
                        <>
                          <Lock size={13} />
                          <span>Lock Section</span>
                        </>
                      ) : (
                        <>
                          <Edit2 size={13} />
                          <span>Edit Section</span>
                        </>
                      )}
                    </button>
                    <div className={styles.accordionChevron}>
                      {openSections.rules ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </div>
                </div>

                <div className={`${styles.sectionBody} ${!openSections.rules ? styles.sectionBodyHidden : ''}`}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                    <div className="form-group">
                      <label className="form-label">Default Geofence Radius (Meters)</label>
                      <input
                        type="number"
                        min={20}
                        max={1000}
                        readOnly={!editingSections.rules}
                        disabled={!editingSections.rules}
                        className={`form-input ${editingSections.rules ? styles.editableInput : styles.readOnlyInput}`}
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
                        readOnly={!editingSections.rules}
                        disabled={!editingSections.rules}
                        className={`form-input ${editingSections.rules ? styles.editableInput : styles.readOnlyInput}`}
                        value={defaultMaxDailyCycles}
                        onChange={(e) => setDefaultMaxDailyCycles(Number(e.target.value))}
                      />
                      <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        1 Cycle = 1 Clock In &amp; 1 Clock Out session per workday.
                      </p>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Attendance Correction Window (Days)</label>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        readOnly={!editingSections.rules}
                        disabled={!editingSections.rules}
                        className={`form-input ${editingSections.rules ? styles.editableInput : styles.readOnlyInput}`}
                        value={attendanceCorrectionWindowDays}
                        onChange={(e) => setAttendanceCorrectionWindowDays(Number(e.target.value))}
                      />
                      <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Staff can request attendance correction up to this many days after punch date.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* CONTACT & ADMINISTRATIVE PROFILE */}
              <div className={styles.sectionCard}>
                <div className={styles.sectionHeader} onClick={() => toggleSection('contact')}>
                  <div className={styles.sectionHeaderTitleWrapper}>
                    <div className={styles.sectionHeaderTitleRow}>
                      <User size={18} color="#34d399" style={{ flexShrink: 0 }} />
                      <span className={styles.sectionHeaderTitleText}>Contact Profiles &amp; Administrative Email</span>
                    </div>
                    <div className={styles.sectionHeaderBadgeRow}>
                      {editingSections.contact ? (
                        <span className="badge badge-primary" style={{ fontSize: '10.5px', padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Unlock size={11} /> Editing Mode
                        </span>
                      ) : (
                        <span className="badge badge-secondary" style={{ fontSize: '10.5px', padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Lock size={11} /> Read-Only
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={(e) => toggleEditSection('contact', e)}
                      className={`btn btn-sm ${editingSections.contact ? 'btn-secondary' : 'btn-primary'} ${styles.sectionEditBtn}`}
                      title={editingSections.contact ? 'Lock Section' : 'Edit Section'}
                    >
                      {editingSections.contact ? (
                        <>
                          <Lock size={13} />
                          <span>Lock Section</span>
                        </>
                      ) : (
                        <>
                          <Edit2 size={13} />
                          <span>Edit Section</span>
                        </>
                      )}
                    </button>
                    <div className={styles.accordionChevron}>
                      {openSections.contact ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </div>
                </div>

                <div className={`${styles.sectionBody} ${!openSections.contact ? styles.sectionBodyHidden : ''}`}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                    <div className="form-group">
                      <label className="form-label">Contact Person Name</label>
                      <input
                        type="text"
                        readOnly={!editingSections.contact}
                        disabled={!editingSections.contact}
                        className={`form-input ${editingSections.contact ? styles.editableInput : styles.readOnlyInput}`}
                        value={contactPersonName}
                        onChange={(e) => setContactPersonName(e.target.value)}
                        placeholder="Administrator full name"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Contact Phone</label>
                      <input
                        type="text"
                        readOnly={!editingSections.contact}
                        disabled={!editingSections.contact}
                        className={`form-input ${editingSections.contact ? styles.editableInput : styles.readOnlyInput}`}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+1 555-0199"
                      />
                    </div>
                  </div>

                  {/* CONTACT EMAIL WITH DUAL OTP VERIFICATION TRIGGER */}
                  <div className="form-group" style={{ marginBottom: 0, marginTop: '10px' }}>
                    <label className="form-label">Official Contact Email</label>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <input
                        type="email"
                        className={`form-input ${styles.readOnlyInput}`}
                        value={contactEmail}
                        readOnly
                        disabled
                        style={{ flex: 1, minWidth: '180px' }}
                      />
                      {editingSections.contact ? (
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
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="btn btn-secondary btn-sm"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', opacity: 0.6, cursor: 'not-allowed' }}
                          title="Click Edit Section above to enable email change"
                        >
                          <Lock size={13} />
                          <span>Change Email (Locked)</span>
                        </button>
                      )}
                    </div>
                    <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '6px' }}>
                      Security policy: Verification codes will be sent to BOTH your current email and new email.
                    </p>
                  </div>
                </div>
              </div>

              {/* Sticky Submit Action Bar */}
              <div className={styles.submitBar} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isDirty ? (
                    <span style={{ fontSize: '12.5px', color: '#fbbf24', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <AlertTriangle size={15} color="#fbbf24" />
                      <span>Unsaved modifications detected</span>
                    </span>
                  ) : (
                    <span style={{ fontSize: '12.5px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle2 size={15} color="#34d399" />
                      <span>All settings saved &amp; synchronized</span>
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  {isDirty && (
                    <button
                      type="button"
                      onClick={() => setShowUnsavedModal(true)}
                      className="btn btn-secondary btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <RotateCcw size={14} />
                      <span>Discard Changes</span>
                    </button>
                  )}

                  <button
                    type="submit"
                    disabled={saving || !isDirty}
                    className="btn btn-primary"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 20px',
                      opacity: !isDirty && !saving ? 0.6 : 1,
                      cursor: !isDirty && !saving ? 'not-allowed' : 'pointer',
                    }}
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
              </div>
            </form>
          )}

          {/* UNSAVED CHANGES CONFIRMATION MODAL */}
          {showUnsavedModal && (
            <div className="modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 999999, backgroundColor: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
              <div className="glass-card" style={{ width: '100%', maxWidth: '440px', padding: '24px', backgroundColor: '#0d121f', borderRadius: '16px', border: '1px solid var(--border-medium)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                  <AlertTriangle size={24} color="#fbbf24" />
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                    Unsaved Changes Detected
                  </h3>
                </div>
                <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 20px 0' }}>
                  You have made changes to workspace settings that have not been saved yet. What would you like to do?
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => handleSubmit()}
                    className="btn btn-primary"
                    style={{ width: '100%', justifyContent: 'center', padding: '11px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                  >
                    <Save size={16} />
                    <span>Save Changes &amp; Continue</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDiscardChanges}
                    className="btn btn-secondary"
                    style={{ width: '100%', justifyContent: 'center', padding: '11px', color: '#f87171', borderColor: 'rgba(248, 113, 113, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                  >
                    <RotateCcw size={16} />
                    <span>Discard Changes</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowUnsavedModal(false)}
                    className="btn btn-ghost"
                    style={{ width: '100%', justifyContent: 'center', padding: '9px', fontSize: '13px', color: 'var(--text-muted)' }}
                  >
                    Keep Editing (Cancel)
                  </button>
                </div>
              </div>
            </div>
          )}

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
        </main>
      </div>

      <OrgAdminMobileNav organizationCode={organizationCode} />
    </div>
  );
}
