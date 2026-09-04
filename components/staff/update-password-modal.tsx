'use client';

import React, { useState } from 'react';
import {
  Key,
  X,
  Loader2,
  CheckCircle2,
  Copy,
  Share2,
  Check,
  RefreshCw,
  Eye,
  EyeOff,
  AlertCircle,
} from 'lucide-react';
import { useToast } from '@/components/feedback/toast-provider';
import { openWhatsAppPasswordShare } from '@/lib/whatsapp';
import { generateTemporaryPassword } from '@/lib/security';

interface UpdatePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationCode: string;
  orgName?: string;
  staff: {
    id: string;
    staffId: string;
    name: string;
    email: string;
    phone?: string | null;
  } | null;
  onSuccess?: () => void;
}

export function UpdatePasswordModal({
  isOpen,
  onClose,
  organizationCode,
  orgName,
  staff,
  onSuccess,
}: UpdatePasswordModalProps) {
  const toast = useToast();

  const [customPassword, setCustomPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [sendEmailNotification, setSendEmailNotification] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Success Result State
  const [result, setResult] = useState<{
    password: string;
    emailSent: boolean;
  } | null>(null);

  const [copiedPassword, setCopiedPassword] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

  if (!isOpen || !staff) return null;

  const handleGenerateRandom = () => {
    const pass = generateTemporaryPassword(8);
    setCustomPassword(pass);
    setShowPassword(true);
    setErrorMsg(null);
  };

  const handleResetModal = () => {
    setCustomPassword('');
    setShowPassword(false);
    setSendEmailNotification(true);
    setUpdating(false);
    setErrorMsg(null);
    setResult(null);
    setCopiedPassword(false);
    setCopiedAll(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedPass = customPassword.trim();

    // Client-side validation: if typed, must be at least 8 chars. If blank, allowed (auto-generates 8 chars).
    if (trimmedPass.length > 0 && trimmedPass.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }

    setUpdating(true);
    setErrorMsg(null);

    try {
      const res = await fetch(
        `/api/org/${organizationCode}/staff/${staff.id}/update-password`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            password: customPassword.trim() || undefined,
            sendEmailNotification,
          }),
        }
      );

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || `Password updated for ${staff.name}`);
        setResult({
          password: data.updatedPassword || data.password || '',
          emailSent: Boolean(data.emailSent),
        });
        if (onSuccess) onSuccess();
      } else {
        setErrorMsg(data.error || 'Failed to update staff password.');
      }
    } catch {
      setErrorMsg('Network error updating password.');
    } finally {
      setUpdating(false);
    }
  };

  const handleCopyPassword = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.password);
    setCopiedPassword(true);
    toast.success('Password copied to clipboard!');
    setTimeout(() => setCopiedPassword(false), 2500);
  };

  const handleCopyAll = () => {
    if (!result || !staff) return;
    const loginUrl = `${window.location.origin}/login`;
    const text = `ShiftGuard Login Credentials\nOrganization Code: ${organizationCode}\nStaff ID: ${staff.staffId}\nEmail: ${staff.email}\nNew Password: ${result.password}\nLogin Portal: ${loginUrl}`;
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    toast.success('All credentials & login link copied!');
    setTimeout(() => setCopiedAll(false), 2500);
  };

  const handleWhatsAppShare = () => {
    if (!result || !staff) return;
    openWhatsAppPasswordShare({
      phone: staff.phone,
      staffName: staff.name,
      orgName: orgName || organizationCode,
      organizationCode,
      staffId: staff.staffId,
      email: staff.email,
      newPassword: result.password,
    });
    toast.success(
      staff.phone
        ? 'Opening WhatsApp chat...'
        : 'Opening WhatsApp contact picker...'
    );
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        backgroundColor: 'rgba(3, 7, 18, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '520px',
          padding: '28px',
          backgroundColor: '#0d121f',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#818cf8',
              }}
            >
              <Key size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                Update Password
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                {staff.name} ({staff.staffId})
              </p>
            </div>
          </div>
          <button
            onClick={handleResetModal}
            className="btn btn-ghost btn-sm"
            style={{ padding: '4px', color: 'var(--text-muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        {errorMsg && (
          <div
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '12.5px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* SUCCESS VIEW */}
        {result ? (
          <div>
            <div
              style={{
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                padding: '18px',
                borderRadius: '12px',
                marginBottom: '20px',
              }}
            >
              <div
                style={{
                  fontSize: '16px',
                  fontWeight: 800,
                  color: '#34d399',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '6px',
                }}
              >
                <CheckCircle2 size={20} />
                <span>Password Updated Successfully!</span>
              </div>
              <p style={{ fontSize: '13px', color: '#cbd5e1', margin: 0 }}>
                The password for <strong>{staff.name}</strong> has been updated.
                {result.emailSent ? ' An email notification has been dispatched.' : ''}
              </p>
            </div>

            {/* Credential Box */}
            <div
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '20px',
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '8px',
                }}
              >
                New Account Password
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: 'rgba(0, 0, 0, 0.4)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '18px',
                    fontWeight: 800,
                    letterSpacing: '1px',
                    color: '#38bdf8',
                  }}
                >
                  {result.password}
                </span>
                <button
                  type="button"
                  onClick={handleCopyPassword}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
                >
                  {copiedPassword ? <Check size={14} color="#34d399" /> : <Copy size={14} />}
                  <span>{copiedPassword ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Sharing Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              <button
                type="button"
                onClick={handleWhatsAppShare}
                style={{
                  backgroundColor: '#25D366',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '11px 16px',
                  fontWeight: 700,
                  fontSize: '13.5px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  transition: 'opacity 0.2s',
                }}
              >
                <Share2 size={16} />
                <span>
                  {staff.phone
                    ? `Share Password via WhatsApp (${staff.phone})`
                    : 'Share Password via WhatsApp'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleCopyAll}
                className="btn btn-secondary"
                style={{
                  width: '100%',
                  padding: '11px 16px',
                  fontWeight: 600,
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                {copiedAll ? <Check size={16} color="#34d399" /> : <Copy size={16} />}
                <span>{copiedAll ? 'Credentials & Link Copied!' : 'Copy All Credentials & Login Link'}</span>
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={handleResetModal} className="btn btn-primary btn-sm">
                Done
              </button>
            </div>
          </div>
        ) : (
          /* FORM VIEW */
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label
                className="form-label"
                style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}
              >
                New Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter custom password or leave blank for auto-generate"
                  value={customPassword}
                  onChange={(e) => setCustomPassword(e.target.value)}
                  className="form-input"
                  style={{ width: '100%', paddingRight: '40px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '10px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                Password must be at least 8 characters long. Leave empty to auto-generate a secure 8-character password.
              </p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <button
                type="button"
                onClick={handleGenerateRandom}
                className="btn btn-secondary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
              >
                <RefreshCw size={13} />
                <span>Auto-Generate Secure Password</span>
              </button>
            </div>

            <div
              style={{
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                backgroundColor: 'rgba(255,255,255,0.02)',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <input
                type="checkbox"
                id="sendEmailCheck"
                checked={sendEmailNotification}
                onChange={(e) => setSendEmailNotification(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#4f46e5' }}
              />
              <label
                htmlFor="sendEmailCheck"
                style={{ fontSize: '13px', color: '#f8fafc', cursor: 'pointer', userSelect: 'none' }}
              >
                Send notification email with new password to <strong>{staff.email}</strong>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" onClick={handleResetModal} className="btn btn-secondary btn-sm">
                Cancel
              </button>
              <button
                type="submit"
                disabled={updating}
                className="btn btn-primary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                {updating ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Updating Password...</span>
                  </>
                ) : (
                  <>
                    <Key size={14} />
                    <span>Update Password</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
