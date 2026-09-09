'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Clock,
  Calendar,
  MapPin,
  FileText,
  Menu,
  X,
  LogOut,
  ChevronRight,
  ShieldCheck,
  Building,
  Settings,
  RefreshCw,
  ClipboardCheck,
  UserCheck,
} from 'lucide-react';
import { useToast } from '../feedback/toast-provider';
import { useMobileNavScroll } from '@/hooks/use-mobile-nav-scroll';
import { ConfirmationModal } from '../feedback/confirmation-modal';

interface OrgAdminMobileNavProps {
  organizationCode: string;
}

export function OrgAdminMobileNav({ organizationCode }: OrgAdminMobileNavProps) {
  const rawPathname = usePathname();
  const pathname = rawPathname || '';
  const router = useRouter();
  const toast = useToast();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const isNavVisible = useMobileNavScroll();

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      toast.info('Signed out of organization workspace.');
      router.push(`/${organizationCode}/login`);
    } catch {
      router.push(`/${organizationCode}/login`);
    }
  };

  const primaryItems = [
    {
      label: 'Overview',
      href: `/${organizationCode}/admin`,
      icon: LayoutDashboard,
      exact: true,
    },
    {
      label: 'Attendance',
      href: `/${organizationCode}/admin/attendance`,
      icon: Clock,
      exact: false,
    },
    {
      label: 'Staff',
      href: `/${organizationCode}/admin/staff`,
      icon: Users,
      exact: false,
    },
  ];

  const secondaryItems = [
    {
      label: 'Daily Attendance',
      href: `/${organizationCode}/admin/attendance`,
      icon: ClipboardCheck,
      exact: true,
      subtext: 'View live attendance log & clock status',
    },
    {
      label: 'Attendance Corrections',
      href: `/${organizationCode}/admin/attendance/corrections`,
      icon: ShieldCheck,
      subtext: 'Review & approve correction requests',
    },
    {
      label: 'Manual Attendance',
      href: `/${organizationCode}/admin/attendance/manual`,
      icon: UserCheck,
      subtext: 'Manually record or edit attendance logs',
    },
    {
      label: 'Branches',
      href: `/${organizationCode}/admin/branches`,
      icon: MapPin,
      subtext: 'Manage workplace locations & IP geofences',
    },
    {
      label: 'Shifts & Roster',
      href: `/${organizationCode}/admin/shifts`,
      icon: Clock,
      exact: true,
      subtext: 'Create recurring schedules & staff assignments',
    },
    {
      label: 'Roster Calendar',
      href: `/${organizationCode}/admin/roster`,
      icon: Calendar,
      subtext: 'View weekly staff allocation matrix',
    },
    {
      label: 'Shift Swapping',
      href: `/${organizationCode}/admin/shifts/swaps`,
      icon: RefreshCw,
      subtext: 'Review & approve peer shift swap requests',
    },
    {
      label: 'Leave Management',
      href: `/${organizationCode}/admin/leave`,
      icon: ShieldCheck,
      subtext: 'Approve & track employee leave requests',
    },
    {
      label: 'Reports & Analytics',
      href: `/${organizationCode}/admin/reports`,
      icon: FileText,
      subtext: 'Export daily & monthly attendance CSV/PDF',
    },
    {
      label: 'Settings',
      href: `/${organizationCode}/admin/settings`,
      icon: Settings,
      subtext: 'Configure workspace details & branding',
    },
  ];

  return (
    <>
      {/* Slide-Up Drawer Overlay */}
      {drawerOpen && (
        <>
          <div
            className="mobile-drawer-backdrop"
            onClick={() => setDrawerOpen(false)}
          />
          <div
            className="mobile-drawer-sheet"
            style={{
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '85vh',
              overflow: 'hidden',
              padding: 0,
            }}
          >
            {/* Sticky Top Header */}
            <div
              style={{
                padding: '16px 20px 12px 20px',
                borderBottom: '1px solid var(--border-subtle)',
                backgroundColor: '#0b0f19',
                position: 'sticky',
                top: 0,
                zIndex: 10,
                flexShrink: 0,
              }}
            >
              <div className="mobile-drawer-handle" style={{ marginBottom: '12px' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 800, fontSize: '16px', color: '#ffffff' }}>
                  Admin Operations Navigation
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close navigation menu"
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '30px',
                    height: '30px',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Scrollable Secondary Items List */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {secondaryItems.map((item) => {
                const Icon = item.icon;
                const isActive = item.exact
                  ? pathname === item.href
                  : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setDrawerOpen(false)}
                    aria-current={isActive ? 'page' : undefined}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: isActive ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                      border: `1px solid ${isActive ? 'rgba(99, 102, 241, 0.35)' : 'var(--border-subtle)'}`,
                      textDecoration: 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          backgroundColor: isActive ? '#4f46e5' : 'rgba(255, 255, 255, 0.06)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Icon size={18} color={isActive ? '#ffffff' : '#818cf8'} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#ffffff' }}>
                          {item.label}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {item.subtext}
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={16} color="var(--text-muted)" />
                  </Link>
                );
              })}
            </div>

            {/* Sticky Bottom Sign Out Section */}
            <div
              style={{
                padding: '12px 20px calc(16px + env(safe-area-inset-bottom, 0px)) 20px',
                borderTop: '1px solid var(--border-subtle)',
                backgroundColor: '#0b0f19',
                position: 'sticky',
                bottom: 0,
                zIndex: 10,
                flexShrink: 0,
              }}
            >
              <button
                onClick={() => setShowLogoutModal(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(244, 63, 94, 0.12)',
                  border: '1px solid rgba(244, 63, 94, 0.3)',
                  color: '#fb7185',
                  fontWeight: 700,
                  fontSize: '13.5px',
                  cursor: 'pointer',
                }}
              >
                <LogOut size={16} />
                <span>Sign Out of Workspace</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Primary Fixed Bottom Navigation Bar */}
      <nav
        aria-label="Org Admin mobile navigation"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 'calc(60px + env(safe-area-inset-bottom, 0px))',
          backgroundColor: 'rgba(11, 15, 25, 0.94)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          zIndex: 90,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.5)',
          transform: isNavVisible ? 'translateY(0)' : 'translateY(120%)',
          transition: 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
          willChange: 'transform',
        }}
        className="org-admin-mobile-nav"
      >
        {primaryItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '3px',
                color: isActive ? '#818cf8' : 'var(--text-muted)',
                fontSize: '11px',
                fontWeight: isActive ? 700 : 500,
                textDecoration: 'none',
                flex: 1,
                padding: '6px 0',
                position: 'relative',
              }}
            >
              {isActive && (
                <span
                  style={{
                    position: 'absolute',
                    top: 0,
                    width: '24px',
                    height: '2.5px',
                    backgroundColor: '#818cf8',
                    borderRadius: '2px',
                    boxShadow: '0 0 8px #818cf8',
                  }}
                />
              )}
              <Icon size={19} color={isActive ? '#818cf8' : 'var(--text-muted)'} />
              <span>{item.label}</span>
            </Link>
          );
        })}

        {/* More Menu Trigger */}
        {(() => {
          const isSecondaryActive = secondaryItems.some((item) =>
            item.exact ? pathname === item.href : pathname.startsWith(item.href)
          );
          const isMoreActive = drawerOpen || isSecondaryActive;
          return (
            <button
              onClick={() => setDrawerOpen(!drawerOpen)}
              aria-label={drawerOpen ? 'Close navigation menu' : 'Open full admin menu'}
              aria-expanded={drawerOpen}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '3px',
                color: isMoreActive ? '#818cf8' : 'var(--text-muted)',
                fontSize: '11px',
                fontWeight: isMoreActive ? 700 : 500,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                flex: 1,
                padding: '6px 0',
                position: 'relative',
              }}
            >
              {isMoreActive && (
                <span
                  style={{
                    position: 'absolute',
                    top: 0,
                    width: '24px',
                    height: '2.5px',
                    backgroundColor: '#818cf8',
                    borderRadius: '2px',
                    boxShadow: '0 0 8px #818cf8',
                  }}
                />
              )}
              {drawerOpen ? <X size={19} color="#818cf8" /> : <Menu size={19} color={isMoreActive ? '#818cf8' : 'var(--text-muted)'} />}
              <span>{drawerOpen ? 'Close' : 'More'}</span>
            </button>
          );
        })()}
      </nav>

      <ConfirmationModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={() => {
          setShowLogoutModal(false);
          setDrawerOpen(false);
          handleLogout();
        }}
        title="Sign Out of Workspace?"
        message="Are you sure you want to end your session for this workspace? You will need to sign in again to access the admin panel."
        confirmText="Sign Out"
        variant="danger"
      />
    </>
  );
}
