'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { StaffSidebar } from '@/components/layout/staff-sidebar';
import { StaffHeader } from '@/components/layout/staff-header';
import { StaffMobileNav } from '@/components/layout/staff-mobile-nav';
import { ConfirmationModal } from '@/components/feedback/confirmation-modal';
import styles from '@/components/layout/StaffLayout.module.css';

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const router = useRouter();
  const orgCode = (params.organizationCode as string)?.toUpperCase() || '';

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [staffInfo, setStaffInfo] = useState<{ name: string; email: string } | null>(null);
  const [isPrecheckReady, setIsPrecheckReady] = useState<boolean | undefined>(undefined);

  // Restore sidebar state from localStorage & fetch precheck status
  useEffect(() => {
    const saved = localStorage.getItem('shiftguard_staff_sidebar_collapsed');
    if (saved === 'true') {
      setIsCollapsed(true);
    }

    if (!orgCode) return;

    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setStaffInfo({ name: data.user.name || 'Staff Member', email: data.user.email || '' });
        }
      })
      .catch(() => {});

    fetch(`/api/org/${orgCode}/attendance/precheck`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.evaluation) {
          setIsPrecheckReady(Boolean(data.evaluation.isReady));
        } else {
          setIsPrecheckReady(false);
        }
      })
      .catch(() => {
        setIsPrecheckReady(false);
      });
  }, [orgCode]);

  const handleToggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('shiftguard_staff_sidebar_collapsed', String(next));
      return next;
    });
  };

  const handleSignOutConfirm = async () => {
    setSigningOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    } finally {
      localStorage.removeItem('shiftguard_auth_token');
      sessionStorage.clear();
      setSigningOut(false);
      setShowSignOutModal(false);
      router.push('/login');
    }
  };

  return (
    <div className={styles.layoutWrapper}>
      {/* Desktop Left Sidebar */}
      <StaffSidebar
        organizationCode={orgCode}
        isCollapsed={isCollapsed}
        onToggleCollapse={handleToggleCollapse}
        staffName={staffInfo?.name || 'Staff Member'}
        staffEmail={staffInfo?.email || ''}
        onSignOut={() => setShowSignOutModal(true)}
      />

      {/* Main Layout Area */}
      <div
        className={`${styles.mainContainer} ${
          isCollapsed ? styles.collapsed : ''
        }`}
      >
        <StaffHeader
          organizationCode={orgCode}
          staffName={staffInfo?.name}
          isPrecheckReady={isPrecheckReady}
          onSignOut={() => setShowSignOutModal(true)}
        />

        <main className={styles.contentBody}>{children}</main>
      </div>

      {/* Mobile Bottom Navigation */}
      <StaffMobileNav organizationCode={orgCode} />

      {/* Universal Sign Out Confirmation Modal */}
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
