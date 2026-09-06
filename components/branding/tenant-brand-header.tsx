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
      {/* Auto-scaling Logo (40px on mobile via class, 56px default) */}
      <div
        className="tenant-brand-logo-box"
        style={{
          margin: '0 auto 12px auto',
          borderRadius: '12px',
          background: 'rgba(19, 27, 46, 0.9)',
          border: '1px solid var(--border-medium)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          position: 'relative',
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
              padding: '4px',
              display: 'block',
            }}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <img src="/logo.svg" alt="ShiftGuard Attendance Logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
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
