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
        backgroundColor: 'rgba(3, 7, 18, 0.75)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <div
        className="container"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '76px',
        }}
      >
        {/* Brand Logo */}
        <Link
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            textDecoration: 'none',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #4f46e5 0%, #8b5cf6 100%)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(99, 102, 241, 0.4)',
            }}
          >
            <Shield size={24} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontSize: '20px',
                  fontWeight: 800,
                  letterSpacing: '-0.5px',
                  color: '#ffffff',
                }}
              >
                ShiftGuard
              </span>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: '#a5f3fc',
                  background: 'rgba(6, 182, 212, 0.15)',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  border: '1px solid rgba(6, 182, 212, 0.3)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                ENTERPRISE 3.0
              </span>
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 500 }}>
              Workforce &amp; Attendance Infrastructure
            </div>
          </div>
        </Link>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/login" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <LogIn size={15} />
            <span>Sign In</span>
          </Link>

          <Link href="/register" className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Building2 size={15} />
            <span>Register Organization</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </header>
  );
}
