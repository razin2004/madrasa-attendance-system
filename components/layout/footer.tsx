import React from 'react';
import Link from 'next/link';
import { Shield, Lock, CheckCircle2 } from 'lucide-react';

export function Footer() {
  return (
    <footer
      style={{
        borderTop: '1px solid var(--border-subtle)',
        backgroundColor: 'rgba(3, 7, 18, 0.95)',
        padding: '32px 0 24px 0',
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
            gap: '24px',
            marginBottom: '24px',
          }}
        >
          {/* Brand Info */}
          <div style={{ maxWidth: '380px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #4f46e5 0%, #8b5cf6 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 14px rgba(99, 102, 241, 0.3)',
                }}
              >
                <Shield size={16} color="#ffffff" />
              </div>
              <span style={{ fontSize: '17px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.4px' }}>
                ShiftGuard
              </span>
            </div>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              Next-generation multi-tenant workforce management &amp; attendance infrastructure enforcing 3-Layer verification: Registered Device, Allowed Branch IP, and Valid Geofence GPS.
            </p>
          </div>

          {/* Security & Governance Badges */}
          <div>
            <h4
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.6px',
                color: '#818cf8',
                marginBottom: '10px',
              }}
            >
              Enterprise Standards
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', padding: 0, margin: 0 }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                <CheckCircle2 size={14} color="#34d399" />
                <span>3-Layer Hardware &amp; Geofence Verification</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                <CheckCircle2 size={14} color="#34d399" />
                <span>Super Admin Approval Workflow</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                <CheckCircle2 size={14} color="#34d399" />
                <span>Strict Multi-Tenant Database Isolation</span>
              </li>
            </ul>
          </div>

          {/* Quick Navigation */}
          <div>
            <h4
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.6px',
                color: '#818cf8',
                marginBottom: '10px',
              }}
            >
              Quick Links
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', padding: 0, margin: 0 }}>
              <li>
                <Link href="/login" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
                  Sign In Portal
                </Link>
              </li>
              <li>
                <Link href="/register" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
                  Register Organization
                </Link>
              </li>
              <li>
                <Link href="/super-admin/login" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
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
            paddingTop: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
            fontSize: '11.5px',
            color: 'var(--text-muted)',
          }}
        >
          <div>&copy; {new Date().getFullYear()} ShiftGuard Systems Inc.</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-muted)' }}>
            <Lock size={12} color="#818cf8" />
            <span>Zero-Trust Workforce Platform</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
