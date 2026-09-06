'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { CheckCircle2, Clock, Mail, ArrowRight, Home, LogIn } from 'lucide-react';

function SuccessContent() {
  const searchParams = useSearchParams();
  const orgName = searchParams.get('name') || 'Your Organization';

  return (
    <div className="container" style={{ maxWidth: '580px', padding: '40px 16px' }}>
      <div className="glass-card" style={{ padding: '32px 20px', textAlign: 'center' }}>
        {/* Responsive Centered 48px Checkmark Icon Circle */}
        <div
          className="success-checkmark-circle"
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            border: '2px solid rgba(16, 185, 129, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px auto',
            boxShadow: '0 0 25px rgba(16, 185, 129, 0.25)',
          }}
        >
          <CheckCircle2 size={26} color="#34d399" />
        </div>

        <span className="badge badge-pending" style={{ marginBottom: '14px' }}>
          Status: Application Under Review
        </span>

        <h1
          style={{
            fontSize: '22px',
            fontWeight: 800,
            color: '#ffffff',
            letterSpacing: '-0.4px',
            marginBottom: '10px',
          }}
        >
          Registration Submitted Successfully
        </h1>

        <p
          style={{
            fontSize: '14px',
            color: 'var(--text-secondary)',
            lineHeight: '1.55',
            marginBottom: '24px',
          }}
        >
          Thank you for registering <strong>{orgName}</strong> with ShiftGuard.
        </p>

        {/* Steps Box */}
        <div
          style={{
            backgroundColor: 'rgba(13, 18, 31, 0.8)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            textAlign: 'left',
            marginBottom: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: '#818cf8',
              }}
            >
              <Clock size={15} />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>
                Super Admin Verification
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.45' }}>
                Our platform administrators are currently reviewing your organization details.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: 'rgba(6, 182, 212, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: '#38bdf8',
              }}
            >
              <Mail size={15} />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>
                Email Delivery Notification
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.45' }}>
                Upon approval, your unique Organization Code, Administrator credentials, and workspace login URL will be delivered to your registered contact email.
              </div>
            </div>
          </div>
        </div>

        {/* Stacked Full-Width Action Buttons with 42px Touch Target */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
          <Link
            href="/"
            className="btn btn-primary"
            style={{ width: '100%', minHeight: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px 18px', fontSize: '14px' }}
          >
            <Home size={16} />
            <span>Return to Homepage</span>
            <ArrowRight size={16} />
          </Link>

          <Link
            href="/login"
            className="btn btn-secondary"
            style={{ width: '100%', minHeight: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px 18px', fontSize: '14px' }}
          >
            <LogIn size={16} color="#818cf8" />
            <span>Sign In to Existing Account</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function RegistrationSuccessPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <Suspense fallback={<div className="container" style={{ padding: '60px 20px', textAlign: 'center' }}>Loading confirmation...</div>}>
          <SuccessContent />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
