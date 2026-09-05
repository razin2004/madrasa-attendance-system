'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Camera,
  CheckCircle2,
  XCircle,
  LogOut,
  Sparkles,
  QrCode,
  Building2,
  RefreshCw,
  AlertCircle,
  Clock,
  Send,
  Loader2,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import styles from './KioskScanner.module.css';

export default function KioskScannerPage() {
  const params = useParams();
  const orgCode = (params.organizationCode as string)?.toUpperCase() || '';

  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [cameraActive, setCameraActive] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [submittingManual, setSubmittingManual] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Scan Result State
  const [scanResult, setScanResult] = useState<{
    action: 'PUNCH_IN' | 'PUNCH_OUT' | 'ERROR';
    staffName?: string;
    branchName?: string;
    message?: string;
    timestamp?: string;
  } | null>(null);

  const processingRef = useRef(false);
  const scannerRef = useRef<any>(null);

  // Audio tone generator for instant feedback
  const playAudioBeep = (type: 'PUNCH_IN' | 'PUNCH_OUT' | 'ERROR') => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'PUNCH_IN') {
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      } else if (type === 'PUNCH_OUT') {
        osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
        osc.frequency.setValueAtTime(523.25, ctx.currentTime + 0.1); // C5
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      } else {
        osc.frequency.setValueAtTime(220, ctx.currentTime); // A3
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch {
      // Audio playback ignored if restricted by browser policy
    }
  };

  // Process Scanned Identifier Payload
  const processQrScan = useCallback(async (qrString: string) => {
    if (processingRef.current) return;
    processingRef.current = true;

    try {
      const res = await fetch(`/api/org/${orgCode}/attendance/kiosk-scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: qrString,
          branchId: selectedBranchId || undefined,
        }),
      });

      const data = await res.json();

      if (data.success) {
        const actionType = data.action === 'PUNCH_IN' ? 'PUNCH_IN' : 'PUNCH_OUT';
        playAudioBeep(actionType);
        setScanResult({
          action: actionType,
          staffName: data.staff.name,
          branchName: data.staff.branchName,
          message: data.message,
          timestamp: new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });
      } else {
        playAudioBeep('ERROR');
        setScanResult({
          action: 'ERROR',
          message: data.error || 'Scan failed or staff record not found.',
        });
      }
    } catch (err: any) {
      playAudioBeep('ERROR');
      setScanResult({
        action: 'ERROR',
        message: 'Network connection error processing kiosk scan.',
      });
    } finally {
      // Auto dismiss overlay and allow next scan after 3 seconds
      setTimeout(() => {
        setScanResult(null);
        processingRef.current = false;
      }, 3000);
    }
  }, [orgCode, selectedBranchId]);

  // Load org branches
  useEffect(() => {
    fetch(`/api/org/${orgCode}/branches`)
      .then((res) => res.json())
      .then((data) => {
        if (data.branches && Array.isArray(data.branches)) {
          setBranches(data.branches);
          if (data.branches.length > 0) {
            setSelectedBranchId(data.branches[0].id);
          }
        }
      })
      .catch((err) => console.error('Failed to load branches:', err));
  }, [orgCode]);

  // Initialize html5-qrcode camera scanner dynamically
  useEffect(() => {
    let isMounted = true;
    let html5QrCode: any = null;

    async function startCamera() {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (!isMounted) return;

        html5QrCode = new Html5Qrcode('kiosk-reader-element');
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: 'user' },
          {
            fps: 10,
            qrbox: { width: 260, height: 260 },
          },
          (decodedText: string) => {
            processQrScan(decodedText);
          },
          () => {
            // Ignore scan attempt failures (normal frame scanning)
          }
        );
        if (isMounted) setCameraActive(true);
      } catch (err) {
        console.warn('Camera failed to start or access denied:', err);
        if (isMounted) setCameraActive(false);
      }
    }

    startCamera();

    return () => {
      isMounted = false;
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [processQrScan]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim() || submittingManual) return;
    setSubmittingManual(true);
    processQrScan(manualCode.trim()).finally(() => {
      setSubmittingManual(false);
      setManualCode('');
    });
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* Kiosk Header Bar */}
      <header className={styles.topBar}>
        <div className={styles.brandInfo}>
          <h1 className={styles.brandTitle}>
            <QrCode size={24} style={{ color: '#38bdf8' }} />
            <span>ShiftGuard Kiosk Terminal</span>
          </h1>
          <span className={styles.kioskPill}>1-Second Touchless Scan</span>
        </div>

        <div className={styles.controls}>
          {branches.length > 0 && (
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className={styles.selectInput}
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  📍 {b.name}
                </option>
              ))}
            </select>
          )}

          <button onClick={toggleFullscreen} className={styles.selectInput} title="Toggle Fullscreen">
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>

          <Link href={`/${orgCode}/admin`} className={styles.exitBtn}>
            <LogOut size={16} />
            <span>Exit Kiosk</span>
          </Link>
        </div>
      </header>

      {/* Main Scanner Viewport Area */}
      <div className={styles.viewportArea}>
        <div className={styles.cameraCard}>
          <div id="kiosk-reader-element" style={{ width: '100%', height: '100%' }} />

          {cameraActive && (
            <>
              <div className={styles.laserLine} />
              <div className={styles.scannerOverlayFrame} />
            </>
          )}

          {!cameraActive && (
            <div className={styles.cameraFallback}>
              <Camera size={48} />
              <p>Camera feed starting or waiting for permission...</p>
            </div>
          )}
        </div>

        <div className={styles.instructions}>
          <h2 className={styles.instructText}>Hold Digital Badge or QR Code up to Camera</h2>
          <p className={styles.instructSub}>
            Automatic touchless clock-in &amp; clock-out for registered staff.
          </p>
        </div>

        {/* Manual Staff Code Entry Fallback */}
        <form onSubmit={handleManualSubmit} className={styles.manualInputBar}>
          <input
            type="text"
            placeholder="Or enter Staff ID (e.g. STF-001)..."
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            className={styles.manualInput}
          />
          <button type="submit" disabled={submittingManual} className={styles.manualBtn}>
            {submittingManual ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
          </button>
        </form>
      </div>

      {/* Instant Flash Result Overlay */}
      {scanResult && (
        <div
          className={`${styles.flashOverlay} ${
            scanResult.action === 'PUNCH_IN'
              ? styles.punchInFlash
              : scanResult.action === 'PUNCH_OUT'
              ? styles.punchOutFlash
              : styles.errorFlash
          }`}
        >
          <div className={styles.resultCard}>
            <div className={styles.iconCircle}>
              {scanResult.action === 'ERROR' ? (
                <XCircle size={54} color="#ffffff" />
              ) : (
                <CheckCircle2 size={54} color="#ffffff" />
              )}
            </div>

            <h2 className={styles.resultTitle}>
              {scanResult.action === 'PUNCH_IN'
                ? 'CHECKED IN SUCCESS'
                : scanResult.action === 'PUNCH_OUT'
                ? 'CHECKED OUT SUCCESS'
                : 'SCAN FAILED'}
            </h2>

            {scanResult.staffName && (
              <p className={styles.staffName}>{scanResult.staffName}</p>
            )}

            {scanResult.branchName && (
              <p className={styles.staffBranch}>📍 {scanResult.branchName}</p>
            )}

            <p style={{ fontSize: '1.1rem', marginBottom: '1.5rem', opacity: 0.9 }}>
              {scanResult.message}
            </p>

            {scanResult.timestamp && (
              <div className={styles.timePill}>
                ⏰ {scanResult.timestamp}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
