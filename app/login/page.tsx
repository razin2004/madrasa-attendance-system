'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/components/feedback/toast-provider';
import styles from './Login.module.css';
import {
  Shield,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  AlertCircle,
  KeyRound,
} from 'lucide-react';

export default function CommonLoginPage() {
  const router = useRouter();
  const toast = useToast();

  // Single Login Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Mandatory Password Change State (for First-Time Admins)
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [pendingUser, setPendingUser] = useState<{ id: string; email: string; name: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Submit Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage('Please enter your account email address and password.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        if (data.mustChangePassword) {
          setMustChangePassword(true);
          setPendingUser(data.user);
          toast.info('Please create a new permanent password to continue.');
        } else {
          toast.success(`Welcome, ${data.user?.name || 'User'}!`);
          router.push(data.redirectUrl || '/');
        }
      } else {
        setErrorMessage(data.error || 'Invalid credentials.');
        toast.error(data.error || 'Sign in failed.');
      }
    } catch (err) {
      setErrorMessage('Network connection error. Please try again.');
      toast.error('Network error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Forced Password Change
  const handlePasswordChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!newPassword || newPassword.length < 8) {
      setErrorMessage('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('New passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/org/common/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: pendingUser?.id,
          currentPassword: password,
          newPassword,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        toast.success('Password updated successfully! Redirecting...');
        router.push(data.redirectUrl || '/');
      } else {
        setErrorMessage(data.error || 'Failed to update password.');
        toast.error(data.error || 'Password update failed.');
      }
    } catch (err) {
      setErrorMessage('Network error during password update.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        {/* ShiftGuard Branding Header */}
        <div className={styles.header}>
          <div className={styles.logoContainer}>
            <Shield size={28} color="#ffffff" />
          </div>
          <h1 className={styles.title}>ShiftGuard</h1>
          <p className={styles.subtitle}>Sign in to access your account workspace</p>
        </div>

        {/* Login Form Card */}
        <div className={styles.card}>
          {errorMessage && (
            <div className={styles.errorBox}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>{errorMessage}</div>
            </div>
          )}

          {!mustChangePassword ? (
            <form onSubmit={handleLoginSubmit} noValidate>
              {/* Email Field */}
              <div className="form-group">
                <label className="form-label" htmlFor="email">
                  Email Address
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="email"
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErrorMessage(null);
                    }}
                    disabled={isSubmitting}
                    className="form-input"
                    style={{ paddingLeft: '40px' }}
                    autoComplete="username"
                    required
                  />
                  <Mail
                    size={17}
                    color="var(--text-muted)"
                    style={{ position: 'absolute', left: '14px', top: '13px' }}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="form-label" htmlFor="password" style={{ margin: 0 }}>
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    style={{ fontSize: '12px', color: '#818cf8', fontWeight: 600, textDecoration: 'none' }}
                  >
                    Forgot password?
                  </Link>
                </div>
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
                    disabled={isSubmitting}
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
                disabled={isSubmitting}
                className="btn btn-primary"
                style={{ width: '100%', padding: '12px', marginTop: '8px' }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* MANDATORY PASSWORD CHANGE FORM */
            <form onSubmit={handlePasswordChangeSubmit} noValidate>
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(245, 158, 11, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 12px auto',
                    color: '#fbbf24',
                  }}
                >
                  <KeyRound size={20} />
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>
                  Set Permanent Password
                </h3>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Please create a permanent password to secure your account.
                </p>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="newPassword">
                  New Password (Min. 8 characters)
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setErrorMessage(null);
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
                    onClick={() => setShowNewPassword(!showNewPassword)}
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
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
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
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setErrorMessage(null);
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
                disabled={isSubmitting || !newPassword || !confirmPassword}
                className="btn btn-primary"
                style={{ width: '100%', padding: '12px', marginTop: '8px' }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Updating Password...</span>
                  </>
                ) : (
                  <>
                    <span>Set Password &amp; Enter</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          )}

          <div className={styles.footerText}>
            Need help?{' '}
            <Link href="/" className={styles.footerLink}>
              ShiftGuard Support &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
