'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Menu,
  X,
  Radio,
  AlertTriangle,
  LayoutDashboard,
  Clock,
  FileText,
  FilePlus,
  User,
  ArrowLeftRight,
  LogOut,
  CalendarDays,
  Plus,
} from 'lucide-react';
import { OrgLogo } from '@/components/branding/org-logo';
import styles from './StaffLayout.module.css';

interface StaffHeaderProps {
  organizationCode: string;
  organizationName?: string;
  logoUrl?: string | null;
  staffName?: string;
  isPrecheckReady?: boolean;
  onSignOut: () => void;
}

export function StaffHeader({
  organizationCode,
  organizationName,
  logoUrl,
  staffName,
  isPrecheckReady,
  onSignOut,
}: StaffHeaderProps) {
  const rawPathname = usePathname();
  const pathname = rawPathname || '';
  const org = organizationCode.toUpperCase();
  const basePath = `/${org}/staff`;

  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);

  const getPageTitle = () => {
    if (pathname.includes('/staff/swaps')) return 'Shift Swapping';
    if (pathname.includes('/staff/attendance/correction')) return 'Submit Correction';
    if (pathname.includes('/staff/attendance/corrections')) return 'Correction Requests';
    if (pathname.includes('/staff/attendance')) return 'Attendance History';
    if (pathname.includes('/staff/shift')) return 'Shift Schedule';
    if (pathname.includes('/staff/leave/new')) return 'Apply Leave';
    if (pathname.includes('/staff/leave')) return 'Leave Management';
    if (pathname.includes('/staff/profile')) return 'Staff Profile';
    return 'Staff Dashboard';
  };

  const getPanelNavItems = () => {
    let primaryAction: { label: string; href: string; icon: any } | null = null;
    let items: Array<{ label: string; href: string; icon: any; exact?: boolean }> = [];

    if (pathname.includes('/staff/leave')) {
      primaryAction = { label: 'Apply for Leave', href: `${basePath}/leave/new`, icon: Plus };
      items = [
        { label: 'Leave Management', href: `${basePath}/leave`, icon: FileText, exact: true },
        { label: 'Staff Dashboard', href: basePath, icon: LayoutDashboard, exact: true },
        { label: 'Attendance History', href: `${basePath}/attendance`, icon: Clock, exact: false },
        { label: 'Staff Profile', href: `${basePath}/profile`, icon: User, exact: false },
      ];
    } else if (pathname.includes('/staff/swaps')) {
      primaryAction = { label: 'Apply for Shift Swap', href: `${basePath}/swaps/new`, icon: Plus };
      items = [
        { label: 'Shift Swapping', href: `${basePath}/swaps`, icon: ArrowLeftRight, exact: true },
        { label: 'Shift Schedule', href: `${basePath}/shift`, icon: CalendarDays, exact: false },
        { label: 'Staff Dashboard', href: basePath, icon: LayoutDashboard, exact: true },
        { label: 'Staff Profile', href: `${basePath}/profile`, icon: User, exact: false },
      ];
    } else if (pathname.includes('/staff/attendance')) {
      primaryAction = { label: 'Request Correction', href: `${basePath}/attendance/correction`, icon: FilePlus };
      items = [
        { label: 'Attendance History', href: `${basePath}/attendance`, icon: Clock, exact: true },
        { label: 'My Corrections', href: `${basePath}/attendance/corrections`, icon: FileText, exact: false },
        { label: 'Shift Schedule', href: `${basePath}/shift`, icon: CalendarDays, exact: false },
        { label: 'Staff Dashboard', href: basePath, icon: LayoutDashboard, exact: true },
        { label: 'Staff Profile', href: `${basePath}/profile`, icon: User, exact: false },
      ];
    } else if (pathname.includes('/staff/shift')) {
      items = [
        { label: 'Shift Schedule', href: `${basePath}/shift`, icon: CalendarDays, exact: true },
        { label: 'Shift Swapping', href: `${basePath}/swaps`, icon: ArrowLeftRight, exact: false },
        { label: 'Staff Dashboard', href: basePath, icon: LayoutDashboard, exact: true },
        { label: 'Staff Profile', href: `${basePath}/profile`, icon: User, exact: false },
      ];
    } else if (pathname.includes('/staff/profile')) {
      items = [
        { label: 'Staff Profile', href: `${basePath}/profile`, icon: User, exact: true },
        { label: 'Staff Dashboard', href: basePath, icon: LayoutDashboard, exact: true },
        { label: 'Leave Management', href: `${basePath}/leave`, icon: FileText, exact: false },
        { label: 'Attendance History', href: `${basePath}/attendance`, icon: Clock, exact: false },
      ];
    } else {
      items = [
        { label: 'Staff Dashboard', href: basePath, icon: LayoutDashboard, exact: true },
        { label: 'Attendance History', href: `${basePath}/attendance`, icon: Clock, exact: false },
        { label: 'Shift Schedule', href: `${basePath}/shift`, icon: CalendarDays, exact: false },
        { label: 'Leave Management', href: `${basePath}/leave`, icon: FileText, exact: false },
        { label: 'Shift Swaps', href: `${basePath}/swaps`, icon: ArrowLeftRight, exact: false },
        { label: 'Staff Profile', href: `${basePath}/profile`, icon: User, exact: false },
      ];
    }

    return { primaryAction, items };
  };

  const { primaryAction, items: navItems } = getPanelNavItems();

  return (
    <header className={styles.topHeader}>
      {/* Header Left: Logo, Org Code, and Small Subtitle */}
      <div className={styles.headerLeftArea}>
        <div className={styles.logoBox}>
          <OrgLogo logoUrl={logoUrl} name={organizationName || organizationCode} size={20} />
        </div>
        <div className={styles.headerTextCol}>
          <span className={styles.headerOrgCode}>{org}</span>
          <span className={styles.headerPanelSubtitle}>{getPageTitle()}</span>
        </div>
      </div>

      {/* Header Right: Green/Red Security Status Badge & 3-Line Menu */}
      <div className={styles.headerActions}>
        <div
          className={`${styles.statusPill} ${
            isPrecheckReady === true
              ? styles.ready
              : styles.failed
          }`}
          title={
            isPrecheckReady === true
              ? '3-Layer Security (Device, IP, Geofence) Verified'
              : 'Security Verification Attention Required'
          }
        >
          {isPrecheckReady === true ? (
            <>
              <Radio size={14} />
              <span>Security Verified</span>
            </>
          ) : (
            <>
              <AlertTriangle size={14} />
              <span>Security Alert</span>
            </>
          )}
        </div>

        {/* 3-Line Navigation Menu Toggle Button */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setHeaderMenuOpen(!headerMenuOpen)}
            className={styles.lineButton}
            aria-label="Toggle Navigation Menu"
            aria-expanded={headerMenuOpen}
          >
            {headerMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          {headerMenuOpen && (
            <>
              {/* Fixed Backdrop Overlay */}
              <div
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 999,
                  cursor: 'default',
                  backgroundColor: 'transparent',
                }}
                onClick={() => setHeaderMenuOpen(false)}
              />
              <div className={styles.headerDropdownMenu}>
                <div style={{ padding: '8px 12px 6px 12px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff' }}>{staffName || 'Staff Account'}</div>
                  <div style={{ fontSize: '11px', color: '#818cf8', fontWeight: 600 }}>{org} Workspace</div>
                </div>

                <div style={{ padding: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {primaryAction && (
                    <Link
                      href={primaryAction.href}
                      onClick={() => setHeaderMenuOpen(false)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 14px',
                        marginBottom: '4px',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                        color: '#ffffff',
                        textDecoration: 'none',
                        fontSize: '13px',
                        fontWeight: 700,
                        boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)',
                      }}
                    >
                      <primaryAction.icon size={16} />
                      <span>{primaryAction.label}</span>
                    </Link>
                  )}

                  {navItems.map((item) => {
                    const isActive = item.exact
                      ? pathname === item.href
                      : pathname.startsWith(item.href);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setHeaderMenuOpen(false)}
                        className={`${styles.dropdownItem} ${isActive ? styles.dropdownActive : ''}`}
                      >
                        <Icon size={16} />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => {
                      setHeaderMenuOpen(false);
                      onSignOut();
                    }}
                    className={`${styles.dropdownItem} ${styles.dropdownSignOut}`}
                  >
                    <LogOut size={16} />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

