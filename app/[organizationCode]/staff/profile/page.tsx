'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { User, Smartphone, Building2, ShieldCheck, LogOut, RefreshCw } from 'lucide-react';
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
        if (data.staffProfile) setStaffProfile(data.staffProfile);
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
      router.push('/login');
    }
  };

  const isDeviceRegistered =
    Boolean(precheck?.layer1Device?.isVerified) ||
    Boolean(staffProfile?.devices?.some((d: any) => d.status === 'REGISTERED'));

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

      {/* Card 1: Account Information */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>
          <User size={20} color="#818cf8" />
          Account Information
        </h3>

        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <span className={styles.label}>Full Name</span>
            <span className={styles.value}>{staffProfile?.name || 'Staff Member'}</span>
          </div>

          <div className={styles.infoItem}>
            <span className={styles.label}>Staff ID</span>
            <span className={styles.value}>{staffProfile?.staffId || '—'}</span>
          </div>

          <div className={styles.infoItem}>
            <span className={styles.label}>Email Address</span>
            <span className={styles.value}>{staffProfile?.user?.email || staffProfile?.email || '—'}</span>
          </div>

          <div className={styles.infoItem}>
            <span className={styles.label}>Phone Number</span>
            <span className={styles.value}>{staffProfile?.phone || 'Not Provided'}</span>
          </div>

          <div className={styles.infoItem}>
            <span className={styles.label}>Organization</span>
            <span className={styles.value}>{orgData?.name || orgCode}</span>
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

      {/* Card 2: Registered Device & Security */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>
          <Smartphone size={20} color="#34d399" />
          Attendance Device Security Status
        </h3>

        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <span className={styles.label}>Device Hardware Binding</span>
            <span
              className={styles.value}
              style={{
                color: isDeviceRegistered ? '#34d399' : '#fbbf24',
                fontWeight: 700,
              }}
            >
              {isDeviceRegistered ? '✓ Registered' : 'Not Registered'}
            </span>
          </div>

          <div className={styles.infoItem}>
            <span className={styles.label}>Assigned Branch</span>
            <span className={styles.value}>
              {staffProfile?.branchAssignments?.[0]?.branch?.name || 'Main Branch'}
            </span>
          </div>

          <div className={styles.infoItem}>
            <span className={styles.label}>Security Verification Level</span>
            <span style={{ color: '#34d399', fontWeight: 700 }}>3-Layer Attendance Security</span>
          </div>
        </div>
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
