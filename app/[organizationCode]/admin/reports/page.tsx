'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  BarChart3,
  Calendar,
  Clock,
  FileText,
  Users,
  Building2,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  Menu,
} from 'lucide-react';
import { OrgAdminSidebar } from '@/components/layout/org-admin-sidebar';
import { OrgAdminMobileNav } from '@/components/layout/org-admin-mobile-nav';
import styles from './ReportsHome.module.css';

export default function ReportsDashboardPage() {
  const params = useParams();
  const organizationCode = (params.organizationCode as string)?.toUpperCase() || '';
  const [orgData, setOrgData] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/org/${organizationCode}/branding`).then((r) => r.json()),
      fetch(`/api/org/${organizationCode}/reports/dashboard`).then((r) => r.json()),
    ])
      .then(([metaRes, dashRes]) => {
        if (metaRes.organization) setOrgData(metaRes.organization);
        if (dashRes.success) setSummary(dashRes.summary);
      })
      .catch((err) => console.error('Error loading report dashboard:', err))
      .finally(() => setLoading(false));
  }, [organizationCode]);

  return (
    <div className={styles.container}>
      <OrgAdminSidebar
        organizationCode={organizationCode}
        organizationName={orgData?.name || 'ShiftGuard'}
        logoUrl={orgData?.logoUrl}
      />

      <div className={styles.mainContent}>
        {/* Header */}
        <header className={styles.headerBar} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 className={styles.title}>Reports &amp; Analytics</h1>
            <p className={styles.subtitle}>
              Review attendance, workforce coverage, leave, and operational activity across your organization.
            </p>
          </div>

          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setHeaderMenuOpen(!headerMenuOpen)}
              className="btn btn-secondary btn-sm"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '38px',
                height: '38px',
                padding: 0,
                borderRadius: '10px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-medium)',
                color: '#ffffff',
                cursor: 'pointer',
              }}
              title="Reports & Analytics Menu"
            >
              <Menu size={18} />
            </button>

            {headerMenuOpen && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 999 }}
                  onClick={() => setHeaderMenuOpen(false)}
                />
                <div
                  className="glass-card"
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 'calc(100% + 8px)',
                    zIndex: 1000,
                    minWidth: '220px',
                    padding: '6px',
                    backgroundColor: '#0d121f',
                    border: '1px solid var(--border-medium)',
                    borderRadius: '12px',
                    boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.8)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}
                >
                  <Link
                    href={`/${organizationCode}/admin/attendance`}
                    onClick={() => setHeaderMenuOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      color: '#ffffff',
                      textDecoration: 'none',
                      fontSize: '13px',
                      fontWeight: 600,
                    }}
                  >
                    <Clock size={15} color="#38bdf8" />
                    <span>Attendance Overview</span>
                  </Link>

                  <Link
                    href={`/${organizationCode}/admin/reports/daily`}
                    onClick={() => setHeaderMenuOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      color: '#cbd5e1',
                      textDecoration: 'none',
                      fontSize: '13px',
                      fontWeight: 500,
                    }}
                  >
                    <Clock size={15} color="#34d399" />
                    <span>Daily Report</span>
                  </Link>

                  <Link
                    href={`/${organizationCode}/admin/reports/monthly`}
                    onClick={() => setHeaderMenuOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      color: '#cbd5e1',
                      textDecoration: 'none',
                      fontSize: '13px',
                      fontWeight: 500,
                    }}
                  >
                    <Calendar size={15} color="#818cf8" />
                    <span>Monthly Report</span>
                  </Link>

                  <Link
                    href={`/${organizationCode}/admin/reports/range`}
                    onClick={() => setHeaderMenuOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      color: '#cbd5e1',
                      textDecoration: 'none',
                      fontSize: '13px',
                      fontWeight: 500,
                    }}
                  >
                    <FileText size={15} color="#fbbf24" />
                    <span>Custom Range Report</span>
                  </Link>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Main Content Body */}
        <main className="pageMainContent" style={{ maxWidth: '1280px' }}>
          {/* Report Cards Grid */}
          <div className={styles.cardsGrid} style={{ padding: 0, margin: '0 0 32px 0' }}>
          {/* Card 1: Daily Attendance Report */}
          <div className={styles.reportCard}>
            <div>
              <div
                className={styles.cardIconBox}
                style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}
              >
                <Clock size={24} />
              </div>
              <h2 className={styles.cardTitle}>Daily Attendance Report</h2>
              <p className={styles.cardDesc}>
                View daily attendance across all staff members. Identifies Present, Partial, Holiday, Approved Leave, and Absent status with distinct Normal, Manual, and Adjusted sources.
              </p>
            </div>
            <Link href={`/${organizationCode}/admin/reports/daily`} className={styles.cardLink}>
              <span>Open Daily Report</span>
              <ArrowRight size={16} />
            </Link>
          </div>

          {/* Card 2: Monthly Employee Attendance Report */}
          <div className={styles.reportCard}>
            <div>
              <div
                className={styles.cardIconBox}
                style={{ background: 'rgba(129, 140, 248, 0.15)', color: '#818cf8' }}
              >
                <Calendar size={24} />
              </div>
              <h2 className={styles.cardTitle}>Employee Monthly Attendance Report</h2>
              <p className={styles.cardDesc}>
                Detailed monthly attendance log for individual staff members. Includes monthly metrics breakdown (Working days, Present, Leave types, Absences, Source metrics) and exports.
              </p>
            </div>
            <Link href={`/${organizationCode}/admin/reports/monthly`} className={styles.cardLink}>
              <span>Open Monthly Report</span>
              <ArrowRight size={16} />
            </Link>
          </div>

          {/* Card 3: Custom Date Range Attendance Report */}
          <div className={styles.reportCard}>
            <div>
              <div
                className={styles.cardIconBox}
                style={{ background: 'rgba(52, 211, 153, 0.15)', color: '#34d399' }}
              >
                <FileText size={24} />
              </div>
              <h2 className={styles.cardTitle}>Custom Date Range Report</h2>
              <p className={styles.cardDesc}>
                Generate and export attendance reports across custom date ranges (e.g. 1st to 15th of the month). Export multi-day bundles to CSV or print-ready PDF.
              </p>
            </div>
            <Link href={`/${organizationCode}/admin/reports/range`} className={styles.cardLink}>
              <span>Open Custom Range Report</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        {/* Live Metrics Overview */}
        <div className={styles.metricsOverview}>
          <h3 className={styles.metricsHeader}>
            <BarChart3 size={18} color="#38bdf8" />
            <span>Today&apos;s Live Attendance Overview ({summary?.todayDate || 'Today'})</span>
          </h3>

          {loading ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <Loader2 size={24} className="animate-spin" style={{ color: '#818cf8', margin: '0 auto 8px auto' }} />
              <p style={{ fontSize: '13px', margin: 0 }}>Loading live metrics...</p>
            </div>
          ) : (
            <div className={styles.metricsGrid}>
              <div className={styles.metricBox}>
                <div className={styles.metricLabel}>Total Staff Evaluated</div>
                <div className={styles.metricVal}>{summary?.todayMetrics?.totalCount || 0}</div>
              </div>

              <div className={styles.metricBox}>
                <div className={styles.metricLabel}>Present</div>
                <div className={styles.metricVal} style={{ color: '#34d399' }}>
                  {summary?.todayMetrics?.presentCount || 0}
                </div>
              </div>

              <div className={styles.metricBox}>
                <div className={styles.metricLabel}>Approved Leave</div>
                <div className={styles.metricVal} style={{ color: '#38bdf8' }}>
                  {summary?.todayMetrics?.leaveCount || 0}
                </div>
              </div>

              <div className={styles.metricBox}>
                <div className={styles.metricLabel}>Absent</div>
                <div className={styles.metricVal} style={{ color: '#f87171' }}>
                  {summary?.todayMetrics?.absentCount || 0}
                </div>
              </div>

              <div className={styles.metricBox}>
                <div className={styles.metricLabel}>Verified (Normal)</div>
                <div className={styles.metricVal} style={{ color: '#34d399' }}>
                  {summary?.todayMetrics?.sourceMetrics?.normalCount || 0}
                </div>
              </div>

              <div className={styles.metricBox}>
                <div className={styles.metricLabel}>Manual / Adjusted</div>
                <div className={styles.metricVal} style={{ color: '#fbbf24' }}>
                  {(summary?.todayMetrics?.sourceMetrics?.manualCount || 0) +
                    (summary?.todayMetrics?.sourceMetrics?.adjustedCount || 0)}
                </div>
              </div>
            </div>
          )}
        </div>
        </main>
      </div>
      <OrgAdminMobileNav organizationCode={organizationCode} />
    </div>
  );
}
