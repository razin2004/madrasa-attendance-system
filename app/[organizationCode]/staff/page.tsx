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
  Sparkles,
  Loader2,
  AlertCircle,
  LogOut,
  Navigation,
  Activity,
  Check,
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
    label?: string | null;
  };
  layer2Network: {
    isVerified: boolean;
    title: string;
    message: string;
    status: 'SUCCESS' | 'FAILED' | 'WARNING';
    branchName?: string;
    requestIp?: string;
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

  // Device Binding Confirmation Modal State
  const [showDeviceBindingModal, setShowDeviceBindingModal] = useState(false);
  const [registeringDevice, setRegisteringDevice] = useState(false);
  const [pendingPrecheckCtx, setPendingPrecheckCtx] = useState<{ headers: any; bodyData: any } | null>(null);

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
            accuracy: Math.round(position.coords.accuracy),
          };
          setLocationCoords(coords);
          setLocationError(null);
          resolve(coords);
        },
        (highAccErr) => {
          if (highAccErr.code === highAccErr.PERMISSION_DENIED) {
            setLocationError('Location access was denied. Please enable location permissions in browser settings.');
            resolve(null);
            return;
          }
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const coords = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: Math.round(position.coords.accuracy),
              };
              setLocationCoords(coords);
              setLocationError(null);
              resolve(coords);
            },
            (lowAccErr) => {
              let msg = 'Unable to fetch your location coordinates.';
              if (lowAccErr.code === lowAccErr.PERMISSION_DENIED) {
                msg = 'Location access was denied. Please allow location permissions in browser settings.';
              } else if (lowAccErr.code === lowAccErr.POSITION_UNAVAILABLE) {
                msg = 'Location signal unavailable. Ensure GPS / Location services are enabled.';
              } else if (lowAccErr.code === lowAccErr.TIMEOUT) {
                msg = 'Location request timed out. Click Re-verify to try again.';
              }
              setLocationError(msg);
              resolve(null);
            },
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 30000 }
          );
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    });
  }, []);

  const runPrecheck = useCallback(
    async (coords?: { latitude: number; longitude: number; accuracy?: number } | null, isManual: boolean = false) => {
      if (isManual) {
        setChecking(true);
      }
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
            toast.success('Security verification status refreshed.');
          }

          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('shiftguard_precheck_updated', { detail: data.evaluation.isReady }));
          }

          // Trigger Device Binding Confirmation Modal if device is not registered
          const needsDeviceBinding =
            !data.evaluation.layer1Device.isVerified &&
            (data.staff?.deviceStatus === 'NOT_REGISTERED' ||
              data.staff?.deviceStatus === 'RESET_REQUIRED' ||
              data.staff?.hasPendingDeviceSlot ||
              !data.staffProfile?.devices ||
              data.staffProfile.devices.length === 0 ||
              data.staffProfile.devices.some((d: any) => d.status === 'NOT_REGISTERED' || d.status === 'RESET_REQUIRED'));

          if (needsDeviceBinding) {
            setPendingPrecheckCtx({ headers, bodyData });
            setShowDeviceBindingModal(true);
          }
        } else {
          setFetchError(data.error || null);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('shiftguard_precheck_updated', { detail: false }));
          }
        }
      } catch {
        setFetchError('Failed to fetch precheck verification data.');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('shiftguard_precheck_updated', { detail: false }));
        }
      } finally {
        setLoading(false);
        setChecking(false);
      }
    },
    [getOrCreateDeviceSecret, orgCode, router, toast]
  );

  const initData = useCallback(async () => {
    setLoading(true);
    // Initial pre-check on load runs without triggering automatic geolocation browser prompts or manual refresh state
    await runPrecheck(locationCoords || null, false);

    try {
      const histRes = await fetch(`/api/org/${orgCode}/attendance/history?limit=5`);
      const histData = await histRes.json();
      if (histData.success) {
        setRecentRecords(histData.records || []);
      }
    } catch {}

    setLoading(false);
  }, [locationCoords, orgCode, runPrecheck]);

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

  const handleCancelDeviceRegistration = async () => {
    try {
      localStorage.removeItem('shiftguard_device_secret');
      await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    } finally {
      toast.info('Device registration cancelled. Signed out.');
      setShowDeviceBindingModal(false);
      router.push(`/${orgCode}/login`);
    }
  };

  const handleProceedDeviceRegistration = async () => {
    try {
      setRegisteringDevice(true);
      const deviceSecret = getOrCreateDeviceSecret();
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
        toast.success('Device registered successfully as your primary security device!');
        setShowDeviceBindingModal(false);

        if (pendingPrecheckCtx) {
          const recheckRes = await fetch(`/api/org/${orgCode}/attendance/precheck`, {
            method: 'POST',
            headers: pendingPrecheckCtx.headers,
            body: JSON.stringify(pendingPrecheckCtx.bodyData),
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
      } else {
        toast.error(regData.error || 'Failed to register device.');
      }
    } catch {
      toast.error('Network error registering device.');
    } finally {
      setRegisteringDevice(false);
    }
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

      // 1. Mandatory Live Backend Security Evaluation
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
            errorMsg = livePrecheckData.evaluation.layer2Network?.message || 'Your current network IP is not registered for your branch.';
          } else if (!livePrecheckData.evaluation.layer3Geofence?.isVerified) {
            errorMsg = livePrecheckData.evaluation.layer3Geofence?.message || 'Outside branch geofence boundary.';
          } else if (!livePrecheckData.evaluation.layer1Device?.isVerified) {
            errorMsg = 'Current device is not registered to your account.';
          }

          toast.error(errorMsg);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('shiftguard_precheck_updated', { detail: false }));
          }
          setClocking(false);
          return;
        }
      }

      // 2. Verified Live Security Passed -> Execute Punch
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
      toast.error('Network error recording attendance punch.');
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

  const initials = staffInfo?.name
    ? staffInfo.name.trim().split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : 'SG';

  const verifiedLayersCount = [
    precheck?.layer1Device.isVerified,
    precheck?.layer2Network.isVerified,
    precheck?.layer3Geofence.isVerified,
  ].filter(Boolean).length;

  return (
    <div className={styles.container}>
      {/* Glassmorphic Top Navigation Header */}
      <header className={styles.header}>
        <div className={styles.headerTitleGroup}>
          <div className={styles.avatarRing}>
            {initials}
            <div className={styles.onlineBadge} title="Active Staff Session" />
          </div>
          <div>
            <h1 style={{ fontSize: '17px', fontWeight: 800, color: '#ffffff', margin: 0, letterSpacing: '-0.2px' }}>
              {staffInfo?.name || 'Staff Attendance Portal'}
            </h1>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '2px 0 0 0', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span>Staff ID:</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: '#a5b4fc', fontWeight: 700 }}>{staffInfo?.staffId || '—'}</span>
              {(staffInfo?.user?.email || staffInfo?.email) && (
                <>
                  <span>&bull;</span>
                  <span style={{ color: '#cbd5e1' }}>{staffInfo?.user?.email || staffInfo?.email}</span>
                </>
              )}
              <span>&bull;</span>
              <span style={{ color: '#cbd5e1' }}>{orgData?.name || orgCode}</span>
            </p>
          </div>
        </div>

        <div className={styles.headerNavControls}>
          <button
            onClick={handleManualRefresh}
            disabled={checking}
            className={styles.headerButton}
          >
            <RefreshCw size={14} className={checking ? 'animate-spin' : ''} color="#a5b4fc" />
            <span>{checking ? 'Verifying...' : 'Re-verify'}</span>
          </button>
          <Link
            href={`/${orgCode}/staff/attendance`}
            className={styles.headerButton}
          >
            <History size={14} color="#38bdf8" />
            <span>Punch Log</span>
          </Link>
        </div>
      </header>

      {/* Main Container Body */}
      <main style={{ padding: '16px 24px 80px 24px', maxWidth: '1240px', width: '100%', margin: '0 auto' }}>
        


        {/* NO SCHEDULE WARNING BANNER */}
        {!loading && !hasSchedule && (
          <div className={styles.noScheduleBanner}>
            <AlertTriangle size={24} color="#fbbf24" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: '14.5px', color: '#ffffff' }}>
                No Shift Schedule Assigned Today
              </div>
              <div style={{ fontSize: '12.5px', marginTop: '2px', color: '#cbd5e1', lineHeight: '1.4' }}>
                Clock-in is temporarily locked because no active shift schedule is assigned to your profile for today. Contact your organization administrator if you need a shift assigned.
              </div>
            </div>
          </div>
        )}

        {/* MAIN 2-COLUMN GRID */}
        <div className={styles.mainLayout}>
          
          {/* PANEL 1: LIVE DIGITAL CLOCK & HERO ACTION HUB */}
          <div className={styles.heroClockCard}>
            <div style={{ width: '100%' }}>
              <div className={styles.clockHeaderLabel}>
                Live Workspace System Time
              </div>
              <div className={styles.liveClockDisplay}>{currentTime || '12:00:00 PM'}</div>
              <div className={styles.currentDateText}>
                {currentDateStr}
              </div>

              <div>
                <span className={styles.shiftBadge}>
                  <Calendar size={14} color="#818cf8" />
                  <span>
                    {todayStatus?.schedule?.shiftPatternName
                      ? `${todayStatus.schedule.shiftPatternName} (${todayStatus.schedule.startTime} – ${todayStatus.schedule.endTime})`
                      : 'Assigned Shift Schedule'}
                  </span>
                </span>
              </div>
            </div>

            <div className={styles.punchContainer}>
              {isCompleted ? (
                <div>
                  <CheckCircle2 size={52} color="#34d399" style={{ margin: '0 auto 12px auto' }} />
                  <h2 style={{ fontSize: '19px', fontWeight: 800, color: '#ffffff', marginBottom: '4px' }}>
                    Today&apos;s Attendance Complete 🎉
                  </h2>
                  <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '16px' }}>
                    You have successfully completed your shift attendance for today.
                  </p>
                </div>
              ) : (
                <div style={{ width: '100%' }}>
                  <div className={`${styles.statusPill} ${isClockedIn ? styles.statusPillIn : isReadyToClock ? styles.statusPillReady : styles.statusPillLock}`}>
                    {isClockedIn ? '● Currently Clocked In' : isReadyToClock ? '● Security Verified — Ready to Clock In' : '● Verification Checks Required'}
                  </div>

                  {isClockedIn && (
                    <div className={styles.clockedInInfo}>
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
                    disabled={(!isReadyToClock && !isClockedIn) || clocking || checking}
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
                        <span>Verifying &amp; Recording...</span>
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
                    <p className={styles.lockGuidanceText}>
                      {!hasSchedule
                        ? 'Clock-in is locked because no shift schedule is assigned for today.'
                        : 'All 3 security verification layers (Device, Network IP, Geofence GPS) must pass to unlock Clock In.'}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className={styles.zeroTrustFooter}>
              <ShieldCheck size={15} color="#818cf8" />
              <span>ShiftGuard 3-Layer Zero-Trust Security Verification</span>
            </div>
          </div>

          {/* PANEL 2: 3-LAYER SECURITY DIAGNOSTICS STACK */}
          <div>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                <ShieldCheck size={18} color="#818cf8" />
                <span>Security Diagnostics Stack</span>
              </h2>
              <span className={styles.sectionSubtitle}>Live Real-Time Checks</span>
            </div>

            <div className={styles.verificationGrid}>
              {/* LAYER 1: REGISTERED DEVICE */}
              <div
                className={`${styles.verificationCard} ${
                  precheck?.layer1Device.isVerified ? styles.verificationVerified : styles.verificationFailed
                }`}
              >
                <div className={styles.cardTopRow}>
                  <div className={styles.cardIconTitleGroup}>
                    <div className={styles.layerIconBox} style={{ backgroundColor: precheck?.layer1Device.isVerified ? 'rgba(16, 185, 129, 0.14)' : 'rgba(244, 63, 94, 0.14)' }}>
                      <Smartphone size={18} color={precheck?.layer1Device.isVerified ? '#34d399' : '#f43f5e'} />
                    </div>
                    <div>
                      <span className={styles.layerPill}>Layer 1</span>
                      <div className={styles.layerTitle}>Registered Staff Device</div>
                    </div>
                  </div>
                  {precheck?.layer1Device.isVerified ? <CheckCircle2 size={18} color="#34d399" /> : <XCircle size={18} color="#f43f5e" />}
                </div>
                <div className={styles.layerMessage}>
                  {precheck?.layer1Device.message || 'Evaluating device binding secret...'}
                </div>
              </div>

              {/* LAYER 2: BRANCH NETWORK PUBLIC IP */}
              <div
                className={`${styles.verificationCard} ${
                  precheck?.layer2Network.isVerified ? styles.verificationVerified : styles.verificationFailed
                }`}
              >
                <div className={styles.cardTopRow}>
                  <div className={styles.cardIconTitleGroup}>
                    <div className={styles.layerIconBox} style={{ backgroundColor: precheck?.layer2Network.isVerified ? 'rgba(16, 185, 129, 0.14)' : 'rgba(244, 63, 94, 0.14)' }}>
                      <Wifi size={18} color={precheck?.layer2Network.isVerified ? '#34d399' : '#f43f5e'} />
                    </div>
                    <div>
                      <span className={styles.layerPill}>Layer 2</span>
                      <div className={styles.layerTitle}>Branch Network Wi-Fi IP</div>
                    </div>
                  </div>
                  {precheck?.layer2Network.isVerified ? <CheckCircle2 size={18} color="#34d399" /> : <XCircle size={18} color="#f43f5e" />}
                </div>
                <div className={styles.layerMessage}>
                  {precheck?.layer2Network.message || 'Evaluating public network IP identity...'}
                </div>
              </div>

              {/* LAYER 3: GEOFENCE GPS DISTANCE */}
              <div
                className={`${styles.verificationCard} ${
                  precheck?.layer3Geofence.isVerified
                    ? styles.verificationVerified
                    : locationError
                    ? styles.verificationWarning
                    : styles.verificationFailed
                }`}
              >
                <div className={styles.cardTopRow}>
                  <div className={styles.cardIconTitleGroup}>
                    <div className={styles.layerIconBox} style={{ backgroundColor: precheck?.layer3Geofence.isVerified ? 'rgba(16, 185, 129, 0.14)' : locationError ? 'rgba(245, 158, 11, 0.14)' : 'rgba(244, 63, 94, 0.14)' }}>
                      <MapPin size={18} color={precheck?.layer3Geofence.isVerified ? '#34d399' : locationError ? '#fbbf24' : '#f43f5e'} />
                    </div>
                    <div>
                      <span className={styles.layerPill}>Layer 3</span>
                      <div className={styles.layerTitle}>Branch Geofence GPS</div>
                    </div>
                  </div>
                  {precheck?.layer3Geofence.isVerified ? (
                    <CheckCircle2 size={18} color="#34d399" />
                  ) : (
                    <XCircle size={18} color={locationError ? '#fbbf24' : '#f43f5e'} />
                  )}
                </div>

                <div className={styles.layerMessage}>
                  {locationError ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ color: '#fbbf24' }}>{locationError}</span>
                      <button
                        onClick={handleManualRefresh}
                        disabled={checking}
                        className="btn btn-secondary btn-sm"
                        style={{ alignSelf: 'flex-start', fontSize: '11px', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Navigation size={12} className={checking ? 'animate-spin' : ''} />
                        <span>{checking ? 'Verifying Location...' : 'Enable / Retry Location'}</span>
                      </button>
                    </div>
                  ) : (
                    precheck?.layer3Geofence.message || 'Evaluating GPS geofence boundary...'
                  )}
                </div>

                {precheck?.layer3Geofence.distanceMeters !== undefined && precheck.layer3Geofence.distanceMeters >= 0 && (
                  <div className={styles.distanceDetail}>
                    Calculated Distance: <strong style={{ color: precheck.layer3Geofence.isVerified ? '#34d399' : '#f87171' }}>{precheck.layer3Geofence.distanceMeters}m</strong> (Allowed Radius: {precheck.layer3Geofence.allowedRadiusMeters || 150}m
                    {precheck.layer3Geofence.accuracyMeters !== undefined ? `, Accuracy: ±${precheck.layer3Geofence.accuracyMeters}m` : ''})
                  </div>
                )}
              </div>

              {/* SHIFT SCHEDULE VALIDATION */}
              <div
                className={`${styles.verificationCard} ${
                  hasSchedule ? styles.verificationVerified : styles.verificationFailed
                }`}
              >
                <div className={styles.cardTopRow}>
                  <div className={styles.cardIconTitleGroup}>
                    <div className={styles.layerIconBox} style={{ backgroundColor: hasSchedule ? 'rgba(16, 185, 129, 0.14)' : 'rgba(244, 63, 94, 0.14)' }}>
                      <Clock size={18} color={hasSchedule ? '#34d399' : '#f43f5e'} />
                    </div>
                    <div>
                      <span className={styles.layerPill}>Shift Check</span>
                      <div className={styles.layerTitle}>Shift Roster Assigned</div>
                    </div>
                  </div>
                  {hasSchedule ? <CheckCircle2 size={18} color="#34d399" /> : <XCircle size={18} color="#f43f5e" />}
                </div>
                <div className={styles.layerMessage}>
                  {hasSchedule && todayStatus?.schedule?.startTime && todayStatus?.schedule?.endTime
                    ? `${todayStatus.schedule.shiftPatternName || 'Scheduled Shift'}: ${todayStatus.schedule.startTime} – ${todayStatus.schedule.endTime}`
                    : 'No active shift schedule assigned for today.'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PANEL 3: QUICK ACTIONS GRID */}
        <div style={{ marginBottom: '14px' }}>
          <h2 className={styles.sectionTitle}>
            <Sparkles size={18} color="#38bdf8" />
            <span>Quick Workspace Actions</span>
          </h2>
        </div>

        <div className={styles.quickActionsGrid}>
          <Link href={`/${orgCode}/staff/leave/new`} className={styles.quickTile}>
            <div className={styles.quickTileContent}>
              <div className={styles.quickTileIcon} style={{ backgroundColor: 'rgba(56, 189, 248, 0.14)', color: '#38bdf8' }}>
                <FilePlus size={22} />
              </div>
              <div>
                <div className={styles.quickTileTitle}>Apply Leave</div>
                <div className={styles.quickTileSub}>Submit time-off application</div>
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
            <div className={styles.quickTileContent}>
              <div className={styles.quickTileIcon} style={{ backgroundColor: 'rgba(245, 158, 11, 0.14)', color: '#fbbf24' }}>
                <AlertCircle size={22} />
              </div>
              <div>
                <div className={styles.quickTileTitle}>Request Correction</div>
                <div className={styles.quickTileSub}>Fix missed or incorrect punch</div>
              </div>
            </div>
            <ChevronRight size={18} className={styles.arrowIcon} />
          </button>

          <Link href={`/${orgCode}/staff/attendance`} className={styles.quickTile}>
            <div className={styles.quickTileContent}>
              <div className={styles.quickTileIcon} style={{ backgroundColor: 'rgba(129, 140, 248, 0.14)', color: '#818cf8' }}>
                <History size={22} />
              </div>
              <div>
                <div className={styles.quickTileTitle}>View Log History</div>
                <div className={styles.quickTileSub}>Full attendance history</div>
              </div>
            </div>
            <ChevronRight size={18} className={styles.arrowIcon} />
          </Link>
        </div>

        {/* PANEL 4: RECENT ATTENDANCE ACTIVITY LOGS */}
        <div style={{ marginBottom: '24px' }}>
          <h2 className={styles.sectionTitle} style={{ marginBottom: '14px' }}>
            <History size={18} color="#818cf8" />
            <span>Recent Attendance Logs</span>
          </h2>

          <div className={styles.historyTableCard}>
            {recentRecords.length === 0 ? (
              <div style={{ padding: '36px 20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                No recent attendance punch records found.
              </div>
            ) : (
              <table className={styles.historyTable}>
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
                        {new Date(r.timestamp).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'medium' })}
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

      {/* DEVICE BINDING CONFIRMATION MODAL */}
      {showDeviceBindingModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            backgroundColor: 'rgba(3, 7, 18, 0.88)',
            backdropFilter: 'blur(10px)',
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
              padding: '24px 20px',
              backgroundColor: '#0d121f',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(99, 102, 241, 0.15)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px auto',
                  color: '#818cf8',
                }}
              >
                <Smartphone size={28} />
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                Authorize &amp; Register Security Device
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                First-time sign-in / post-device reset verification notice
              </p>
            </div>

            <div
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '12px',
                padding: '18px',
                fontSize: '13px',
                lineHeight: '1.6',
                color: '#cbd5e1',
                marginBottom: '24px',
              }}
            >
              <p style={{ color: '#ffffff', fontWeight: 700, marginBottom: '10px' }}>
                📌 Device Binding Notice:
              </p>
              <p style={{ marginBottom: '10px' }}>
                You are logging in from an unregistered device. Proceeding will generate and bind a unique cryptographic security key for this phone/browser to your staff account.
              </p>
              <ul style={{ paddingLeft: '18px', margin: 0, fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                <li style={{ marginBottom: '4px' }}>Workplace attendance punching will be verified against this device.</li>
                <li>If you change devices, an administrator must reset your device binding before a new device can be authorized.</li>
              </ul>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={handleCancelDeviceRegistration}
                className="btn btn-secondary btn-sm"
                style={{ flex: 1, padding: '11px', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)' }}
              >
                Cancel &amp; Sign Out
              </button>

              <button
                type="button"
                disabled={registeringDevice}
                onClick={handleProceedDeviceRegistration}
                className="btn btn-primary btn-sm"
                style={{ flex: 1.2, padding: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                {registeringDevice ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Registering...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} />
                    <span>Proceed &amp; Register Device</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
