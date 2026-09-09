'use client';

import React from 'react';
import { AlertTriangle, X, ShieldAlert, Loader2, Send } from 'lucide-react';

interface AttendanceWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  actionType: 'CLOCK_IN' | 'CLOCK_OUT';
  submitting?: boolean;
  evaluation?: {
    layer1Device?: { isVerified: boolean; message?: string };
    layer2Network?: { isVerified: boolean; message?: string };
    layer3Geofence?: { isVerified: boolean; message?: string };
    failureReasons?: string[];
  } | null;
}

export function AttendanceWarningModal({
  isOpen,
  onClose,
  onConfirm,
  actionType,
  submitting = false,
  evaluation,
}: AttendanceWarningModalProps) {
  if (!isOpen) return null;

  const actionText = actionType === 'CLOCK_IN' ? 'Clock In' : 'Clock Out';

  // Gather specific failure reasons
  const failureList: string[] = [];

  if (evaluation) {
    if (evaluation.layer1Device && !evaluation.layer1Device.isVerified) {
      failureList.push('Unregistered Device');
    }
    if (evaluation.layer2Network && !evaluation.layer2Network.isVerified) {
      failureList.push('IP Address does not match branch IP');
    }
    if (evaluation.layer3Geofence && !evaluation.layer3Geofence.isVerified) {
      failureList.push('Outside allocated Geofence/GPS location');
    }
  }

  // Fallback to evaluation failureReasons array if list is empty
  if (failureList.length === 0 && evaluation?.failureReasons && evaluation.failureReasons.length > 0) {
    failureList.push(...evaluation.failureReasons);
  }

  if (failureList.length === 0) {
    failureList.push('Security criteria verification incomplete or unverified');
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          backgroundColor: '#0f172a',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 20px rgba(239, 68, 68, 0.2)',
          color: '#f8fafc',
          position: 'relative',
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={submitting}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Close modal"
        >
          <X size={20} />
        </button>

        {/* Modal Header Icon & Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ShieldAlert size={26} color="#f87171" />
          </div>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
              Verification Criteria Warning
            </h3>
            <p style={{ fontSize: '12.5px', color: '#94a3b8', margin: '2px 0 0 0' }}>
              Unverified {actionText} Request
            </p>
          </div>
        </div>

        {/* Failure Reasons Breakdown Box */}
        <div
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: '12px',
            padding: '14px 16px',
            marginBottom: '16px',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
            Unmet Verification Requirements:
          </div>
          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#fca5a5', lineHeight: '1.6' }}>
            {failureList.map((reason, idx) => (
              <li key={idx}>
                <strong>{reason}</strong>
              </li>
            ))}
          </ul>
        </div>

        {/* Explicit Required Warning Text */}
        <div
          style={{
            backgroundColor: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: '12px',
            padding: '14px 16px',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <AlertTriangle size={18} color="#fbbf24" style={{ flexShrink: 0, marginTop: '2px' }} />
            <p style={{ fontSize: '13px', color: '#fef3c7', margin: 0, lineHeight: '1.5', fontWeight: 500 }}>
              You are not meeting the required verification criteria. If you proceed to clock in/out, this request will be sent to the Admin panel. Clock-in/out will only take effect once approved by the Admin.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: '10px 18px',
              borderRadius: '10px',
              fontSize: '13.5px',
              fontWeight: 600,
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#cbd5e1',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            style={{
              padding: '10px 20px',
              borderRadius: '10px',
              fontSize: '13.5px',
              fontWeight: 700,
              backgroundColor: '#e11d48',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(225, 29, 72, 0.35)',
            }}
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Submitting Request...</span>
              </>
            ) : (
              <>
                <Send size={16} />
                <span>Proceed to {actionText}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
