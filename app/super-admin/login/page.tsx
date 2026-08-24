'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/components/feedback/toast-provider';
import {
  Shield,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const toast = useToast();

  const [step, setStep] = useState<'CREDENTIALS' | 'OTP'>('CREDENTIALS');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState('');
  const [userId, setUserId] = useState('');
  const [emailMasked, setEmailMasked] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Resend cooldown timer (60 seconds)
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (cooldown > 0) {
      interval = setInterval(() => {
        setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [cooldown]);

  // Handle Step 1: Submit Credentials
  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage('Please enter both your email address and password.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/super-admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();

      if (res.ok && data.success && data.requiresOtp) {
        setUserId(data.userId);
        setEmailMasked(data.emailMasked);
        setStep('OTP');
        setCooldown(60);
        toast.info('Verification code sent to your email.');
      } else {
        setErrorMessage(data.error || 'Invalid administrator credentials.');
        toast.error(data.error || 'Authentication failed.');
      }
    } catch (err) {
      setErrorMessage('Unable to connect to authentication server. Please try again.');
      toast.error('Network connection error.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Step 2: Submit OTP
  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanOtp = otp.trim();
    if (cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      setErrorMessage('Please enter the complete 6-digit verification code.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/super-admin/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, otp: cleanOtp }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        toast.success('Super Admin session verified.');
        router.push(data.redirectUrl || '/super-admin/dashboard');
      } else {
        setErrorMessage(data.error || 'Invalid or expired verification code.');
        toast.error(data.error || 'Verification failed.');
      }
    } catch (err) {
      setErrorMessage('Verification network error. Please try again.');
      toast.error('Verification error.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Resend OTP
  const handleResendOtp = async () => {
    if (cooldown > 0 || !userId) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/auth/super-admin/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setCooldown(60);
        toast.success('A new verification code has been dispatched.');
      } else {
        setErrorMessage(data.error || 'Unable to resend code.');
        toast.error(data.error || 'Resend failed.');
      }
    } catch (err) {
      setErrorMessage('Failed to request new code.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
      }}
    >
      <div style={{ width: '100%', maxWidth: '440px' }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #4f46e5 0%, #312e81 100%)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              boxShadow: '0 8px 24px rgba(99, 102, 241, 0.35)',
              marginBottom: '16px',
            }}
          >
            <Shield size={26} color="#ffffff" />
          </Link>
          <h1
            style={{
              fontSize: '24px',
              fontWeight: 800,
              color: '#ffffff',
              letterSpacing: '-0.5px',
              marginBottom: '6px',
            }}
          >
            Super Admin Console
          </h1>
          <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}>
            Platform governance and organization approvals
          </p>
        </div>

        {/* Card */}
        <div className="glass-card" style={{ padding: '32px 28px' }}>
          {errorMessage && (
            <div
              style={{
                backgroundColor: 'var(--danger-bg)',
                border: '1px solid var(--danger-border)',
                color: 'var(--danger-text)',
                padding: '12px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                marginBottom: '20px',
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>{errorMessage}</div>
            </div>
          )}

          {step === 'CREDENTIALS' ? (
            /* STEP 1: Email + Password */
            <form onSubmit={handleCredentialsSubmit} noValidate>
              <div className="form-group">
                <label className="form-label" htmlFor="email">
                  Administrator Email
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="email"
                    type="email"
                    placeholder="admin@shiftguard.io"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErrorMessage(null);
                    }}
                    disabled={isLoading}
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

              <div className="form-group">
                <label className="form-label" htmlFor="password">
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setErrorMessage(null);
                    }}
                    disabled={isLoading}
                    className="form-input"
                    style={{ paddingLeft: '40px', paddingRight: '40px' }}
                    autoComplete="current-password"
                    required
                  />
                  <Lock
                    size={17}
                    color="var(--text-muted)"
                    style={{ position: 'absolute', left: '14px', top: '13px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '12px',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '2px',
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn btn-primary"
                style={{ width: '100%', padding: '12px', marginTop: '8px' }}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <>
                    <span>Next: 2FA Verification</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* STEP 2: 6-Digit OTP Verification */
            <form onSubmit={handleOtpSubmit} noValidate>
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
                  }}
                >
                  <KeyRound size={20} color="#818cf8" />
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>
                  Two-Factor Authentication
                </h3>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Enter the 6-digit code dispatched to <strong>{emailMasked}</strong>
                </p>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="otp" style={{ textAlign: 'center' }}>
                  6-Digit Verification Code
                </label>
                <input
                  id="otp"
                  type="text"
                  maxLength={6}
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setOtp(val);
                    setErrorMessage(null);
                  }}
                  disabled={isLoading}
                  className="form-input"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '24px',
                    fontWeight: 800,
                    letterSpacing: '8px',
                    textAlign: 'center',
                    padding: '12px',
                  }}
                  autoFocus
                  required
                />
                <div className="form-hint" style={{ textAlign: 'center' }}>
                  Code expires in 5 minutes.
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || otp.length !== 6}
                className="btn btn-primary"
                style={{ width: '100%', padding: '12px', marginTop: '8px' }}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Authorizing Session...</span>
                  </>
                ) : (
                  <>
                    <span>Verify &amp; Sign In</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              {/* Action Buttons: Back & Resend */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: '20px',
                  paddingTop: '16px',
                  borderTop: '1px solid var(--border-subtle)',
                  fontSize: '13px',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setStep('CREDENTIALS');
                    setOtp('');
                    setErrorMessage(null);
                  }}
                  className="btn btn-ghost btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px' }}
                >
                  <ArrowLeft size={14} />
                  <span>Back to login</span>
                </button>

                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={cooldown > 0 || isLoading}
                  className="btn btn-ghost btn-sm"
                  style={{
                    color: cooldown > 0 ? 'var(--text-muted)' : '#818cf8',
                    padding: '4px 8px',
                  }}
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Code'}
                </button>
              </div>
            </form>
          )}

          <div
            style={{
              textAlign: 'center',
              marginTop: '24px',
              paddingTop: '16px',
              borderTop: '1px solid var(--border-subtle)',
              fontSize: '12.5px',
              color: 'var(--text-muted)',
            }}
          >
            Looking for Workspace login?{' '}
            <Link href="/" style={{ color: '#818cf8', fontWeight: 600 }}>
              Return to ShiftGuard &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
