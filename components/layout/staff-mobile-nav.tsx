'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Clock, CalendarDays, FileText, User } from 'lucide-react';
import styles from './StaffLayout.module.css';

interface StaffMobileNavProps {
  organizationCode: string;
}

export function StaffMobileNav({ organizationCode }: StaffMobileNavProps) {
  const pathname = usePathname();
  const org = organizationCode.toUpperCase();
  const basePath = `/${org}/staff`;

  const tabs = [
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
      label: 'Profile',
      href: `${basePath}/profile`,
      icon: User,
      exact: false,
    },
  ];

  return (
    <nav className={styles.mobileNav}>
      {tabs.map((tab) => {
        const isActive = tab.exact
          ? pathname === tab.href
          : pathname.startsWith(tab.href);
        const Icon = tab.icon;

        return (
          <Link
            key={tab.label}
            href={tab.href}
            className={`${styles.mobileNavItem} ${isActive ? styles.active : ''}`}
          >
            <Icon size={20} className={styles.mobileNavIcon} />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
