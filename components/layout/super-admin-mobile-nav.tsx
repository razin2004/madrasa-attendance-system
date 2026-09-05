'use client';

import React from 'react';
import { Clock, CheckCircle2, Power, XCircle, History } from 'lucide-react';
import { SuperAdminTab } from './super-admin-sidebar';

interface SuperAdminMobileNavProps {
  activeTab: SuperAdminTab;
  onTabChange: (tab: SuperAdminTab) => void;
  counts?: {
    pending: number;
    approved: number;
    suspended?: number;
    rejected: number;
  };
}

export function SuperAdminMobileNav({
  activeTab,
  onTabChange,
  counts = { pending: 0, approved: 0, suspended: 0, rejected: 0 },
}: SuperAdminMobileNavProps) {
  const tabs = [
    { id: 'pending' as const, label: 'Pending', icon: Clock, count: counts.pending },
    { id: 'approved' as const, label: 'Active', icon: CheckCircle2, count: counts.approved },
    { id: 'suspended' as const, label: 'Suspended', icon: Power, count: counts.suspended },
    { id: 'rejected' as const, label: 'Rejected', icon: XCircle, count: counts.rejected },
    { id: 'history' as const, label: 'Audit', icon: History },
  ];

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '64px',
        backgroundColor: 'rgba(13, 18, 31, 0.95)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderTop: '1px solid var(--border-subtle)',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 90,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
      className="super-admin-mobile-nav"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              background: 'transparent',
              border: 'none',
              color: isActive ? '#818cf8' : 'var(--text-muted)',
              fontSize: '11px',
              fontWeight: isActive ? 700 : 500,
              cursor: 'pointer',
              position: 'relative',
              padding: '6px 12px',
              flex: 1,
            }}
          >
            <div style={{ position: 'relative' }}>
              <Icon size={20} color={isActive ? '#818cf8' : 'var(--text-muted)'} />
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-8px',
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    backgroundColor: '#f59e0b',
                    color: '#07090e',
                    fontSize: '9px',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {tab.count}
                </span>
              )}
            </div>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
