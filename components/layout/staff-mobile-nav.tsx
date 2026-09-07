'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Clock, CalendarDays, FileText, User, ArrowLeftRight } from 'lucide-react';
import styles from './StaffLayout.module.css';
import { useMobileNavScroll } from '@/hooks/use-mobile-nav-scroll';

interface StaffMobileNavProps {
  organizationCode: string;
}

export function StaffMobileNav({ organizationCode }: StaffMobileNavProps) {
  const rawPathname = usePathname();
  const pathname = rawPathname || '';
  const org = organizationCode.toUpperCase();
  const basePath = `/${org}/staff`;
  const isNavVisible = useMobileNavScroll();

  const tabs = [
    {
      label: 'Dashboard',
      href: basePath,
      icon: LayoutDashboard,
      isActive: pathname === basePath || pathname === `${basePath}/`,
    },
    {
      label: 'Attendance',
      href: `${basePath}/attendance`,
      icon: Clock,
      isActive: pathname.startsWith(`${basePath}/attendance`),
    },
    {
      label: 'Swaps',
      href: `${basePath}/swaps`,
      icon: ArrowLeftRight,
      isActive: pathname.startsWith(`${basePath}/swaps`),
    },
    {
      label: 'Leave',
      href: `${basePath}/leave`,
      icon: FileText,
      isActive: pathname.startsWith(`${basePath}/leave`),
    },
    {
      label: 'Profile',
      href: `${basePath}/profile`,
      icon: User,
      isActive: pathname.startsWith(`${basePath}/profile`),
    },
  ];

  return (
    <nav
      className={styles.mobileNav}
      aria-label="Staff mobile navigation"
      style={{
        transform: isNavVisible ? 'translateY(0)' : 'translateY(120%)',
        transition: 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
        willChange: 'transform',
      }}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;

        return (
          <Link
            key={tab.label}
            href={tab.href}
            aria-current={tab.isActive ? 'page' : undefined}
            className={`${styles.mobileNavItem} ${tab.isActive ? styles.active : ''}`}
          >
            <Icon size={20} className={styles.mobileNavIcon} />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
