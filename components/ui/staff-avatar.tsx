'use client';

import React, { useState } from 'react';

interface StaffAvatarProps {
  name?: string | null;
  avatarUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'hero' | number;
  className?: string;
  showStatus?: boolean;
  status?: 'ACTIVE' | 'PENDING' | 'DEACTIVATED' | 'INACTIVE';
  style?: React.CSSProperties;
}

export function StaffAvatar({
  name = 'Staff Member',
  avatarUrl,
  size = 'md',
  className = '',
  showStatus = false,
  status = 'ACTIVE',
  style,
}: StaffAvatarProps) {
  const [imgError, setImgError] = useState(false);

  const getDimension = (): number => {
    if (typeof size === 'number') return size;
    switch (size) {
      case 'xs':
        return 24;
      case 'sm':
        return 32;
      case 'md':
        return 40;
      case 'lg':
        return 48;
      case 'xl':
        return 64;
      case '2xl':
        return 80;
      case 'hero':
        return 96;
      default:
        return 40;
    }
  };

  const dim = getDimension();
  const fontPx = Math.max(10, Math.floor(dim * 0.38));

  const getInitials = (n?: string | null) => {
    if (!n || !n.trim()) return 'ST';
    const parts = n.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const initials = getInitials(name);

  const getGradient = (str?: string | null) => {
    const gradients = [
      'linear-gradient(135deg, #6366f1 0%, #38bdf8 100%)',
      'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
      'linear-gradient(135deg, #3b82f6 0%, #10b981 100%)',
      'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
      'linear-gradient(135deg, #06b6d4 0%, #6366f1 100%)',
    ];
    if (!str) return gradients[0];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % gradients.length;
    return gradients[idx];
  };

  const hasValidImage = Boolean(avatarUrl && avatarUrl.trim() && !imgError);

  const statusColor =
    status === 'ACTIVE'
      ? '#34d399'
      : status === 'PENDING'
      ? '#fbbf24'
      : '#f87171';

  const dotSize = Math.max(8, Math.floor(dim * 0.26));

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: dim,
        height: dim,
        borderRadius: '50%',
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    >
      {hasValidImage ? (
        <img
          src={avatarUrl!}
          alt={name || 'Staff Avatar'}
          onError={() => setImgError(true)}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            objectFit: 'cover',
            display: 'block',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
          }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            background: getGradient(name),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontWeight: 800,
            fontSize: fontPx,
            letterSpacing: '-0.02em',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
            textTransform: 'uppercase',
            userSelect: 'none',
          }}
        >
          {initials}
        </div>
      )}

      {showStatus && (
        <span
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: dotSize,
            height: dotSize,
            borderRadius: '50%',
            backgroundColor: statusColor,
            border: '2px solid #0f172a',
          }}
        />
      )}
    </div>
  );
}
