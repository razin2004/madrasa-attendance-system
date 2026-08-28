'use client';

import React from 'react';
import Link from 'next/link';
import { Shield, ArrowLeft, User, LogOut } from 'lucide-react';

interface MobileTopHeaderProps {
  title: string;
  subtitle?: string;
  backHref?: string;
  logoUrl?: string | null;
  organizationName?: string;
  adminEmail?: string;
  onLogout?: () => void;
}

export function MobileTopHeader({
  title,
  subtitle,
  backHref,
  logoUrl,
  organizationName = 'ShiftGuard',
  adminEmail,
  onLogout,
}: MobileTopHeaderProps) {
  const [logoFailed, setLogoFailed] = React.useState(false);

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        backgroundColor: 'rgba(11, 15, 25, 0.92)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border-subtle)',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        paddingTop: 'calc(8px + env(safe-area-inset-top, 0px))',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {backHref ? (
          <Link
            href={backHref}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              color: '#ffffff',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <ArrowLeft size={18} />
          </Link>
        ) : (
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-glow-indigo)',
              flexShrink: 0,
            }}
          >
            {logoUrl && !logoFailed ? (
              <img
                src={logoUrl}
                alt={organizationName}
                style={{ width: '22px', height: '22px', objectFit: 'contain' }}
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <Shield size={18} color="#ffffff" />
            )}
          </div>
        )}

        <div>
          <h1 style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff', margin: 0, lineHeight: 1.2 }}>
            {title}
          </h1>
          {subtitle && (
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.2 }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {onLogout && (
        <button
          onClick={onLogout}
          title="Sign Out"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'rgba(244, 63, 94, 0.1)',
            color: '#fb7185',
            border: '1px solid rgba(244, 63, 94, 0.25)',
            cursor: 'pointer',
          }}
        >
          <LogOut size={16} />
        </button>
      )}
    </header>
  );
}
