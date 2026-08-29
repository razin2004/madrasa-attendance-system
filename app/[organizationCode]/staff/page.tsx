'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Smartphone,
  Wifi,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  History,
  Building2,
  Calendar,
  ShieldCheck,
  FilePlus,
  ChevronRight,
  TrendingUp,
  Info,
  Loader2,
  UserCheck,
  FileText,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { useToast } from '@/components/feedback/toast-provider';
import { ConfirmationModal } from '@/components/feedback/confirmation-modal';
import { CorrectionRequestModal } from '@/components/attendance/correction-request-modal';
import { getClientPublicIp } from '@/lib/client-location-ip';
import styles from './StaffDashboard.module.css';

interface PrecheckData {
  isReady: boolean;
  layer1Device: {
    isVerified: boolean;
    title: string;
    message: string;
    status: 'SUCCESS' | 'FAILED' | 'WARNING';
    deviceStatus: string;
  };
  layer2Network: {
    isVerified: boolean;
    title: string;
    message: string;
    status: 'SUCCESS' | 'FAILED' | 'WARNING';
    branchName?: string;
  };
  layer3Geofence: {
    isVerified: boolean;
    title: string;
    message: string;
    status: 'SUCCESS' | 'FAILED' | 'WARNING';
    distanceMeters?: number;
    allowedRadiusMeters?: number;
    accuracyMeters?: number;
    latitude?: number;
    longitude?: number;
  };
  candidateBranch?: {
    id: string;
    name: string;
  } | null;
  failureReasons: string[];
}

interface TodayAttendanceStatus {
  isClockedIn: boolean;
  completedCycles?: number;
  maxCycles?: number;
  isDailyLimitReached?: boolean;
  hasSchedule?: boolean;
  schedule?: {
    date: string;
    weekday: string;
    isScheduled: boolean;
    isHoliday: boolean;
    startTime: string | null;
    endTime: string | null;
    shiftPatternName?: string;
  } | null;
  lastClockInTime: string | null;
  attendanceStartTime?: string | null;
  lateMinutes?: number;
  lastClockOutTime: string | null;
  earlyDepartureMinutes?: number;
  currentBranch?: { id: string; name: string } | null;
  todayRecords: Array<{
    id: string;
    type: 'CLOCK_IN' | 'CLOCK_OUT';
    verificationStatus: 'VERIFIED' | 'REJECTED';
    timestamp: string;
    branch?: { name: string } | null;
  }>;
}

