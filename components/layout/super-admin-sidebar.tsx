'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Shield,
  Clock,
  CheckCircle2,
  XCircle,
  History,
  LogOut,
  User,
  Power,
  Building2,
  LayoutDashboard,
} from 'lucide-react';
import { useToast } from '../feedback/toast-provider';

import { ConfirmationModal } from '../feedback/confirmation-modal';

export type SuperAdminTab = 'overview' | 'pending' | 'approved' | 'suspended' | 'rejected' | 'history';

interface SuperAdminSidebarProps {
  activeTab: SuperAdminTab;
  onTabChange: (tab: SuperAdminTab) => void;
  counts?: {
    pending: number;
    approved: number;
    suspended?: number;
    rejected: number;
  };
  adminEmail?: string;
}

export function SuperAdminSidebar({
  activeTab,
  onTabChange,
  counts = { pending: 0, approved: 0, suspended: 0, rejected: 0 },
  adminEmail = 'Super Admin',
}: SuperAdminSidebarProps) {
  const router = useRouter();
  const toast = useToast();
  const [showLogoutModal, setShowLogoutModal] = React.useState(false);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      toast.info('Signed out of Super Admin portal.');
      router.push('/super-admin/login');
    } catch (err) {
      router.push('/super-admin/login');
    } finally {
      setShowLogoutModal(false);
    }
  };

  const navItems = [
    {
      id: 'overview' as const,
      label: 'Platform Overview',
      icon: LayoutDashboard,
    },
    {
      id: 'pending' as const,
      label: 'Pending Approvals',
      icon: Clock,
      count: counts.pending,
      badgeColor: counts.pending > 0 ? '#f59e0b' : undefined,
    },
    {
      id: 'approved' as const,
      label: 'Active Organizations',
      icon: CheckCircle2,
      count: counts.approved,
    },
    {
      id: 'suspended' as const,
      label: 'Deactivated / Suspended',
      icon: Power,
      count: counts.suspended || 0,
      badgeColor: counts.suspended && counts.suspended > 0 ? '#f87171' : undefined,
    },
    {
      id: 'rejected' as const,
      label: 'Rejected Applications',
      icon: XCircle,
      count: counts.rejected,
    },
    {
      id: 'history' as const,
      label: 'Audit & Decision History',
      icon: History,
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
      className="super-admin-desktop-sidebar"
    >
      {/* Brand Header */}
      <div
        style={{
          padding: '24px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #4f46e5 0%, #312e81 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)',
          }}
        >
          <Shield size={20} color="#ffffff" />
        </div>
        <div>
          <div style={{ fontSize: '17px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.3px' }}>
            ShiftGuard
          </div>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: '#38bdf8',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Super Admin Console
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
          Organization Governance
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: 'none',
                background: isActive ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                color: isActive ? '#818cf8' : 'var(--text-secondary)',
                fontWeight: isActive ? 600 : 500,
                fontSize: '13.5px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Icon size={18} color={isActive ? '#818cf8' : 'var(--text-muted)'} />
                <span>{item.label}</span>
              </div>
              {item.count !== undefined && (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    backgroundColor: item.badgeColor ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                    color: item.badgeColor || 'var(--text-muted)',
                  }}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Admin User Footer & Logout (Fixed at Bottom) */}
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
              Super Administrator
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
          message="Are you sure you want to end your Super Admin session? You will need to enter your credentials and 2FA code again."
          confirmText="Sign Out"
          variant="danger"
        />
      </div>
    </aside>
  );
}
