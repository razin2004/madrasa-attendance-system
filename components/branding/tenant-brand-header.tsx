'use client';

import React from 'react';
import { Building2 } from 'lucide-react';

interface TenantBrandHeaderProps {
  orgName: string;
  logoUrl?: string | null;
  organizationCode: string;
  subtitle?: string;
}

export function TenantBrandHeader({
  orgName,
  logoUrl,
  organizationCode,
  subtitle,
}: TenantBrandHeaderProps) {
  const [imgFailed, setImgFailed] = React.useState(false);

  return (
    <div style={{ textAlign: 'center', marginBottom: '20px', width: '100%' }}>
      {/* Auto-scaling Logo (52px on mobile via class, 64px default) */}
      <div
        className="tenant-brand-logo-box"
        style={{
          width: '64px',
          height: '64px',
          margin: '0 auto 14px auto',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, rgba(19, 27, 46, 0.95), rgba(30, 41, 59, 0.95))',
          border: '1px solid rgba(255, 255, 255, 0.18)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(99, 102, 241, 0.25)',
          position: 'relative',
          padding: '4px',
        }}
      >
        {logoUrl && !imgFailed ? (
          <img
            src={logoUrl}
            alt={`${orgName} Logo`}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: 'block',
            }}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <img src="/logo.svg" alt="ShiftGuard Attendance Logo" style={{ width: '38px', height: '38px', objectFit: 'contain' }} />
        )}
      </div>

      <h1
        style={{
          fontSize: '20px',
          fontWeight: 800,
          color: '#ffffff',
          letterSpacing: '-0.3px',
          marginBottom: '6px',
          overflowWrap: 'anywhere',
          wordBreak: 'break-word',
          padding: '0 4px',
        }}
      >
        {orgName}
      </h1>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          padding: '0 4px',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            fontWeight: 700,
            color: '#38bdf8',
            backgroundColor: 'rgba(6, 182, 212, 0.12)',
            border: '1px solid rgba(6, 182, 212, 0.3)',
            padding: '2px 8px',
            borderRadius: '4px',
            letterSpacing: '0.5px',
            whiteSpace: 'nowrap',
          }}
        >
          {organizationCode}
        </span>
        {subtitle && (
          <span
            style={{
              fontSize: '12.5px',
              color: 'var(--text-secondary)',
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
            }}
          >
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}
