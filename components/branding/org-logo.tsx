'use client';

import React, { useState } from 'react';
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

  if (logoUrl && !hasError) {
    return (
      <img
        src={logoUrl}
        alt={name}
        className={className}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          padding: '2px',
          ...style,
        }}
        onError={() => setHasError(true)}
      />
    );
  }

  return <Building2 size={size} color="#818cf8" className={className} style={style} />;
}
