'use client';

import React from 'react';
import Image from 'next/image';
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
  return (
    <div style={{ textAlign: 'center', marginBottom: '28px' }}>
      <div
        style={{
          width: '72px',
          height: '72px',
          margin: '0 auto 16px auto',
          borderRadius: '16px',
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
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={`${orgName} Logo`}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              padding: '6px',
            }}
            onError={(e) => {
              // Fallback if image fails to load
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <Building2 size={36} color="#818cf8" />
        )}
      </div>

      <h1
        style={{
          fontSize: '22px',
          fontWeight: 800,
          color: '#ffffff',
          letterSpacing: '-0.3px',
          marginBottom: '6px',
        }}
      >
        {orgName}
      </h1>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
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
          }}
        >
          {organizationCode}
        </span>
        {subtitle && (
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}
