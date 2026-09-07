'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { User, Smartphone, Building2, ShieldCheck, LogOut, RefreshCw, CreditCard, Upload, FileText, CheckCircle2, Loader2 } from 'lucide-react';
import { useToast } from '@/components/feedback/toast-provider';
import { ConfirmationModal } from '@/components/feedback/confirmation-modal';
import styles from './StaffProfile.module.css';

export default function StaffProfilePage() {
  const params = useParams();
  const orgCode = (params.organizationCode as string)?.toUpperCase() || '';
  const router = useRouter();
  const toast = useToast();

  const [staffProfile, setStaffProfile] = useState<any>(null);
  const [orgData, setOrgData] = useState<any>(null);
  const [precheck, setPrecheck] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Staff ID Document Form State
  const [idDocType, setIdDocType] = useState<string>('AADHAAR');
  const [idDocLast4, setIdDocLast4] = useState<string>('');
  const [idFile, setIdFile] = useState<File | null>(null);
  const [submittingId, setSubmittingId] = useState(false);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const deviceSecret = typeof window !== 'undefined' ? localStorage.getItem('shiftguard_device_secret') || '' : '';
      const res = await fetch(`/api/org/${orgCode}/attendance/precheck`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceSecret }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.staffProfile) {
          setStaffProfile(data.staffProfile);
          if (data.staffProfile.idDocType) setIdDocType(data.staffProfile.idDocType);
          if (data.staffProfile.idDocLast4) setIdDocLast4(data.staffProfile.idDocLast4);
        }
        if (data.organization) setOrgData(data.organization);
        if (data.evaluation) setPrecheck(data.evaluation);
      }
    } catch {
      toast.error('Failed to load staff profile information.');
    } finally {
      setLoading(false);
    }
  }, [orgCode, toast]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleIdDocSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (idDocType !== 'OTHER') {
      if (!idDocLast4 || idDocLast4.trim().length < 4) {
        toast.error('Please enter the last 4 digits of your ID card.');
        return;
      }
      if (!idFile) {
        toast.error('Please select and attach your ID card document file.');
        return;
      }
    }

    setSubmittingId(true);
    try {
      const res = await fetch(`/api/org/${orgCode}/staff/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idDocType,
          idDocLast4: idDocLast4.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || 'Identity Card details updated successfully!');
        if (data.staffProfile) setStaffProfile(data.staffProfile);
      } else {
        toast.error(data.error || 'Failed to update Identity Card details.');
      }
    } catch {
      toast.error('Network error saving Identity Card details.');
    } finally {
      setSubmittingId(false);
    }
  };

  const handleSignOutConfirm = async () => {
    setSigningOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors
    } finally {
      localStorage.removeItem('shiftguard_auth_token');
      sessionStorage.clear();
      setSigningOut(false);
      setShowSignOutModal(false);
      router.push(`/${orgCode}/login`);
    }
  };

  const isDeviceRegistered =
    Boolean(precheck?.layer1Device?.isVerified) ||
    Boolean(staffProfile?.devices?.some((d: any) => d.status === 'REGISTERED'));

  const formatDocTypeLabel = (type: string) => {
    switch (type) {
      case 'AADHAAR':
        return 'Aadhaar Card';
      case 'VOTER_ID':
        return 'Voter ID Card';
      case 'PASSPORT':
        return 'Passport';
      case 'DRIVING_LICENSE':
        return 'Driving Licence';
      case 'COLLEGE_ID':
        return 'College / Institutional ID Card';
      case 'GOVERNMENT_ID':
        return 'Government ID Card';
      case 'OTHER':
        return 'Other Identification Card';
      default:
        return type || 'Identity Document';
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
        <RefreshCw size={28} className="animate-spin text-indigo-400" style={{ margin: '0 auto 12px auto' }} />
        <p style={{ marginTop: '8px', fontSize: '14px' }}>Loading staff profile &amp; security status...</p>
      </div>
    );
  }

  return (
    <div className={styles.profileContainer}>
      <div className={styles.headerBar}>
        <h2>Staff Profile &amp; Account Security</h2>
        <p>Manage your account identity, registered device token, and workspace settings</p>
      </div>

      {/* Centered Avatar Preview Section */}
      <div className={styles.card} style={{ textAlign: 'center', padding: '24px 16px' }}>
        <div className={styles.avatarSection}>
          <div className={styles.avatarCircle}>
            {staffProfile?.name ? staffProfile.name.charAt(0).toUpperCase() : <User size={32} />}
          </div>
          <button
            type="button"
            className={styles.avatarUploadBtn}
            onClick={() => toast.info('Profile picture upload feature coming soon.')}
          >
            <span>Upload Photo</span>
          </button>
        </div>
        <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', margin: '4px 0 2px 0' }}>
          {staffProfile?.name || 'Staff Member'}
        </h3>
        <p style={{ fontSize: '12.5px', color: '#94a3b8', margin: 0 }}>
          ID: <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#818cf8' }}>{staffProfile?.staffId || '—'}</span>
        </p>
      </div>

      {/* Card 1: Account Information */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>
          <User size={20} color="#818cf8" />
          Account &amp; Department Information
        </h3>

        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <span className={styles.label}>Full Name</span>
            <span className={styles.value}>{staffProfile?.name || 'Staff Member'}</span>
          </div>

          <div className={styles.infoItem}>
            <span className={styles.label}>Employee ID</span>
            <span className={styles.value} style={{ fontFamily: 'var(--font-mono)', color: '#818cf8' }}>{staffProfile?.staffId || '—'}</span>
          </div>

          <div className={styles.infoItem}>
            <span className={styles.label}>Department / Branch</span>
            <span className={styles.value}>
              {staffProfile?.branchAssignments?.[0]?.branch?.name || staffProfile?.department || 'Main Branch'}
            </span>
          </div>

          <div className={styles.infoItem}>
            <span className={styles.label}>Email Address</span>
            <span className={`${styles.value} ${styles.hardwareString}`}>{staffProfile?.user?.email || staffProfile?.email || '—'}</span>
          </div>

          <div className={styles.infoItem}>
            <span className={styles.label}>Phone Number</span>
            <span className={styles.value}>{staffProfile?.phone || 'Not Provided'}</span>
          </div>

          <div className={styles.infoItem}>
            <span className={styles.label}>Account Status</span>
            <span
              style={{
                color: staffProfile?.user?.status === 'ACTIVE' ? '#34d399' : '#f87171',
                fontWeight: 700,
              }}
            >
              {staffProfile?.user?.status || 'ACTIVE'}
            </span>
          </div>
        </div>
      </div>

      {/* Card 2: Identity Card & Document (Add ID if missing) */}
      <div className={styles.card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
          <h3 className={styles.cardTitle} style={{ margin: 0 }}>
            <CreditCard size={20} color="#818cf8" />
            Identity Document &amp; Verification
          </h3>

          <span
            className={`badge ${staffProfile?.idDocLast4 ? 'badge-success' : 'badge-warning'}`}
            style={{ fontSize: '11px', fontWeight: 800, padding: '4px 10px' }}
          >
            {staffProfile?.idDocLast4 ? '✓ Identity Verified' : 'ID Not Added'}
          </span>
        </div>

        {staffProfile?.idDocLast4 ? (
          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <span className={styles.label}>Document Type</span>
              <span className={styles.value}>{formatDocTypeLabel(staffProfile.idDocType)}</span>
            </div>

            <div className={styles.infoItem}>
              <span className={styles.label}>ID Reference / Last 4 Digits</span>
              <span className={styles.hardwareString}>•••• {staffProfile.idDocLast4}</span>
            </div>
          </div>
        ) : (
          <form onSubmit={handleIdDocSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ fontSize: '13px', color: '#cbd5e1', margin: 0 }}>
              Your identity card details have not been registered by administrator yet. Please submit your identity card details below:
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                  Identity Document Type
                </label>
                <select
                  value={idDocType}
                  onChange={(e) => setIdDocType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#ffffff',
                    fontSize: '13px',
                  }}
                >
                  <option value="AADHAAR" style={{ backgroundColor: '#0d121f' }}>Aadhaar Card</option>
                  <option value="VOTER_ID" style={{ backgroundColor: '#0d121f' }}>Voter ID Card</option>
                  <option value="PASSPORT" style={{ backgroundColor: '#0d121f' }}>Passport</option>
                  <option value="DRIVING_LICENSE" style={{ backgroundColor: '#0d121f' }}>Driving Licence</option>
                  <option value="COLLEGE_ID" style={{ backgroundColor: '#0d121f' }}>College / Institutional ID Card</option>
                  <option value="GOVERNMENT_ID" style={{ backgroundColor: '#0d121f' }}>Government ID Card</option>
                  <option value="OTHER" style={{ backgroundColor: '#0d121f' }}>Other Identification Card</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                  ID Last 4 Digits / Reference
                </label>
                <input
                  type="text"
                  maxLength={10}
                  placeholder="e.g. 5482"
                  value={idDocLast4}
                  onChange={(e) => setIdDocLast4(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#ffffff',
                    fontSize: '13px',
                  }}
                />
              </div>
            </div>

            {/* Document File Upload Dropzone */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                Attach Document File {idDocType !== 'OTHER' ? '(Required)' : '(Optional)'}
              </label>
              <div
                style={{
                  border: '2px dashed rgba(255, 255, 255, 0.15)',
                  borderRadius: '10px',
                  padding: '16px',
                  textAlign: 'center',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  cursor: 'pointer',
                  position: 'relative',
                }}
              >
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setIdFile(e.target.files?.[0] || null)}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    opacity: 0,
                    cursor: 'pointer',
                    width: '100%',
                    height: '100%',
                  }}
                />
                <Upload size={22} color="#818cf8" style={{ margin: '0 auto 6px auto' }} />
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>
                  {idFile ? idFile.name : 'Click or drag identity card photo / PDF file here'}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                  Supported formats: JPG, PNG, PDF (Max 5MB)
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={submittingId}
              className="btn btn-primary"
              style={{
                width: '100%',
                fontWeight: 700,
                padding: '12px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '4px',
              }}
            >
              {submittingId ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Saving Identity Document...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  <span>Submit Identity Card</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>

      {/* Card 3: Registered Device & Security */}
      <div className={styles.card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
          <h3 className={styles.cardTitle} style={{ margin: 0 }}>
            <Smartphone size={20} color="#34d399" />
            Attendance Device Security Status
          </h3>

          <span
            className={`badge ${isDeviceRegistered ? 'badge-success' : 'badge-warning'}`}
            style={{ fontSize: '11px', fontWeight: 800, padding: '4px 10px' }}
          >
            {isDeviceRegistered ? '✓ Bound Device' : 'Unbound Device'}
          </span>
        </div>

        <div className={styles.infoGrid} style={{ marginBottom: '20px' }}>
          <div className={styles.infoItem}>
            <span className={styles.label}>Device Authorization</span>
            <span className={styles.value} style={{ color: isDeviceRegistered ? '#34d399' : '#fbbf24', fontWeight: 700 }}>
              {isDeviceRegistered ? 'Primary Security Device Bound' : 'Device Pending Registration'}
            </span>
          </div>

          <div className={styles.infoItem}>
            <span className={styles.label}>Device Label / Type</span>
            <span className={styles.value}>
              {staffProfile?.devices?.[0]?.label || 'Staff Primary Device'}
            </span>
          </div>

          <div className={styles.infoItem}>
            <span className={styles.label}>Security Verification Status</span>
            <span className={styles.value} style={{ color: '#38bdf8', fontWeight: 700 }}>
              {isDeviceRegistered ? '✓ 3-Layer Zero-Trust Protected' : 'Verification Required'}
            </span>
          </div>
        </div>

        {/* Full-Width Request Device Swap Button */}
        <button
          type="button"
          onClick={() => toast.info('Device Swap Request initiated. Please contact your Org Admin for verification.')}
          className="btn btn-secondary"
          style={{ width: '100%', fontWeight: 700, padding: '12px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        >
          <Smartphone size={16} />
          <span>Request Device Swap</span>
        </button>
      </div>

      {/* Sign Out Card */}
      <div className={styles.signOutSection}>
        <div className={styles.signOutText}>
          <h4>Sign Out of Workspace</h4>
          <p>You will need to sign in again to access attendance clocking.</p>
        </div>

        <button
          type="button"
          className={styles.signOutBtn}
          onClick={() => setShowSignOutModal(true)}
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showSignOutModal}
        onClose={() => !signingOut && setShowSignOutModal(false)}
        onConfirm={handleSignOutConfirm}
        title="Sign Out of ShiftGuard"
        message="Are you sure you want to sign out? You will need to log in again to access your attendance and shift schedule."
        confirmText="Sign Out"
        cancelText="Cancel"
        variant="danger"
        isLoading={signingOut}
      />
    </div>
  );
}

