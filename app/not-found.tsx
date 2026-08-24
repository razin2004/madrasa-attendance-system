import Link from 'next/link';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(ellipse at top, #131b2e 0%, #0b0f19 100%)',
        color: '#f8fafc',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '24px',
      }}
    >
      <div
        style={{
          maxWidth: '440px',
          width: '100%',
          textAlign: 'center',
          background: 'rgba(19, 27, 46, 0.75)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '40px 28px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4)',
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px auto',
            color: '#f87171',
          }}
        >
          <ShieldAlert size={28} />
        </div>

        <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
          404 — Page Not Found
        </h1>
        <p style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '28px', lineHeight: '1.5' }}>
          The workspace page or branch route you requested does not exist or has been moved.
        </p>

        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#3b82f6',
            color: '#ffffff',
            fontWeight: 600,
            fontSize: '14px',
            padding: '12px 24px',
            borderRadius: '10px',
            textDecoration: 'none',
            transition: 'all 0.2s ease',
          }}
        >
          <ArrowLeft size={16} />
          <span>Return to Home</span>
        </Link>
      </div>
    </div>
  );
}
