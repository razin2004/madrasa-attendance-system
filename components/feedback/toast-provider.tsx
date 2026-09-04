'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const MAX_VISIBLE_TOASTS = 3;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const activeTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const removeToast = useCallback((id: string) => {
    const existingTimer = activeTimersRef.current.get(id);
    if (existingTimer) {
      clearTimeout(existingTimer);
      activeTimersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', duration: number = 4500) => {
      const id = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      setToasts((prev) => [...prev, { id, type, message, duration }]);
    },
    []
  );

  // Manage auto-dismiss timers ONLY for currently visible (top 3) toasts
  useEffect(() => {
    const visibleToasts = toasts.slice(0, MAX_VISIBLE_TOASTS);
    const visibleIds = new Set(visibleToasts.map((t) => t.id));

    // Clear timers for toasts that are no longer in the top 3
    activeTimersRef.current.forEach((timer, id) => {
      if (!visibleIds.has(id)) {
        clearTimeout(timer);
        activeTimersRef.current.delete(id);
      }
    });

    // Schedule auto-dismiss timer for newly visible toasts
    visibleToasts.forEach((toast) => {
      if (!activeTimersRef.current.has(toast.id)) {
        const timer = setTimeout(() => {
          removeToast(toast.id);
        }, toast.duration || 4500);
        activeTimersRef.current.set(toast.id, timer);
      }
    });
  }, [toasts, removeToast]);

  const success = useCallback((msg: string) => showToast(msg, 'success'), [showToast]);
  const error = useCallback((msg: string) => showToast(msg, 'error'), [showToast]);
  const info = useCallback((msg: string) => showToast(msg, 'info'), [showToast]);
  const warning = useCallback((msg: string) => showToast(msg, 'warning'), [showToast]);

  const visibleToasts = toasts.slice(0, MAX_VISIBLE_TOASTS);

  return (
    <ToastContext.Provider value={{ showToast, success, error, info, warning }}>
      {children}
      {/* Toast Render Queue Portal (Max 3 visible line by line) */}
      <div
        className="toast-container"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          maxWidth: '420px',
          width: 'calc(100% - 48px)',
          pointerEvents: 'none',
        }}
      >
        {visibleToasts.map((toast) => {
          let bg = 'rgba(19, 27, 46, 0.96)';
          let border = '#38bdf8';
          let icon = <Info size={18} color="#38bdf8" />;

          if (toast.type === 'success') {
            bg = 'rgba(6, 78, 59, 0.96)';
            border = '#059669';
            icon = <CheckCircle2 size={18} color="#34d399" />;
          } else if (toast.type === 'error') {
            bg = 'rgba(136, 19, 55, 0.96)';
            border = '#e11d48';
            icon = <AlertCircle size={18} color="#fb7185" />;
          } else if (toast.type === 'warning') {
            bg = 'rgba(120, 53, 15, 0.96)';
            border = '#d97706';
            icon = <AlertTriangle size={18} color="#fbbf24" />;
          }

          return (
            <div
              key={toast.id}
              style={{
                background: bg,
                border: `1px solid ${border}`,
                color: '#f8fafc',
                padding: '12px 16px',
                borderRadius: '10px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.55)',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '12px',
                fontSize: '13.5px',
                lineHeight: '1.45',
                pointerEvents: 'auto',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                animation: 'toastIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                transition: 'all 0.3s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1 }}>
                <div style={{ marginTop: '2px', flexShrink: 0 }}>{icon}</div>
                <div style={{ whiteSpace: 'pre-line', wordBreak: 'break-word', width: '100%' }}>
                  {toast.message}
                </div>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '4px',
                  flexShrink: 0,
                }}
                aria-label="Dismiss message"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
