'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, MapPin, Users, Calendar, Clock, LogOut } from 'lucide-react';
import { useToast } from '../feedback/toast-provider';

interface OrgAdminMobileNavProps {
  organizationCode: string;
}

export function OrgAdminMobileNav({ organizationCode }: OrgAdminMobileNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      toast.info('Signed out of organization workspace.');
      router.push(`/${organizationCode}/login`);
    } catch {
      router.push(`/${organizationCode}/login`);
    }
  };

  const navItems = [
    {
      label: 'Overview',
      href: `/${organizationCode}/admin`,
      icon: LayoutDashboard,
      exact: true,
    },
    {
      label: 'Staff',
      href: `/${organizationCode}/admin/staff`,
      icon: Users,
      exact: false,
    },
    {
      label: 'Shifts',
      href: `/${organizationCode}/admin/shifts`,
      icon: Clock,
      exact: false,
    },
    {
      label: 'Roster',
      href: `/${organizationCode}/admin/roster`,
      icon: Calendar,
      exact: false,
    },
    {
      label: 'Leave',
      href: `/${organizationCode}/admin/leave`,
      icon: LayoutDashboard,
      exact: false,
    },
    {
      label: 'Attendance',
      href: `/${organizationCode}/admin/attendance`,
      icon: Clock,
      exact: false,
    },
    {
      label: 'Reports',
      href: `/${organizationCode}/admin/reports`,
      icon: LayoutDashboard,
      exact: false,
    },
  ];

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '64px',
        backgroundColor: '#0d121f',
        borderTop: '1px solid var(--border-subtle)',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 50,
      }}
      className="org-admin-mobile-nav"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              color: isActive ? '#818cf8' : 'var(--text-muted)',
              fontSize: '11px',
              fontWeight: isActive ? 600 : 500,
              textDecoration: 'none',
              padding: '6px 10px',
            }}
          >
            <Icon size={18} color={isActive ? '#818cf8' : 'var(--text-muted)'} />
            <span>{item.label}</span>
          </Link>
        );
      })}

      <button
        onClick={handleLogout}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4px',
          color: 'var(--text-muted)',
          fontSize: '11px',
          fontWeight: 500,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '6px 10px',
        }}
      >
        <LogOut size={18} color="var(--text-muted)" />
        <span>Sign Out</span>
      </button>
    </nav>
  );
}
