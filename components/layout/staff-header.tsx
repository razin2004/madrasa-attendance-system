'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { ShieldCheck, LogOut, Radio } from 'lucide-react';
import styles from './StaffLayout.module.css';

interface StaffHeaderProps {
  organizationCode: string;
  staffName?: string;
  isPrecheckReady?: boolean;
  onSignOut: () => void;
}

export function StaffHeader({
  organizationCode,
  staffName,
  isPrecheckReady,
  onSignOut,
}: StaffHeaderProps) {
  const pathname = usePathname();
  const org = organizationCode.toUpperCase();

  const getPageTitle = () => {
    if (pathname.includes('/staff/attendance/correction')) return 'Submit Correction Request';
    if (pathname.includes('/staff/attendance/corrections')) return 'Correction Requests';
    if (pathname.includes('/staff/attendance')) return 'Attendance History';
    if (pathname.includes('/staff/shift')) return 'Shift Schedule & Rules';
    if (pathname.includes('/staff/leave/new')) return 'Apply for Leave';
    if (pathname.includes('/staff/leave')) return 'Leave Management';
    if (pathname.includes('/staff/profile')) return 'Staff Profile & Security';
    return 'Staff Dashboard';
  };

  return (
    <header className={styles.topHeader}>
      <div className={styles.headerTitleArea}>
        <h1 className={styles.pageTitle}>{getPageTitle()}</h1>
      </div>

      <div className={styles.headerActions}>
        <div
          className={`${styles.statusPill} ${
            isPrecheckReady === true
              ? styles.ready
              : isPrecheckReady === false
              ? styles.failed
              : styles.checking
          }`}
          title={
            isPrecheckReady === true
              ? '3-Layer Security (Device, IP, Geofence) Verified'
              : isPrecheckReady === false
              ? 'Security Verification Attention Required'
              : 'Verifying Security Parameters...'
          }
        >
          <Radio size={14} className={isPrecheckReady === undefined ? 'animate-spin' : ''} />
          <span>
            {isPrecheckReady === true
              ? 'Security Verified'
              : isPrecheckReady === false
              ? 'Security Alert'
              : 'Verifying Security...'}
          </span>
        </div>
      </div>
    </header>
  );
}
