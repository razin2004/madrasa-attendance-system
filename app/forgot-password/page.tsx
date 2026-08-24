'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/feedback/toast-provider';
import styles from '../login/Login.module.css';
import {
  Shield,
  Mail,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  KeyRound,
} from 'lucide-react';

export default function ForgotPasswordPage() {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !email.trim().includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setIsSubmitted(true);
        toast.success('Password reset request dispatched.');
      } else {
        setErrorMessage(data.error || 'Failed to submit reset request.');
        toast.error(data.error || 'Request failed.');
      }
    } catch (err) {
      setErrorMessage('Network connection error. Please try again.');
      toast.error('Network error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        <div className={styles.header}>
          <div className={styles.logoContainer}>
            <Shield size={28} color="#ffffff" />
          </div>
          <h1 className={styles.title}>ShiftGuard</h1>
          <p className={styles.subtitle}>Forgot Your Password?</p>
        </div>

        <div className={styles.card}>
          {isSubmitted ? (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(52, 211, 153, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px auto',
                  color: '#34d399',
                }}
              >
                <CheckCircle2 size={28} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', marginBottom: '8px' }}>
                Check Your Email
              </h3>
              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.5' }}>
                If an active account exists for <strong>{email}</strong>, a secure password reset link has been sent. Please check your inbox.
              </p>
              <Link href="/login" className="btn btn-primary" style={{ width: '100%', padding: '12px' }}>
                <span>Return to Sign In</span>
                <ArrowRight size={16} />
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(99, 102, 241, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 12px auto',
                    color: '#818cf8',
                  }}
                >
                  <KeyRound size={20} />
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Enter your account email address. We will send you a secure link to reset your password.
                </p>
              </div>

              {errorMessage && (
                <div className={styles.errorBox}>
                  <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>{errorMessage}</div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label" htmlFor="email">
                  Account Email Address
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="email"
                    type="email"
                    placeholder="e.g. staff@company.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErrorMessage(null);
                    }}
                    disabled={isSubmitting}
                    className="form-input"
                    style={{ paddingLeft: '40px' }}
                    autoComplete="email"
                    required
                  />
                  <Mail
                    size={17}
                    color="var(--text-muted)"
                    style={{ position: 'absolute', left: '14px', top: '13px' }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !email.trim()}
                className="btn btn-primary"
                style={{ width: '100%', padding: '12px', marginTop: '8px' }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Sending Reset Link...</span>
                  </>
                ) : (
                  <>
                    <span>Send Password Reset Link</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          )}

          <div className={styles.footerText}>
            Remember your password?{' '}
            <Link href="/login" className={styles.footerLink}>
              Sign In &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
