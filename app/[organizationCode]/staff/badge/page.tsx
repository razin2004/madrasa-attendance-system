'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import QRCode from 'qrcode';
import {
  QrCode,
  Printer,
  Download,
  ShieldCheck,
  Building2,
  User,
  Loader2,
  Sparkles,
  RefreshCw,
  Phone,
  Calendar,
} from 'lucide-react';
import { StaffSidebar } from '@/components/layout/staff-sidebar';
import styles from './StaffBadge.module.css';

export default function StaffDigitalBadgePage() {
  const params = useParams();
  const orgCode = (params.organizationCode as string)?.toUpperCase() || '';

  const [loading, setLoading] = useState(true);
  const [orgData, setOrgData] = useState<any>(null);
  const [staffInfo, setStaffInfo] = useState<any>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        // Load precheck data which provides staff info and org data
        const res = await fetch(`/api/org/${orgCode}/attendance/precheck`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });

        const data = await res.json();
        if (data.organization) setOrgData(data.organization);
        if (data.staff) {
          setStaffInfo(data.staff);

          // Generate QR Code containing staff JSON payload
          const qrPayload = JSON.stringify({
            staffId: data.staff.staffId,
            userId: data.staff.userId || data.staff.id,
            name: data.staff.name,
            org: orgCode,
          });

          const url = await QRCode.toDataURL(qrPayload, {
            width: 300,
            margin: 1,
            color: {
              dark: '#0f172a',
              light: '#ffffff',
            },
          });
          setQrDataUrl(url);
        }
      } catch (err: any) {
        console.error('Failed to load digital badge:', err);
        setErrorMsg('Failed to generate digital badge. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    if (orgCode) {
      loadData();
    }
  }, [orgCode]);

  const handlePrintBadge = () => {
    window.print();
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `QR_Badge_${staffInfo?.staffId || 'Staff'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={styles.container}>
      <StaffSidebar
        organizationCode={orgCode}
        isCollapsed={false}
        onToggleCollapse={() => {}}
        onSignOut={() => {}}
      />

      <div className={styles.mainContent}>
        <header className={styles.header}>
          <h1 className={styles.title}>Digital ID &amp; Touchless Badge</h1>
          <p className={styles.subtitle}>
            Use your personal QR Code badge for instant touchless kiosk check-ins and identity verification.
          </p>
        </header>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
            <Loader2 className="animate-spin" size={40} style={{ color: '#3b82f6', marginBottom: '1rem' }} />
            <p style={{ color: '#94a3b8' }}>Generating secure digital badge...</p>
          </div>
        ) : errorMsg ? (
          <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>
            <p>{errorMsg}</p>
          </div>
        ) : (
          <div className={styles.badgeWrapper}>
            {/* Metallic Glass Card */}
            <div className={styles.badgeCard}>
              <div className={styles.cardHeader}>
                <div className={styles.orgBrand}>
                  {orgData?.logoUrl ? (
                    <img src={orgData.logoUrl} alt="Org Logo" className={styles.orgLogo} />
                  ) : (
                    <div className={styles.orgLogo} style={{ background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Building2 size={20} color="#fff" />
                    </div>
                  )}
                  <span className={styles.orgName}>{orgData?.name || 'ShiftGuard Platform'}</span>
                </div>

                <div className={styles.verifiedPill}>
                  <ShieldCheck size={14} />
                  <span>ACTIVE</span>
                </div>
              </div>

              {/* Staff Avatar & Info */}
              <div className={styles.profileSection}>
                <div className={styles.avatarRing}>
                  <div className={styles.avatar}>
                    {staffInfo?.name
                      ? staffInfo.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')
                      : <User size={36} />}
                  </div>
                </div>

                <h2 className={styles.staffName}>{staffInfo?.name || 'Staff Member'}</h2>
                <p className={styles.staffRole}>{staffInfo?.role || 'Staff Profile'}</p>
                <div className={styles.staffCodeBadge}>
                  ID: {staffInfo?.staffId || 'STF-001'}
                </div>
              </div>

              {/* QR Code Container */}
              <div className={styles.qrContainer}>
                {qrDataUrl && (
                  <img src={qrDataUrl} alt="Staff QR Code Badge" className={styles.qrCodeSvg} />
                )}
                <span className={styles.qrHint}>Scan at Kiosk Terminal</span>
              </div>

              {/* Card Footer Details */}
              <div className={styles.cardFooter}>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Branch</span>
                  <span className={styles.infoValue}>{staffInfo?.branchName || 'Main Branch'}</span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Issued Code</span>
                  <span className={styles.infoValue}>{staffInfo?.staffId || orgCode}</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className={styles.actionsBar}>
              <button onClick={handlePrintBadge} className={`${styles.actionBtn} ${styles.primaryBtn}`}>
                <Printer size={18} />
                <span>Print Physical Badge</span>
              </button>

              <button onClick={handleDownloadQr} className={`${styles.actionBtn} ${styles.secondaryBtn}`}>
                <Download size={18} />
                <span>Save QR Image</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
