'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/components/feedback/toast-provider';
import styles from '../login/Login.module.css';
import {
  Shield,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

function ActivateAccountForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const token = searchParams.get('token');

  const [isLoadingToken, setIsLoadingToken] = useState(true);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<{ name: string; email: string; orgName: string; role?: string } | null>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isActivated, setIsActivated] = useState(false);

  useEffect(() => {
    if (!token) {
      setTokenError('Activation token is missing from the link.');
      setIsLoadingToken(false);
      return;
    }

    const validateToken = async () => {
      try {
        const res = await fetch(`/api/auth/activate-account?token=${encodeURIComponent(token)}`);
        const data = await res.json();

        if (res.ok && data.success) {
          setUserInfo(data.user);
        } else {
          setTokenError(data.error || 'Invalid or expired activation link.');
        }
      } catch (err) {
        setTokenError('Network error while validating activation link.');
      } finally {
        setIsLoadingToken(false);
      }
    };

    validateToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!password || password.length < 8) {
      setSubmitError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setSubmitError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/activate-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setIsActivated(true);
        toast.success('Account activated! You can now sign in.');
      } else {
        setSubmitError(data.error || 'Failed to activate account.');
        toast.error(data.error || 'Activation failed.');
      }
    } catch (err) {
      setSubmitError('Network error during account setup.');
      toast.error('Network error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingToken) {
    return (
      <div style={{ textAlign: 'center', color: '#ffffff', padding: '40px 0' }}>
        <Loader2 size={36} className="animate-spin" style={{ margin: '0 auto 16px auto', color: '#818cf8' }} />
        <p>Verifying activation invitation link...</p>
      </div>
    );
  }

  return (
    <>
      {tokenError ? (
        <div style={{ textAlign: 'center', padding: '12px 0' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: 'rgba(244, 63, 94, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto',
              color: '#fda4af',
            }}
          >
            <AlertCircle size={24} />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', marginBottom: '8px' }}>
            Activation Link Invalid
          </h3>
          <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.5' }}>
            {tokenError}
          </p>
          <Link href="/login" className="btn btn-primary" style={{ width: '100%', padding: '12px' }}>
            Go to Sign In
          </Link>
        </div>
      ) : isActivated ? (
        <div style={{ textAlign: 'center', padding: '12px 0' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              backgroundColor: 'rgba(52, 211, 153, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto',
              color: '#34d399',
              border: '1px solid rgba(52, 211, 153, 0.3)',
            }}
          >
            <CheckCircle2 size={30} />
          </div>
          <h3 style={{ fontSize: '19px', fontWeight: 800, color: '#f8fafc', marginBottom: '8px' }}>
            Password Set &amp; Account Activated!
          </h3>
          <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: '1.5' }}>
            Your account password has been created successfully. You can now log in using your email address and password.
          </p>

          {/* First Login Device Notice Box (Only for Staff / Non-Org-Admin setup) */}
          {userInfo?.role !== 'ORG_ADMIN' && (
            <div
              style={{
                backgroundColor: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                borderRadius: '10px',
                padding: '16px',
                textAlign: 'left',
                marginBottom: '24px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#818cf8', fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}>
                <Lock size={16} />
                <span>Notice on First Sign-In &amp; Device Setup</span>
              </div>
              <p style={{ fontSize: '12.5px', color: '#cbd5e1', lineHeight: '1.5', margin: 0 }}>
                When you log in for the first time, a <strong>Device Authorization Popup</strong> will appear. Confirming it will register your current phone or browser as your official <strong>Layer 3 Security Device</strong> for attendance verification.
              </p>
            </div>
          )}

          <Link href="/login" className="btn btn-primary" style={{ width: '100%', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <span>Proceed to Sign In</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ marginBottom: '20px', padding: '12px 14px', backgroundColor: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.25)', borderRadius: '8px' }}>
            <div style={{ fontSize: '12px', color: '#818cf8', fontWeight: 700, textTransform: 'uppercase' }}>
              {userInfo?.orgName}
            </div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', marginTop: '2px' }}>
              {userInfo?.name}
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
              {userInfo?.email}
            </div>
          </div>

          {submitError && (
            <div className={styles.errorBox}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>{submitError}</div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="password">
              Create Password (Min. 8 characters)
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setSubmitError(null);
                }}
                disabled={isSubmitting}
                className="form-input"
                style={{ paddingLeft: '40px', paddingRight: '40px' }}
                autoComplete="new-password"
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

          <div className="form-group">
            <label className="form-label" htmlFor="confirmPassword">
              Confirm Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••••••"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setSubmitError(null);
                }}
                disabled={isSubmitting}
                className="form-input"
                style={{ paddingLeft: '40px' }}
                autoComplete="new-password"
                required
              />
              <Lock
                size={17}
                color="var(--text-muted)"
                style={{ position: 'absolute', left: '14px', top: '13px' }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !password || !confirmPassword}
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px', marginTop: '8px' }}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Activating Account...</span>
              </>
            ) : (
              <>
                <span>Set Password &amp; Activate</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
      )}
    </>
  );
}

export default function ActivateAccountPage() {
  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        <div className={styles.header}>
          <div className={styles.logoContainer}>
            <Shield size={28} color="#ffffff" />
          </div>
          <h1 className={styles.title}>ShiftGuard</h1>
          <p className={styles.subtitle}>Staff Account Setup &amp; Password Creation</p>
        </div>

        <div className={styles.card}>
          <Suspense
            fallback={
              <div style={{ textAlign: 'center', color: '#ffffff', padding: '40px 0' }}>
                <Loader2 size={36} className="animate-spin" style={{ margin: '0 auto 16px auto', color: '#818cf8' }} />
                <p>Loading activation setup...</p>
              </div>
            }
          >
            <ActivateAccountForm />
          </Suspense>

          <div className={styles.footerText}>
            Return to{' '}
            <Link href="/login" className={styles.footerLink}>
              Sign In Portal &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
