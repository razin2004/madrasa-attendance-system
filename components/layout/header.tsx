'use client';

import React from 'react';
import Link from 'next/link';
import { Shield, Building2, LogIn, ArrowRight } from 'lucide-react';

export function Header() {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        backgroundColor: 'rgba(3, 7, 18, 0.85)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <div
        className="container"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: '60px',
          paddingTop: '8px',
          paddingBottom: '8px',
        }}
      >
        {/* Brand Logo */}
        <Link
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            textDecoration: 'none',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #4f46e5 0%, #8b5cf6 100%)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(99, 102, 241, 0.4)',
              flexShrink: 0,
            }}
          >
            <img
              src="/icon.svg"
              alt="ShiftGuard Logo"
              style={{ width: '24px', height: '24px', objectFit: 'contain' }}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  fontSize: '17px',
                  fontWeight: 800,
                  letterSpacing: '-0.4px',
                  color: '#ffffff',
                }}
              >
                ShiftGuard
              </span>
              <span
                style={{
                  fontSize: '9px',
                  fontWeight: 800,
                  color: '#a5f3fc',
                  background: 'rgba(6, 182, 212, 0.15)',
                  padding: '2px 6px',
                  borderRadius: '10px',
                  border: '1px solid rgba(6, 182, 212, 0.3)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                }}
              >
                3.0
              </span>
            </div>
            <div
              className="desktop-only-subtitle"
              style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}
            >
              Workforce &amp; Attendance
            </div>
          </div>
        </Link>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Link
            href="/login"
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 12px', fontSize: '12.5px' }}
          >
            <LogIn size={14} />
            <span>Sign In</span>
          </Link>

          <Link
            href="/register"
            className="btn btn-primary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 12px', fontSize: '12.5px' }}
          >
            <Building2 size={14} />
            <span>Register</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
