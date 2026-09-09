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

  return (
    <div ref={popoverRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'rgba(245, 158, 11, 0.12)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          color: '#fbbf24',
          fontSize: '12px',
          fontWeight: 700,
          padding: '3px 9px',
          borderRadius: '6px',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          transition: 'all 0.15s ease',
        }}
        title="Click to view break intervals"
      >
        <Coffee size={13} />
        <span>{formatMinutes(totalBreakMinutes)}</span>
      </button>

      {isOpen && (
        <div
          className="glass-card"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            width: '240px',
            padding: '12px',
            backgroundColor: '#0d121f',
            border: '1px solid var(--border-medium)',
            borderRadius: '12px',
            boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.9)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 800, color: '#ffffff' }}>
              <Coffee size={14} color="#fbbf24" />
              <span>Break Time Breakdown</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
            >
              <X size={14} />
            </button>
          </div>

          {breaks.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '6px 0', textAlign: 'center' }}>
              Total Break: {formatMinutes(totalBreakMinutes)}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {breaks.map((b) => (
                <div
                  key={b.breakNumber}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid var(--border-subtle)',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    fontSize: '11.5px',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, color: '#f1f5f9' }}>
                      Break {b.breakNumber}
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: '11px', marginTop: '1px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <Clock size={10} color="#818cf8" />
                      <span>{b.startTime} – {b.endTime}</span>
                    </div>
                  </div>
                  <span style={{ fontWeight: 800, color: '#fbbf24', fontSize: '11.5px' }}>
                    {formatMinutes(b.durationMinutes)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', fontWeight: 700 }}>
            <span style={{ color: 'var(--text-muted)' }}>Total Break:</span>
            <span style={{ color: '#fbbf24' }}>{formatMinutes(totalBreakMinutes)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
