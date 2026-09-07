'use client';

import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Clock,
  CheckCircle2,
  History,
  Menu,
  X,
  Power,
  XCircle,
  Settings,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import { SuperAdminTab } from './super-admin-sidebar';
import { useRouter } from 'next/navigation';
import { useMobileNavScroll } from '@/hooks/use-mobile-nav-scroll';

interface SuperAdminMobileNavProps {
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

export function SuperAdminMobileNav({
  activeTab,
  onTabChange,
  counts = { pending: 0, approved: 0, suspended: 0, rejected: 0 },
  adminEmail,
}: SuperAdminMobileNavProps) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isVisible = useMobileNavScroll();

  const primaryTabs = [
    { id: 'overview' as const, label: 'Overview', icon: LayoutDashboard },
    { id: 'pending' as const, label: 'Pending', icon: Clock, count: counts.pending },
    { id: 'approved' as const, label: 'Active', icon: CheckCircle2, count: counts.approved },
    { id: 'history' as const, label: 'Audit', icon: History },
  ];

  const secondaryTabs = [
    { id: 'suspended' as const, label: 'Suspended Orgs', icon: Power, count: counts.suspended, color: '#f87171' },
    { id: 'rejected' as const, label: 'Rejected Applications', icon: XCircle, count: counts.rejected, color: '#fb7185' },
  ];

  const handleSignOut = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore
    }
    router.push('/super-admin/login');
  };

  return (
    <>
      {/* Slide-Up Drawer for "More" Line Button Selection */}
      {drawerOpen && (
        <>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(3, 7, 18, 0.8)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              zIndex: 9998,
            }}
            onClick={() => setDrawerOpen(false)}
          />
          <div
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: '#0b0f19',
              borderTopLeftRadius: '20px',
              borderTopRightRadius: '20px',
              borderTop: '1px solid var(--border-medium)',
              padding: '20px 20px calc(24px + env(safe-area-inset-bottom, 0px)) 20px',
              zIndex: 9999,
              boxShadow: '0 -10px 40px rgba(0,0,0,0.9)',
              maxHeight: '85vh',
              overflowY: 'auto',
            }}
          >
            {/* Drawer Handle */}
            <div
              style={{
                width: '36px',
                height: '4px',
                borderRadius: '2px',
                backgroundColor: 'rgba(255,255,255,0.2)',
                margin: '0 auto 16px auto',
              }}
            />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ fontWeight: 800, fontSize: '16px', color: '#ffffff' }}>
                Platform Control &amp; Navigation
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
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

            {/* Secondary Navigation Items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {secondaryTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      onTabChange(tab.id);
                      setDrawerOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      backgroundColor: isActive ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                      border: `1px solid ${isActive ? 'rgba(99, 102, 241, 0.35)' : 'var(--border-subtle)'}`,
                      width: '100%',
                      cursor: 'pointer',
                      textAlign: 'left',
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
                        <Icon size={18} color={isActive ? '#ffffff' : tab.color || '#818cf8'} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#ffffff' }}>
                          {tab.label}
                        </div>
                        {tab.count !== undefined && (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {tab.count} {tab.count === 1 ? 'record' : 'records'}
                          </div>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={16} color="var(--text-muted)" />
                  </button>
                );
              })}
            </div>

            {/* Logout Button */}
            <button
              onClick={() => {
                setDrawerOpen(false);
                handleSignOut();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                backgroundColor: 'rgba(244, 63, 94, 0.12)',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                color: '#fb7185',
                fontWeight: 700,
                fontSize: '13.5px',
                cursor: 'pointer',
              }}
            >
              <LogOut size={16} />
              <span>Sign Out of Platform</span>
            </button>
          </div>
        </>
      )}

      {/* Primary 5-Item Fixed Bottom Navigation Bar */}
      <nav
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '60px',
          backgroundColor: 'rgba(11, 15, 25, 0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          zIndex: 90,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          transform: isVisible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.5)',
        }}
        className="super-admin-mobile-nav"
        aria-label="Super Admin mobile bottom navigation"
      >
        {primaryTabs.map((tab) => {
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
                gap: '3px',
                background: 'transparent',
                border: 'none',
                color: isActive ? '#818cf8' : 'var(--text-muted)',
                fontSize: '11px',
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                position: 'relative',
                padding: '6px 0',
                flex: 1,
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
              <div style={{ position: 'relative' }}>
                <Icon size={19} color={isActive ? '#818cf8' : 'var(--text-muted)'} />
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

        {/* 5th Item: More Button with Line Menu Icon */}
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Open secondary navigation menu"
          aria-expanded={drawerOpen}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3px',
            background: 'transparent',
            border: 'none',
            color: drawerOpen || activeTab === 'suspended' || activeTab === 'rejected' ? '#818cf8' : 'var(--text-muted)',
            fontSize: '11px',
            fontWeight: drawerOpen || activeTab === 'suspended' || activeTab === 'rejected' ? 700 : 500,
            cursor: 'pointer',
            flex: 1,
            padding: '6px 0',
            position: 'relative',
          }}
        >
          {(activeTab === 'suspended' || activeTab === 'rejected') && (
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
          <Menu size={19} color={drawerOpen || activeTab === 'suspended' || activeTab === 'rejected' ? '#818cf8' : 'var(--text-muted)'} />
          <span>Others</span>
        </button>
      </nav>
    </>
  );
}
