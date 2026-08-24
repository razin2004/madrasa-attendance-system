'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Clock,
  CalendarDays,
  FileText,
  FileCheck2,
  User,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Shield,
} from 'lucide-react';
import styles from './StaffLayout.module.css';

interface StaffSidebarProps {
  organizationCode: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  staffName?: string;
  staffEmail?: string;
  onSignOut: () => void;
}

export function StaffSidebar({
  organizationCode,
  isCollapsed,
  onToggleCollapse,
  staffName = 'Staff Member',
  staffEmail = '',
  onSignOut,
}: StaffSidebarProps) {
  const pathname = usePathname();
  const org = organizationCode.toUpperCase();
  const basePath = `/${org}/staff`;

  const navItems = [
    {
      label: 'Dashboard',
      href: basePath,
      icon: LayoutDashboard,
      exact: true,
    },
    {
      label: 'Attendance',
      href: `${basePath}/attendance`,
      icon: Clock,
      exact: true,
    },
    {
      label: 'Shift',
      href: `${basePath}/shift`,
      icon: CalendarDays,
      exact: false,
    },
    {
      label: 'Leave',
      href: `${basePath}/leave`,
      icon: FileText,
      exact: false,
    },
    {
      label: 'Requests',
      href: `${basePath}/attendance/corrections`,
      icon: FileCheck2,
      exact: false,
    },
    {
      label: 'Profile',
      href: `${basePath}/profile`,
      icon: User,
      exact: false,
    },
  ];

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <aside className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''}`}>
      <div className={styles.sidebarHeader}>
        <Link href={basePath} className={styles.logoArea}>
          <div className={styles.logoIcon}>
            <Shield size={20} />
          </div>
          {!isCollapsed && (
            <div className={styles.brandText}>
              <span className={styles.brandName}>ShiftGuard</span>
              <span className={styles.brandRole}>Staff Portal</span>
            </div>
          )}
        </Link>
        <button
          type="button"
          className={styles.toggleBtn}
          onClick={onToggleCollapse}
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          aria-label={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className={styles.navSection}>
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              href={item.href}
              className={`${styles.navItem} ${isActive ? styles.active : ''}`}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon size={20} className={styles.navIcon} />
              {!isCollapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className={styles.sidebarFooter}>
        {!isCollapsed && (
          <div className={styles.userCard}>
            <div className={styles.userAvatar}>{getInitials(staffName)}</div>
            <div className={styles.userInfo}>
              <span className={styles.userName}>{staffName}</span>
              <span className={styles.userEmail}>{staffEmail || org}</span>
            </div>
          </div>
        )}

        <button
          type="button"
          className={styles.signOutBtn}
          onClick={onSignOut}
          title="Sign Out"
        >
          <LogOut size={18} />
          {!isCollapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
