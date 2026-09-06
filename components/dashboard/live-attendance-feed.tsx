'use client';

import React, { useState, useEffect } from 'react';
import {
  Activity,
  Clock,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Wifi,
  Radio,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';

interface FeedRecord {
  id: string;
  staffId: string;
  staffName: string;
  branchName: string;
  type: 'CLOCK_IN' | 'CLOCK_OUT';
  source: 'NORMAL' | 'MANUAL' | 'ADJUSTED';
  timestamp: string;
  timeFormatted: string;
  ipMatched: boolean;
  geofenceMatched: boolean;
  deviceMatched: boolean;
  isManualEntry: boolean;
  manualReason?: string;
}

interface LiveAttendanceFeedProps {
  organizationCode: string;
}

export function LiveAttendanceFeed({ organizationCode }: LiveAttendanceFeedProps) {
  const [records, setRecords] = useState<FeedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchLiveFeed = async (showSpin = false) => {
    if (showSpin) setIsRefreshing(true);
    try {
      const res = await fetch(`/api/org/${organizationCode}/attendance/live-feed?limit=15`);
      const data = await res.json();
      if (res.ok && data.success) {
        setRecords(data.records);
        setLastRefreshed(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error('Error fetching live attendance feed:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLiveFeed();

    // Auto-poll live feed every 6 seconds
    const interval = setInterval(() => {
      fetchLiveFeed();
    }, 6000);

    return () => clearInterval(interval);
  }, [organizationCode]);

  return (
    <div className="glass-card" style={{ padding: '24px', margin: '24px 0' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(16, 185, 129, 0.12)', padding: '3px 8px', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block', boxShadow: '0 0 6px #10b981' }} />
            <span style={{ fontSize: '10px', fontWeight: 800, color: '#34d399', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              LIVE FEED
            </span>
          </div>
          <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
            Realtime Punch Activity
          </h3>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {lastRefreshed && (
            <span className="desktop-only" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Updated {lastRefreshed}
            </span>
          )}
          <button
            type="button"
            onClick={() => fetchLiveFeed(true)}
            disabled={isRefreshing}
            className="btn btn-secondary btn-sm"
            style={{ padding: '6px 10px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            title="Refresh Live Feed"
            aria-label="Refresh Live Feed"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span className="desktop-only" style={{ fontSize: '12px', marginLeft: '6px' }}>Refresh</span>
          </button>
        </div>
      </div>

      {/* Feed List */}
      {loading ? (
        <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <RefreshCw size={22} className="animate-spin" style={{ color: '#818cf8', margin: '0 auto 8px auto' }} />
          <p style={{ fontSize: '12.5px', margin: 0 }}>Connecting to live attendance feed...</p>
        </div>
      ) : records.length === 0 ? (
        <div style={{ padding: '28px 20px', textAlign: 'center', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
          <Activity size={28} color="var(--text-muted)" style={{ margin: '0 auto 8px auto' }} />
          <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', margin: '0 0 4px 0' }}>
            No punches recorded today yet
          </h4>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
            Staff clock-in and clock-out punches will stream here automatically in real time.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto', paddingRight: '2px' }}>
          {records.map((r) => {
            const isClockIn = r.type === 'CLOCK_IN';
            return (
              <div
                key={r.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  backgroundColor: 'rgba(15, 23, 42, 0.5)',
                  border: '1px solid var(--border-subtle)',
                  borderLeft: `4px solid ${isClockIn ? '#10b981' : '#f59e0b'}`,
                  borderRadius: '10px',
                  gap: '10px',
                  flexWrap: 'wrap',
                }}
              >
                {/* Left Info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: isClockIn ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      color: isClockIn ? '#34d399' : '#fbbf24',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {isClockIn ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, color: '#ffffff', fontSize: '13.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {r.staffName}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', color: '#818cf8', backgroundColor: 'rgba(129, 140, 248, 0.12)', padding: '1px 5px', borderRadius: '4px' }}>
                        {r.staffId}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', fontSize: '11.5px', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        <MapPin size={11} color="#38bdf8" />
                        {r.branchName}
                      </span>
                      <span>&bull;</span>
                      <span style={{ color: isClockIn ? '#34d399' : '#fbbf24', fontWeight: 700 }}>
                        {isClockIn ? 'IN' : 'OUT'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Badges & Time */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'right', flexShrink: 0 }}>
                  {/* Verification Badges */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span
                      title={`Layer 1 IP Match: ${r.ipMatched ? 'Verified' : 'Manual'}`}
                      style={{ padding: '2px 5px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, backgroundColor: r.ipMatched ? 'rgba(56, 189, 248, 0.15)' : 'rgba(100, 116, 139, 0.2)', color: r.ipMatched ? '#38bdf8' : '#94a3b8' }}
                    >
                      IP
                    </span>

                    <span
                      title={`Layer 2 GPS Match: ${r.geofenceMatched ? 'Verified' : 'Manual'}`}
                      style={{ padding: '2px 5px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, backgroundColor: r.geofenceMatched ? 'rgba(52, 211, 153, 0.15)' : 'rgba(100, 116, 139, 0.2)', color: r.geofenceMatched ? '#34d399' : '#94a3b8' }}
                    >
                      GPS
                    </span>

                    <span
                      title={`Layer 3 Device Match: ${r.deviceMatched ? 'Verified' : 'Manual'}`}
                      style={{ padding: '2px 5px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, backgroundColor: r.deviceMatched ? 'rgba(192, 132, 252, 0.15)' : 'rgba(100, 116, 139, 0.2)', color: r.deviceMatched ? '#c084fc' : '#94a3b8' }}
                    >
                      DEV
                    </span>
                  </div>

                  {/* Punch Timestamp */}
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 800, color: '#ffffff' }}>
                      {r.timeFormatted}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
