'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Coffee, Clock, X } from 'lucide-react';

export interface BreakItem {
  breakNumber: number;
  startTime: string; // e.g. "02:10 am"
  endTime: string;   // e.g. "02:20 am"
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
          fontSize: '11.5px',
          fontWeight: 700,
          padding: '2px 8px',
          borderRadius: '6px',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          transition: 'all 0.15s ease',
          whiteSpace: 'nowrap',
        }}
        title="Click to view break intervals"
      >
        <Coffee size={12} />
        <span>{formatMinutes(totalBreakMinutes)}</span>
      </button>

      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            right: 0,
            zIndex: 99999,
            width: '220px',
            padding: '10px',
            backgroundColor: '#0f172a',
            border: '1px solid var(--border-medium, rgba(255, 255, 255, 0.18))',
            borderRadius: '10px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.75)',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '6px',
              paddingBottom: '4px',
              borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: 800, color: '#ffffff' }}>
              <Coffee size={13} color="#fbbf24" />
              <span>Break Time</span>
            </div>
            <button
              type="button"
              onClick={handleClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '0',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={13} />
            </button>
          </div>

          {breaks.length === 0 ? (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '4px 0', textAlign: 'center' }}>
              Total: <strong>{formatMinutes(totalBreakMinutes)}</strong>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '160px', overflowY: 'auto' }}>
              {breaks.map((b) => (
                <div
                  key={b.breakNumber}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    padding: '5px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, color: '#f1f5f9' }}>
                      Break #{b.breakNumber}
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: '10.5px', marginTop: '1px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <Clock size={10} color="#818cf8" />
                      <span>{b.startTime} – {b.endTime}</span>
                    </div>
                  </div>
                  <span style={{ fontWeight: 800, color: '#fbbf24', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                    {formatMinutes(b.durationMinutes)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div
            style={{
              marginTop: '6px',
              paddingTop: '4px',
              borderTop: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '11px',
              fontWeight: 700,
            }}
          >
            <span style={{ color: 'var(--text-muted)' }}>Total:</span>
            <span style={{ color: '#fbbf24', fontFamily: 'var(--font-mono)' }}>
              {formatMinutes(totalBreakMinutes)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
