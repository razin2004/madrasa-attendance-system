'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { CheckCircle2, Clock, Mail, Shield, ArrowRight } from 'lucide-react';

function SuccessContent() {
  const searchParams = useSearchParams();
  const orgName = searchParams.get('name') || 'Your Organization';

  return (
    <div className="container" style={{ maxWidth: '580px', padding: '60px 20px' }}>
      <div className="glass-card" style={{ padding: '48px 36px', textAlign: 'center' }}>
        {/* Animated Checkmark Circle */}
        <div
          style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            border: '2px solid rgba(16, 185, 129, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px auto',
            boxShadow: '0 0 30px rgba(16, 185, 129, 0.25)',
          }}
        >
          <CheckCircle2 size={38} color="#34d399" />
        </div>

        <span className="badge badge-pending" style={{ marginBottom: '16px' }}>
          Status: Application Under Review
        </span>

        <h1
          style={{
            fontSize: '24px',
            fontWeight: 800,
            color: '#ffffff',
            letterSpacing: '-0.5px',
            marginBottom: '12px',
          }}
        >
          Registration Submitted Successfully
        </h1>

        <p
          style={{
            fontSize: '15px',
            color: 'var(--text-secondary)',
            lineHeight: '1.6',
            marginBottom: '28px',
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
            padding: '20px',
            textAlign: 'left',
            marginBottom: '32px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
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
              <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#f8fafc' }}>
                Super Admin Verification
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
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
              <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#f8fafc' }}>
                Email Notification
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                Upon approval, your unique Organization Code, Administrator credentials, and workspace login URL will be delivered to your registered contact email.
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <Link href="/" className="btn btn-primary" style={{ width: '100%', padding: '12px 24px' }}>
          <span>Return to Homepage</span>
          <ArrowRight size={16} />
        </Link>
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
