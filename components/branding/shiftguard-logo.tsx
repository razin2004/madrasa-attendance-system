'use client';

import React from 'react';
import Link from 'next/link';

interface ShiftGuardLogoProps {
  size?: number;
  showText?: boolean;
  textSize?: string;
  href?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function ShiftGuardLogo({
  size = 32,
  showText = true,
  textSize = '18px',
  href,
  className,
  style,
}: ShiftGuardLogoProps) {
  const content = (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '10px',
        userSelect: 'none',
        textDecoration: 'none',
        ...style,
      }}
    >
      {/* Universal ShiftGuard SVG Logo Emblem */}
      <img
        src="/logo.svg"
        alt="ShiftGuard Logo"
        width={size}
        height={size}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          objectFit: 'contain',
          flexShrink: 0,
          display: 'block',
        }}
      />

      {showText && (
        <span
          style={{
            fontSize: textSize,
            fontWeight: 800,
            letterSpacing: '-0.4px',
            color: '#ffffff',
            lineHeight: 1,
            whiteSpace: 'nowrap',
          }}
        >
          Shift<span style={{ color: '#38bdf8' }}>Guard</span>
        </span>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} style={{ textDecoration: 'none', display: 'inline-flex' }}>
        {content}
      </Link>
    );
  }

  return content;
}
