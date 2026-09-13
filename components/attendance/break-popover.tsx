'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Coffee, Clock, X } from 'lucide-react';

export interface BreakItem {
  breakNumber: number;
  startTime: string; // e.g. "12:30 PM"
  endTime: string;   // e.g. "01:00 PM"
  durationMinutes: number;
}

interface BreakPopoverProps {
  totalBreakMinutes: number;
  breaks: BreakItem[];
}

export function BreakPopover({ totalBreakMinutes, breaks }: BreakPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const formatMinutes = (mins: number) => {
    if (!mins || mins <= 0) return '0m';
    const hrs = Math.floor(mins / 60);
    const m = mins % 60;
    if (hrs > 0) {
      return m > 0 ? `${hrs}h ${m}m` : `${hrs}h`;
    }
    return `${m}m`;
  };

  if (!totalBreakMinutes || totalBreakMinutes <= 0) {
    return <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>—</span>;
  }

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsOpen((prev) => !prev);
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsOpen(false);
  };

  return (
    <div
      ref={popoverRef}
      style={{ position: 'relative', display: 'inline-block' }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={handleToggle}
        style={{
          background: 'rgba(245, 158, 11, 0.15)',
          border: '1px solid rgba(245, 158, 11, 0.35)',
          color: '#fbbf24',
          fontSize: '12px',
          fontWeight: 700,
          padding: '4px 10px',
          borderRadius: '6px',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          transition: 'all 0.15s ease',
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)',
        }}
        title="Click to view break intervals"
      >
        <Coffee size={13} />
        <span>{formatMinutes(totalBreakMinutes)}</span>
      </button>

      {isOpen && (
        <>
          {/* Backdrop for click away & mobile overlay */}
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 99990,
              backgroundColor: 'rgba(0, 0, 0, 0.55)',
              backdropFilter: 'blur(3px)',
            }}
            onClick={handleClose}
          />

          {/* Modal Popover Card */}
          <div
            className="glass-card"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 99999,
              width: '90%',
              maxWidth: '320px',
              padding: '16px',
              backgroundColor: '#0d121f',
              border: '1px solid var(--border-medium, rgba(255, 255, 255, 0.18))',
              borderRadius: '16px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.9)',
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px',
                paddingBottom: '8px',
                borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 800, color: '#ffffff' }}>
                <Coffee size={16} color="#fbbf24" />
                <span>Break Time Breakdown</span>
              </div>
              <button
                type="button"
                onClick={handleClose}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                  color: '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={14} />
              </button>
            </div>

            {breaks.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '10px 0', textAlign: 'center' }}>
                Total Break: <strong>{formatMinutes(totalBreakMinutes)}</strong>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
                {breaks.map((b) => (
                  <div
                    key={b.breakNumber}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: 'rgba(15, 23, 42, 0.85)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, color: '#f1f5f9' }}>
                        Break #{b.breakNumber}
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: '11px', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={11} color="#818cf8" />
                        <span>{b.startTime} – {b.endTime}</span>
                      </div>
                    </div>
                    <span style={{ fontWeight: 800, color: '#fbbf24', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                      {formatMinutes(b.durationMinutes)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div
              style={{
                marginTop: '12px',
                paddingTop: '8px',
                borderTop: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '12px',
                fontWeight: 800,
              }}
            >
              <span style={{ color: 'var(--text-muted)' }}>Total Break Duration:</span>
              <span style={{ color: '#fbbf24', fontSize: '13px', fontFamily: 'var(--font-mono)' }}>
                {formatMinutes(totalBreakMinutes)}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