export default function StaffDashboardPage() {
  const params = useParams();
  const orgCode = (params.organizationCode as string)?.toUpperCase() || '';
  const router = useRouter();
  const toast = useToast();

  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDateStr, setCurrentDateStr] = useState<string>('');
  const [staffInfo, setStaffInfo] = useState<any>(null);
  const [orgData, setOrgData] = useState<any>(null);
  const [precheck, setPrecheck] = useState<PrecheckData | null>(null);
  const [todayStatus, setTodayStatus] = useState<TodayAttendanceStatus | null>(null);
  const [recentRecords, setRecentRecords] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [clocking, setClocking] = useState(false);
  const [locationCoords, setLocationCoords] = useState<{ latitude: number; longitude: number; accuracy?: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Early Clock-Out Warning Modal State
  const [showEarlyClockOutModal, setShowEarlyClockOutModal] = useState(false);
  const [earlyClockOutMinutes, setEarlyClockOutMinutes] = useState<number>(0);

  // Correction Request Modal State
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);

  // Live Digital Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setCurrentDateStr(now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const getOrCreateDeviceSecret = useCallback((): string => {
    let secret = localStorage.getItem('shiftguard_device_secret');
    if (!secret) {
      const arr = new Uint8Array(24);
      window.crypto.getRandomValues(arr);
      secret = Array.from(arr, (byte) => byte.toString(16).padStart(2, '0')).join('');
      localStorage.setItem('shiftguard_device_secret', secret);
    }
    return secret;
  }, []);

  const requestGeolocation = useCallback(async (): Promise<{ latitude: number; longitude: number; accuracy?: number } | null> => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by this browser.');
      return null;
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          };
          setLocationCoords(coords);
          setLocationError(null);
          resolve(coords);
        },
        (highAccErr) => {
          if (highAccErr.code === highAccErr.PERMISSION_DENIED) {
            setLocationError('Location access was denied. Please allow location permissions in your browser settings to verify geofence.');
            resolve(null);
            return;
          }
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const coords = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
              };
              setLocationCoords(coords);
              setLocationError(null);
              resolve(coords);
            },
            (lowAccErr) => {
              let msg = 'Unable to fetch your location.';
              if (lowAccErr.code === lowAccErr.PERMISSION_DENIED) {
                msg = 'Location access was denied. Please allow location permissions in your browser settings to verify geofence.';
              } else if (lowAccErr.code === lowAccErr.POSITION_UNAVAILABLE) {
                msg = 'Location signal unavailable. Ensure location services are enabled on your device.';
              } else if (lowAccErr.code === lowAccErr.TIMEOUT) {
                msg = 'Location request timed out. Please try again.';
              }
              setLocationError(msg);
              resolve(null);
            },
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 30000 }
          );
        },
        { enableHighAccuracy: true, timeout: 4000, maximumAge: 0 }
      );
    });
  }, []);

  const runPrecheck = useCallback(
    async (coords?: { latitude: number; longitude: number; accuracy?: number } | null, isManual: boolean = false) => {
      setChecking(true);
      try {
        const deviceSecret = getOrCreateDeviceSecret();
        let clientIp: string | null = null;
        try {
          clientIp = await getClientPublicIp();
        } catch {
          // Fallback gracefully to server header extraction
        }

        const bodyData: any = { deviceSecret };
        if (coords) {
          bodyData.latitude = coords.latitude;
          bodyData.longitude = coords.longitude;
          if (coords.accuracy !== undefined) bodyData.accuracy = coords.accuracy;
        }

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (clientIp) headers['x-client-public-ip'] = clientIp;

        const res = await fetch(`/api/org/${orgCode}/attendance/precheck`, {
          method: 'POST',
          headers,
          body: JSON.stringify(bodyData),
          cache: 'no-store',
        });

        if (res.status === 401) {
          router.push(`/${orgCode}/login`);
          return;
        }

        const data = await res.json();
        if (res.ok && data.success) {
          setPrecheck(data.evaluation);
          setTodayStatus(data.todayStatus);
          if (data.staffProfile) setStaffInfo(data.staffProfile);
          if (data.organization) setOrgData(data.organization);
          setFetchError(null);

          if (isManual) {
            toast.success('Verification status refreshed.');
          }

          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('shiftguard_precheck_updated', { detail: data.evaluation.isReady }));
          }

          if (
            !data.evaluation.layer1Device.isVerified &&
            (data.staff?.deviceStatus === 'NOT_REGISTERED' ||
             data.staff?.hasPendingDeviceSlot ||
             !data.staffProfile.devices ||
             data.staffProfile.devices.length === 0 ||
             data.staffProfile.devices.some((d: any) => d.status === 'NOT_REGISTERED'))
          ) {
            try {
              const regRes = await fetch(`/api/org/${orgCode}/staff/device/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  deviceSecret,
                  deviceLabel: navigator.userAgent?.slice(0, 80) || 'Staff Device',
                }),
              });
              const regData = await regRes.json();
              if (regData.success) {
                if (isManual) toast.success('Device registered successfully.');
                const recheckRes = await fetch(`/api/org/${orgCode}/attendance/precheck`, {
                  method: 'POST',
                  headers,
                  body: JSON.stringify(bodyData),
                  cache: 'no-store',
                });
                const recheckData = await recheckRes.json();
                if (recheckRes.ok && recheckData.success) {
                  setPrecheck(recheckData.evaluation);
                  setTodayStatus(recheckData.todayStatus);
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('shiftguard_precheck_updated', { detail: recheckData.evaluation.isReady }));
                  }
                }
              }
            } catch {}
          }
        } else {
          setFetchError(data.error || null);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('shiftguard_precheck_updated', { detail: false }));
          }
        }
      } catch {
        setFetchError(null);
      } finally {
        setChecking(false);
      }
    },
    [getOrCreateDeviceSecret, orgCode, router, toast]
  );

  const initData = useCallback(async () => {
    setLoading(true);
    const coords = await requestGeolocation().catch(() => null);
    await runPrecheck(coords, false);

    try {
      const histRes = await fetch(`/api/org/${orgCode}/attendance/history?limit=5`);
      const histData = await histRes.json();
      if (histData.success) {
        setRecentRecords(histData.records || []);
      }
    } catch {}

    setLoading(false);
  }, [orgCode, requestGeolocation, runPrecheck]);

  useEffect(() => {
    if (orgCode) {
      initData();
    }
  }, [initData, orgCode]);

  const handleManualRefresh = async () => {
    setChecking(true);
    const coords = await requestGeolocation();
    await runPrecheck(coords, true);
  };

  const executeClockAction = async (actionType: 'CLOCK_IN' | 'CLOCK_OUT') => {
    setClocking(true);
    try {
      const deviceSecret = getOrCreateDeviceSecret();
      let clientIp: string | null = null;
      try {
        clientIp = await getClientPublicIp();
      } catch {}

      const coords = locationCoords || (await requestGeolocation().catch(() => null));

      // 1. Mandatory Live Backend Precheck Comparison
      const precheckHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (clientIp) precheckHeaders['x-client-public-ip'] = clientIp;

      const precheckBody: any = { deviceSecret };
      if (coords) {
        precheckBody.latitude = coords.latitude;
        precheckBody.longitude = coords.longitude;
        if (coords.accuracy !== undefined) precheckBody.accuracy = coords.accuracy;
      }

      const livePrecheckRes = await fetch(`/api/org/${orgCode}/attendance/precheck`, {
        method: 'POST',
        headers: precheckHeaders,
        body: JSON.stringify(precheckBody),
        cache: 'no-store',
      });

      const livePrecheckData = await livePrecheckRes.json();
      let candidateBranchId = precheck?.candidateBranch?.id;

      if (livePrecheckData.success && livePrecheckData.evaluation) {
        setPrecheck(livePrecheckData.evaluation);
        if (livePrecheckData.todayStatus) setTodayStatus(livePrecheckData.todayStatus);
        if (livePrecheckData.evaluation.candidateBranch?.id) {
          candidateBranchId = livePrecheckData.evaluation.candidateBranch.id;
        }

        if (!livePrecheckData.evaluation.isReady) {
          let errorMsg = 'Attendance verification failed.';
          if (!livePrecheckData.evaluation.layer2Network?.isVerified) {
            errorMsg = livePrecheckData.evaluation.layer2Network?.message || 'Your current network is not the registered branch network.';
          } else if (!livePrecheckData.evaluation.layer3Geofence?.isVerified) {
            errorMsg = livePrecheckData.evaluation.layer3Geofence?.message || 'Outside branch geofence.';
          } else if (!livePrecheckData.evaluation.layer1Device?.isVerified) {
            errorMsg = 'Unverified device.';
          }

          toast.error(errorMsg);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('shiftguard_precheck_updated', { detail: false }));
          }
          setClocking(false);
          return;
        }
      }

      // 2. Verified Live Security Passed -> Execute Clock In / Out
      const payload: any = {
        action: actionType,
        deviceSecret,
        branchId: candidateBranchId,
      };

      if (coords) {
        payload.latitude = coords.latitude;
        payload.longitude = coords.longitude;
        if (coords.accuracy !== undefined) payload.accuracy = coords.accuracy;
      }

      const endpoint = actionType === 'CLOCK_IN' ? 'clock-in' : 'clock-out';
      const res = await fetch(`/api/org/${orgCode}/attendance/${endpoint}`, {
        method: 'POST',
        headers: precheckHeaders,
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(
          actionType === 'CLOCK_IN'
            ? 'Clocked in successfully!'
            : 'Clocked out successfully!'
        );
        setShowEarlyClockOutModal(false);
        initData();
      } else {
        toast.error(data.error || `Failed to ${actionType === 'CLOCK_IN' ? 'clock in' : 'clock out'}.`);
        if (data.evaluation) setPrecheck(data.evaluation);
      }
    } catch {
      toast.error('Network error recording attendance.');
    } finally {
      setClocking(false);
    }
  };

  const handleClockButtonClick = () => {
    if (!todayStatus) return;

    if (!todayStatus.isClockedIn) {
      executeClockAction('CLOCK_IN');
    } else {
      const schedEndStr = todayStatus.schedule?.endTime;
      if (schedEndStr) {
        const now = new Date();
        const [hStr, mStr] = schedEndStr.split(':');
        const endTimes = new Date();
        endTimes.setHours(parseInt(hStr, 10), parseInt(mStr, 10), 0, 0);

        if (now < endTimes) {
          const diffMs = endTimes.getTime() - now.getTime();
          const minsRemaining = Math.ceil(diffMs / (1000 * 60));
          setEarlyClockOutMinutes(minsRemaining);
          setShowEarlyClockOutModal(true);
          return;
        }
      }
      executeClockAction('CLOCK_OUT');
    }
  };

  const hasSchedule = Boolean(todayStatus?.hasSchedule);
  const isClockedIn = Boolean(todayStatus?.isClockedIn);
  const isCompleted = Boolean(todayStatus?.isDailyLimitReached && !isClockedIn);
  const isReadyToClock = Boolean(precheck?.isReady && hasSchedule && !isCompleted);

  return (
    <div className={styles.container}>
      {/* Glassmorphic Top Header */}
      <header className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div className={styles.avatarRing}>
            {staffInfo?.name ? staffInfo.name.slice(0, 2).toUpperCase() : 'SG'}
            <div className={styles.onlineBadge} title="Active Session" />
          </div>
          <div>
            <h1 style={{ fontSize: '17px', fontWeight: 800, color: '#ffffff', margin: 0, letterSpacing: '-0.2px' }}>
              {staffInfo?.name || 'Staff Attendance Dashboard'}
            </h1>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '2px 0 0 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Staff ID:</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: '#a5b4fc', fontWeight: 700 }}>{staffInfo?.staffId || '—'}</span>
              <span>&bull;</span>
              <span>{orgData?.name || orgCode}</span>
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={handleManualRefresh}
            disabled={checking}
            className="btn btn-secondary btn-sm"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderRadius: '10px',
              padding: '8px 14px',
              fontSize: '12.5px',
              fontWeight: 600,
              background: 'rgba(255, 255, 255, 0.05)',
              borderColor: 'rgba(255, 255, 255, 0.1)',
            }}
          >
            <RefreshCw size={14} className={checking ? 'animate-spin' : ''} color="#a5b4fc" />
            <span>Re-verify</span>
          </button>
          <Link
            href={`/${orgCode}/staff/attendance`}
            className="btn btn-secondary btn-sm"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderRadius: '10px',
              padding: '8px 14px',
              fontSize: '12.5px',
              fontWeight: 600,
              background: 'rgba(255, 255, 255, 0.05)',
              borderColor: 'rgba(255, 255, 255, 0.1)',
              color: '#f8fafc',
            }}
          >
            <History size={14} color="#38bdf8" />
            <span>Punch History</span>
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ padding: '28px 24px 80px 24px', maxWidth: '1200px', width: '100%', margin: '0 auto' }}>
        {/* NO SCHEDULE BANNER */}
        {!loading && !hasSchedule && (
          <div className={styles.noScheduleBanner}>
            <AlertTriangle size={24} color="#fbbf24" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: '14.5px', color: '#ffffff' }}>
                No Shift Schedule Assigned Today
              </div>
              <div style={{ fontSize: '12.5px', marginTop: '2px', color: '#cbd5e1' }}>
                Clock-in is temporarily locked because no shift is scheduled for your profile today. Contact your organization administrator if this is unexpected.
              </div>
            </div>
          </div>
        )}

        {/* SYSTEMATIC 2-COLUMN DESKTOP LAYOUT */}
        <div className={styles.mainLayout}>
          {/* LEFT: LIVE DIGITAL CLOCK & HERO PUNCH HUB */}
          <div className={styles.heroClockCard}>
            <div style={{ width: '100%' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Live System Time
              </div>
              <div className={styles.liveClockDisplay}>{currentTime || '12:00:00 PM'}</div>
              <div style={{ fontSize: '12.5px', color: '#94a3b8', marginTop: '4px' }}>
                {currentDateStr}
              </div>

              <div style={{ marginTop: '12px' }}>
                <span className={styles.shiftBadge}>
                  <Calendar size={13} color="#818cf8" />
                  <span>
                    {todayStatus?.schedule?.shiftPatternName
                      ? `${todayStatus.schedule.shiftPatternName} (${todayStatus.schedule.startTime} – ${todayStatus.schedule.endTime})`
                      : 'Shift Schedule'}
                  </span>
                </span>
              </div>
            </div>

            <div style={{ width: '100%', margin: '28px 0' }}>
              {isCompleted ? (
                <div>
                  <CheckCircle2 size={48} color="#34d399" style={{ margin: '0 auto 12px auto' }} />
                  <h2 style={{ fontSize: '19px', fontWeight: 800, color: '#ffffff', marginBottom: '4px' }}>
                    Today&apos;s Attendance Complete
                  </h2>
                  <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '16px' }}>
                    You have completed your scheduled attendance shift for today.
                  </p>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '12.5px', fontWeight: 800, color: isClockedIn ? '#fbbf24' : '#34d399', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
                    {isClockedIn ? '● Currently Clocked In' : isReadyToClock ? '● Ready to Clock In' : '● Verification Required'}
                  </div>

                  {isClockedIn && (
                    <div style={{ fontSize: '13.5px', color: '#cbd5e1', marginBottom: '18px' }}>
                      Clocked in at <strong style={{ color: '#ffffff', fontFamily: 'var(--font-mono)' }}>{todayStatus?.lastClockInTime}</strong>
                      {todayStatus?.lateMinutes ? (
                        <span style={{ color: '#fbbf24', marginLeft: '8px', fontSize: '12px', fontWeight: 700 }}>
                          (Late by {todayStatus.lateMinutes} mins)
                        </span>
                      ) : (
                        <span style={{ color: '#34d399', marginLeft: '8px', fontSize: '12px', fontWeight: 700 }}>(On Time)</span>
                      )}
                    </div>
                  )}

                  <button
                    onClick={handleClockButtonClick}
                    disabled={!isReadyToClock && !isClockedIn || clocking || checking}
                    className={`${styles.clockButton} ${
                      isClockedIn
                        ? styles.clockButtonOut
                        : isReadyToClock
                        ? styles.clockButtonIn
                        : styles.clockButtonDisabled
                    }`}
                  >
                    {clocking ? (
                      <>
                        <Loader2 size={20} className="animate-spin" />
                        <span>Processing Verification...</span>
                      </>
                    ) : isClockedIn ? (
                      <>
                        <Clock size={20} />
                        <span>Clock Out Now</span>
                      </>
                    ) : (
                      <>
                        <Clock size={20} />
                        <span>Clock In Now</span>
                      </>
                    )}
                  </button>

                  {!isReadyToClock && !isClockedIn && (
                    <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '14px', lineHeight: '1.4' }}>
                      {!hasSchedule
                        ? 'Clock in is disabled because no shift schedule is assigned for today.'
                        : 'All 3 verification security checks (Device, Network, Location) must pass to enable Clock In.'}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={15} color="#818cf8" />
              <span>3-Layer Security Verification Enforced</span>
            </div>
          </div>

          {/* RIGHT: THREE-LAYER VERIFICATION STACK */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '-0.2px' }}>
                <ShieldCheck size={18} color="#818cf8" />
                <span>Verification Security Stack</span>
              </h2>
              <span style={{ fontSize: '11.5px', color: '#94a3b8', fontWeight: 600 }}>Live Real-Time Checks</span>
            </div>

            <div className={styles.verificationGrid}>
              {/* LAYER 1: DEVICE */}
              <div
                className={`${styles.verificationCard} ${
                  precheck?.layer1Device.isVerified ? styles.verificationVerified : styles.verificationFailed
                }`}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ padding: '8px', borderRadius: '10px', backgroundColor: precheck?.layer1Device.isVerified ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)' }}>
                      <Smartphone size={18} color={precheck?.layer1Device.isVerified ? '#34d399' : '#f43f5e'} />
                    </div>
                    <div>
                      <span className={styles.layerPill}>Layer 1</span>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>Registered Device</div>
                    </div>
                  </div>
                  {precheck?.layer1Device.isVerified ? <CheckCircle2 size={18} color="#34d399" /> : <XCircle size={18} color="#f43f5e" />}
                </div>
                <div style={{ fontSize: '12.5px', color: '#cbd5e1', lineHeight: '1.4', marginTop: '2px' }}>
                  {precheck?.layer1Device.message || 'Checking device secret...'}
                </div>
              </div>

              {/* LAYER 2: NETWORK IP */}
              <div
                className={`${styles.verificationCard} ${
                  precheck?.layer2Network.isVerified ? styles.verificationVerified : styles.verificationFailed
                }`}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ padding: '8px', borderRadius: '10px', backgroundColor: precheck?.layer2Network.isVerified ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)' }}>
                      <Wifi size={18} color={precheck?.layer2Network.isVerified ? '#34d399' : '#f43f5e'} />
                    </div>
                    <div>
                      <span className={styles.layerPill}>Layer 2</span>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>Branch Network IP</div>
                    </div>
                  </div>
                  {precheck?.layer2Network.isVerified ? <CheckCircle2 size={18} color="#34d399" /> : <XCircle size={18} color="#f43f5e" />}
                </div>
                <div style={{ fontSize: '12.5px', color: '#cbd5e1', lineHeight: '1.4', marginTop: '2px' }}>
                  {precheck?.layer2Network.message || 'Checking network public IP...'}
                </div>
              </div>

              {/* LAYER 3: GEOFENCE */}
              <div
                className={`${styles.verificationCard} ${
                  precheck?.layer3Geofence.isVerified
                    ? styles.verificationVerified
                    : locationError
                    ? styles.verificationWarning
                    : styles.verificationFailed
                }`}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ padding: '8px', borderRadius: '10px', backgroundColor: precheck?.layer3Geofence.isVerified ? 'rgba(16, 185, 129, 0.12)' : locationError ? 'rgba(245, 158, 11, 0.12)' : 'rgba(244, 63, 94, 0.12)' }}>
                      <MapPin size={18} color={precheck?.layer3Geofence.isVerified ? '#34d399' : locationError ? '#fbbf24' : '#f43f5e'} />
                    </div>
                    <div>
                      <span className={styles.layerPill}>Layer 3</span>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>Branch Geofence GPS</div>
                    </div>
                  </div>
                  {precheck?.layer3Geofence.isVerified ? (
                    <CheckCircle2 size={18} color="#34d399" />
                  ) : (
                    <XCircle size={18} color={locationError ? '#fbbf24' : '#f43f5e'} />
                  )}
                </div>
                <div style={{ fontSize: '12.5px', color: '#cbd5e1', lineHeight: '1.4', marginTop: '2px' }}>
                  {locationError ? locationError : precheck?.layer3Geofence.message || 'Checking GPS location...'}
                </div>
              </div>

              {/* SCHEDULE CHECK */}
              <div
                className={`${styles.verificationCard} ${
                  hasSchedule ? styles.verificationVerified : styles.verificationFailed
                }`}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ padding: '8px', borderRadius: '10px', backgroundColor: hasSchedule ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)' }}>
                      <Clock size={18} color={hasSchedule ? '#34d399' : '#f43f5e'} />
                    </div>
                    <div>
                      <span className={styles.layerPill}>Shift Check</span>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>Assigned Shift</div>
                    </div>
                  </div>
                  {hasSchedule ? <CheckCircle2 size={18} color="#34d399" /> : <XCircle size={18} color="#f43f5e" />}
                </div>
                <div style={{ fontSize: '12.5px', color: '#cbd5e1', lineHeight: '1.4', marginTop: '2px' }}>
                  {hasSchedule && todayStatus?.schedule?.startTime && todayStatus?.schedule?.endTime
                    ? `${todayStatus.schedule.shiftPatternName || 'Shift'}: ${todayStatus.schedule.startTime} – ${todayStatus.schedule.endTime}`
                    : 'No shift schedule assigned for today.'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* QUICK ACTION TILES */}
        <div style={{ marginBottom: '14px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '-0.2px' }}>
            <Sparkles size={18} color="#38bdf8" />
            <span>Quick Actions</span>
          </h2>
        </div>

        <div className={styles.quickActionsGrid}>
          <Link href={`/${orgCode}/staff/leave/new`} className={styles.quickTile}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FilePlus size={22} />
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>Apply Leave</div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>Submit time-off request</div>
              </div>
            </div>
            <ChevronRight size={18} className={styles.arrowIcon} />
          </Link>

          <button
            type="button"
            onClick={() => setShowCorrectionModal(true)}
            className={styles.quickTile}
            style={{ width: '100%', cursor: 'pointer', textAlign: 'left' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertCircle size={22} />
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>Request Correction</div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>Fix missed punch</div>
              </div>
            </div>
            <ChevronRight size={18} className={styles.arrowIcon} />
          </button>

          <Link href={`/${orgCode}/staff/attendance`} className={styles.quickTile}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: 'rgba(129, 140, 248, 0.12)', color: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <History size={22} />
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>View Log History</div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>Complete punch history</div>
              </div>
            </div>
            <ChevronRight size={18} className={styles.arrowIcon} />
          </Link>
        </div>

        {/* RECENT ATTENDANCE ACTIVITY */}
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '-0.2px' }}>
            <History size={18} color="#818cf8" />
            <span>Recent Attendance Logs</span>
          </h2>

          <div className={styles.historyTableCard}>
            {recentRecords.length === 0 ? (
              <div style={{ padding: '36px 20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                No recent attendance logs found.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr className={styles.tableHeaderRow}>
                    <th className={styles.tableHeaderTh}>Punch Type</th>
                    <th className={styles.tableHeaderTh}>Branch</th>
                    <th className={styles.tableHeaderTh}>Timestamp</th>
                    <th className={styles.tableHeaderTh}>Verification Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRecords.map((r, i) => (
                    <tr key={i} className={styles.tableRow}>
                      <td className={styles.tableTd}>
                        <span
                          style={{
                            fontSize: '11.5px',
                            fontWeight: 800,
                            padding: '4px 10px',
                            borderRadius: '6px',
                            backgroundColor: r.type === 'CLOCK_IN' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                            color: r.type === 'CLOCK_IN' ? '#34d399' : '#fbbf24',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Clock size={12} />
                          {r.type === 'CLOCK_IN' ? 'CLOCK IN' : 'CLOCK OUT'}
                        </span>
                      </td>
                      <td className={styles.tableTd} style={{ color: '#ffffff', fontWeight: 600 }}>
                        {r.branch?.name || 'Main Branch'}
                      </td>
                      <td className={styles.tableTd} style={{ fontFamily: 'var(--font-mono)', color: '#cbd5e1' }}>
                        {new Date(r.timestamp).toLocaleString()}
                      </td>
                      <td className={styles.tableTd}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(16, 185, 129, 0.15)',
                            color: '#34d399',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                          }}
                        >
                          VERIFIED
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>

      {/* EARLY CLOCK-OUT WARNING MODAL */}
      <ConfirmationModal
        isOpen={showEarlyClockOutModal}
        onClose={() => setShowEarlyClockOutModal(false)}
        onConfirm={() => executeClockAction('CLOCK_OUT')}
        title="Your shift has not ended yet"
        message={`Your scheduled shift end time is ${todayStatus?.schedule?.endTime || '5:00 PM'}. You still have ${earlyClockOutMinutes} minutes remaining. Are you sure you want to clock out early now?`}
        confirmText="Clock Out Early"
        variant="warning"
      />

      {/* ATTENDANCE CORRECTION REQUEST MODAL */}
      <CorrectionRequestModal
        organizationCode={orgCode}
        isOpen={showCorrectionModal}
        onClose={() => setShowCorrectionModal(false)}
        onSuccess={() => runPrecheck()}
      />
    </div>
  );
}
