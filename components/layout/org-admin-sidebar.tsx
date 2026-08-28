'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Building2,
  MapPin,
  Users,
  Clock,
  Calendar,
  LayoutDashboard,
  LogOut,
  User,
  Shield,
  Layers,
  ClipboardCheck,
  ShieldCheck,
  UserCheck,
  BarChart3,
  Settings,
} from 'lucide-react';
import { useToast } from '../feedback/toast-provider';

import { ConfirmationModal } from '../feedback/confirmation-modal';

interface OrgAdminSidebarProps {
  organizationCode: string;
  organizationName: string;
  logoUrl?: string | null;
  adminEmail?: string;
  branchCount?: number;
  staffCount?: number;
  shiftPatternCount?: number;
}

export function OrgAdminSidebar({
  organizationCode,
  organizationName,
  logoUrl,
  adminEmail = 'Admin',
  branchCount,
  staffCount,
  shiftPatternCount,
}: OrgAdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const [showLogoutModal, setShowLogoutModal] = React.useState(false);
  const [logoFailed, setLogoFailed] = React.useState(false);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      toast.info('Signed out of organization workspace.');
      router.push(`/${organizationCode}/login`);
    } catch {
      router.push(`/${organizationCode}/login`);
    } finally {
      setShowLogoutModal(false);
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
      label: 'Branches',
      href: `/${organizationCode}/admin/branches`,
      icon: MapPin,
      count: branchCount,
      exact: false,
    },
    {
      label: 'Staff Directory',
      href: `/${organizationCode}/admin/staff`,
      icon: Users,
      count: staffCount,
      exact: false,
    },
    {
      label: 'Shift Patterns',
      href: `/${organizationCode}/admin/shifts`,
      icon: Clock,
      count: shiftPatternCount,
      exact: false,
    },
    {
      label: 'Roster Schedule',
      href: `/${organizationCode}/admin/roster`,
      icon: Calendar,
      exact: false,
    },
    {
      label: 'Leave Management',
      href: `/${organizationCode}/admin/leave`,
      icon: Layers,
      exact: false,
    },
    {
      label: 'Daily Attendance',
      href: `/${organizationCode}/admin/attendance`,
      icon: ClipboardCheck,
      exact: true,
    },
    {
      label: 'Attendance Corrections',
      href: `/${organizationCode}/admin/attendance/corrections`,
      icon: ShieldCheck,
      exact: false,
    },
    {
      label: 'Manual Attendance',
      href: `/${organizationCode}/admin/attendance/manual`,
      icon: UserCheck,
      exact: false,
    },
    {
      label: 'Reports & Analytics',
      href: `/${organizationCode}/admin/reports`,
      icon: BarChart3,
      exact: false,
    },
    {
      label: 'Settings',
      href: `/${organizationCode}/admin/settings`,
      icon: Settings,
      exact: false,
    },
  ];

  return (
    <aside
      style={{
        width: '280px',
        backgroundColor: '#0d121f',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 100,
        flexShrink: 0,
      }}
      className="org-admin-desktop-sidebar"
    >
      {/* Brand Header */}
      <div
        style={{
          padding: '22px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            backgroundColor: 'rgba(255,255,255,0.06)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          {logoUrl && !logoFailed ? (
            <img 
              src={logoUrl} 
              alt={organizationName} 
              style={{ width: '100%', height: '100%', objectFit: 'cover', padding: '0', display: 'block' }} 
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <Building2 size={22} color="#818cf8" />
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: '16px',
              fontWeight: 800,
              color: '#ffffff',
              letterSpacing: '-0.3px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {organizationName}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                fontWeight: 700,
                color: '#38bdf8',
                backgroundColor: 'rgba(6, 182, 212, 0.12)',
                border: '1px solid rgba(6, 182, 212, 0.3)',
                padding: '1px 6px',
                borderRadius: '4px',
              }}
            >
              {organizationCode}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Workspace</span>
          </div>
        </div>
      </div>

      {/* Navigation Links (Independently Scrollable) */}
      <nav
        style={{
          padding: '16px 12px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          overflowY: 'auto',
          minHeight: 0,
        }}
      >
        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.8px',
            padding: '8px 12px',
          }}
        >
          Management
        </div>

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
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                background: isActive ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                color: isActive ? '#818cf8' : 'var(--text-secondary)',
                fontWeight: isActive ? 600 : 500,
                fontSize: '13.5px',
                textDecoration: 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Icon size={18} color={isActive ? '#818cf8' : 'var(--text-muted)'} />
                <span>{item.label}</span>
              </div>
              {item.count !== undefined && item.count > 0 && (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    color: 'var(--text-muted)',
                  }}
                >
                  {item.count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer Profile & Logout (Fixed at Bottom) */}
      <div
        style={{
          padding: '16px',
          borderTop: '1px solid var(--border-subtle)',
          backgroundColor: 'rgba(7, 9, 14, 0.95)',
          flexShrink: 0,
          marginTop: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              backgroundColor: 'rgba(99, 102, 241, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#818cf8',
            }}
          >
            <User size={18} />
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              Organization Admin
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {adminEmail}
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowLogoutModal(true)}
          className="btn btn-secondary btn-sm"
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
        >
          <LogOut size={14} />
          <span>Sign Out</span>
        </button>

        <ConfirmationModal
          isOpen={showLogoutModal}
          onClose={() => setShowLogoutModal(false)}
          onConfirm={handleLogout}
          title="Sign out of ShiftGuard?"
          message={`Are you sure you want to end your session for ${organizationName}? You will need to sign in again to access the admin workspace.`}
          confirmText="Sign Out"
          variant="danger"
        />
      </div>
    </aside>
  );
}
