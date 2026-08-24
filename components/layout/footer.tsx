import React from 'react';
import Link from 'next/link';
import { Shield, Lock, CheckCircle2 } from 'lucide-react';

export function Footer() {
  return (
    <footer
      style={{
        borderTop: '1px solid var(--border-subtle)',
        backgroundColor: 'rgba(3, 7, 18, 0.95)',
        padding: '52px 0 36px 0',
        marginTop: 'auto',
        position: 'relative',
        zIndex: 10,
      }}
    >
      <div className="container">
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            gap: '40px',
            marginBottom: '40px',
          }}
        >
          {/* Brand Info */}
          <div style={{ maxWidth: '380px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #4f46e5 0%, #8b5cf6 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 14px rgba(99, 102, 241, 0.3)',
                }}
              >
                <Shield size={20} color="#ffffff" />
              </div>
              <span style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.5px' }}>
                ShiftGuard
              </span>
            </div>
            <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: '1.65' }}>
              Next-generation multi-tenant workforce management &amp; attendance infrastructure. Enforcing 3-Layer verification: Registered Device, Allowed Branch IP, and Valid Geofence GPS.
            </p>
          </div>

          {/* Security & Governance Badges */}
          <div>
            <h4
              style={{
                fontSize: '12px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.8px',
                color: '#818cf8',
                marginBottom: '16px',
              }}
            >
              Enterprise Security Standards
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                <CheckCircle2 size={15} color="#34d399" />
                <span>3-Layer Hardware &amp; Geofence Verification</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                <CheckCircle2 size={15} color="#34d399" />
                <span>Super Admin 2FA Approval Workflow</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                <CheckCircle2 size={15} color="#34d399" />
                <span>Strict Multi-Tenant Database Isolation</span>
              </li>
            </ul>
          </div>

          {/* Quick Navigation */}
          <div>
            <h4
              style={{
                fontSize: '12px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.8px',
                color: '#818cf8',
                marginBottom: '16px',
              }}
            >
              Quick Navigation
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <li>
                <Link href="/login" style={{ color: 'var(--text-secondary)', transition: 'color 0.2s' }}>
                  Sign In Portal
                </Link>
              </li>
              <li>
                <Link href="/register" style={{ color: 'var(--text-secondary)', transition: 'color 0.2s' }}>
                  Register Organization
                </Link>
              </li>
              <li>
                <Link href="/super-admin/login" style={{ color: 'var(--text-secondary)', transition: 'color 0.2s' }}>
                  Super Admin Console
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright Footer Line */}
        <div
          style={{
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            fontSize: '12.5px',
            color: 'var(--text-muted)',
          }}
        >
          <div>&copy; {new Date().getFullYear()} ShiftGuard Systems Inc. All rights reserved.</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
            <Lock size={13} color="#818cf8" />
            <span>Zero-Trust Workforce Governance Platform</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
