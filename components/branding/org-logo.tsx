'use client';

import React, { useState, useEffect } from 'react';
import { Building2 } from 'lucide-react';

interface OrgLogoProps {
  logoUrl?: string | null;
  name: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function OrgLogo({ logoUrl, name, size = 20, className, style }: OrgLogoProps) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [logoUrl]);

  const cleanName = (name || 'Organization').trim();
  const initial = cleanName.charAt(0).toUpperCase() || 'O';

  if (logoUrl && !hasError) {
    return (
      <img
        src={logoUrl}
        alt={cleanName}
        className={className}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
          ...style,
        }}
        onError={() => setHasError(true)}
      />
    );
  }

  return (
    <div
      className={className}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(56, 189, 248, 0.25) 100%)',
        color: '#38bdf8',
        fontWeight: 800,
        fontSize: `${Math.max(12, Math.round(size * 0.7))}px`,
        userSelect: 'none',
        ...style,
      }}
    >
      {initial ? initial : <Building2 size={size} color="#818cf8" />}
    </div>
  );
}
