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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(16, 185, 129, 0.12)', padding: '4px 10px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block', boxShadow: '0 0 8px #10b981' }} />
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#34d399', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              REAL-TIME PUNCH FEED
            </span>
          </div>
          <h3 style={{ fontSize: '16.5px', fontWeight: 700, color: '#ffffff', margin: 0 }}>
            Live Attendance Activity Stream
          </h3>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {lastRefreshed && (
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Updated {lastRefreshed}
            </span>
          )}
          <button
            type="button"
            onClick={() => fetchLiveFeed(true)}
            disabled={isRefreshing}
            className="btn btn-secondary btn-sm"
            style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Refresh Live Feed"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
            <span style={{ fontSize: '12px' }}>Refresh</span>
          </button>
        </div>
      </div>

      {/* Feed List */}
      {loading ? (
        <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <RefreshCw size={24} className="animate-spin" style={{ color: '#818cf8', margin: '0 auto 8px auto' }} />
          <p style={{ fontSize: '13px', margin: 0 }}>Connecting to live attendance feed...</p>
        </div>
      ) : records.length === 0 ? (
        <div style={{ padding: '36px 24px', textAlign: 'center', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
          <Activity size={32} color="var(--text-muted)" style={{ margin: '0 auto 10px auto' }} />
          <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', margin: '0 0 4px 0' }}>
            No punches recorded today yet
          </h4>
          <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0 }}>
            Staff clock-in and clock-out punches will stream here automatically in real time.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
          {records.map((r) => {
            const isClockIn = r.type === 'CLOCK_IN';
            return (
              <div
                key={r.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  backgroundColor: 'rgba(15, 23, 42, 0.5)',
                  border: '1px solid var(--border-subtle)',
                  borderLeft: `4px solid ${isClockIn ? '#10b981' : '#f59e0b'}`,
                  borderRadius: '8px',
                  transition: 'all 0.2s ease',
                }}
              >
                {/* Left Info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: isClockIn ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      color: isClockIn ? '#34d399' : '#fbbf24',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {isClockIn ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 700, color: '#ffffff', fontSize: '14px' }}>
                        {r.staffName}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#818cf8', backgroundColor: 'rgba(129, 140, 248, 0.12)', padding: '2px 6px', borderRadius: '4px' }}>
                        ID: {r.staffId}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <MapPin size={12} color="#38bdf8" />
                        {r.branchName}
                      </span>
                      <span>&bull;</span>
                      <span style={{ color: isClockIn ? '#34d399' : '#fbbf24', fontWeight: 700 }}>
                        {isClockIn ? 'CLOCKED IN' : 'CLOCKED OUT'}
                      </span>
                      {r.manualReason && (
                        <>
                          <span>&bull;</span>
                          <span style={{ fontStyle: 'italic', color: '#fbbf24' }}>&ldquo;{r.manualReason}&rdquo;</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Badges & Time */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', textAlign: 'right' }}>
                  {/* Verification Badges */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      title={`Layer 1 IP Match: ${r.ipMatched ? 'Verified' : 'Bypassed/Manual'}`}
                      style={{ padding: '3px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, backgroundColor: r.ipMatched ? 'rgba(56, 189, 248, 0.15)' : 'rgba(100, 116, 139, 0.2)', color: r.ipMatched ? '#38bdf8' : '#94a3b8' }}
                    >
                      <Wifi size={11} style={{ display: 'inline', marginRight: '3px' }} />
                      IP
                    </span>

                    <span
                      title={`Layer 2 Geofence Match: ${r.geofenceMatched ? 'Verified' : 'Bypassed/Manual'}`}
                      style={{ padding: '3px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, backgroundColor: r.geofenceMatched ? 'rgba(52, 211, 153, 0.15)' : 'rgba(100, 116, 139, 0.2)', color: r.geofenceMatched ? '#34d399' : '#94a3b8' }}
                    >
                      <MapPin size={11} style={{ display: 'inline', marginRight: '3px' }} />
                      GPS
                    </span>

                    <span
                      title={`Layer 3 Device Match: ${r.deviceMatched ? 'Verified' : 'Bypassed/Manual'}`}
                      style={{ padding: '3px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, backgroundColor: r.deviceMatched ? 'rgba(192, 132, 252, 0.15)' : 'rgba(100, 116, 139, 0.2)', color: r.deviceMatched ? '#c084fc' : '#94a3b8' }}
                    >
                      <Smartphone size={11} style={{ display: 'inline', marginRight: '3px' }} />
                      DEV
                    </span>
                  </div>

                  {/* Punch Timestamp */}
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '15px', fontWeight: 800, color: '#ffffff' }}>
                      {r.timeFormatted}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {r.source}
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
