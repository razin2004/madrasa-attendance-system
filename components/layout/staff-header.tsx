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
  isPrecheckReady = true,
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
        <span className={styles.orgBadge}>{org}</span>
      </div>

      <div className={styles.headerActions}>
        <div
          className={`${styles.statusPill} ${
            isPrecheckReady ? styles.ready : styles.failed
          }`}
          title={
            isPrecheckReady
              ? '3-Layer Security (Device, IP, Geofence) Verified'
              : 'Security Verification Attention Required'
          }
        >
          <Radio size={14} />
          <span>{isPrecheckReady ? 'Security Ready' : 'Security Alert'}</span>
        </div>

        <button
          type="button"
          className={styles.signOutBtn}
          onClick={onSignOut}
          style={{ width: 'auto', padding: '6px 14px' }}
        >
          <LogOut size={16} />
          <span style={{ fontSize: '0.8125rem' }}>Sign Out</span>
        </button>
      </div>
    </header>
  );
}
