'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  FilePlus,
  RefreshCw,
  ChevronRight,
  Filter,
  Loader2,
} from 'lucide-react';
import { useToast } from '@/components/feedback/toast-provider';
import styles from './StaffAttendanceHistory.module.css';

export default function StaffAttendancePage() {
  const params = useParams();
  const orgCode = (params.organizationCode as string)?.toUpperCase() || '';
  const toast = useToast();

  const now = new Date();
  const [year, setYear] = useState<number>(now.getUTCFullYear());
  const [month, setMonth] = useState<number>(now.getUTCMonth() + 1);

  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchAttendanceHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/org/${orgCode}/reports/monthly?year=${year}&month=${month}`
      );
      if (res.ok) {
        const data = await res.json();
        setReportData(data);
      } else {
        toast.error('Failed to load monthly attendance history.');
      }
    } catch {
      toast.error('Network error fetching attendance records.');
    } finally {
      setLoading(false);
    }
  }, [month, orgCode, toast, year]);

  useEffect(() => {
    fetchAttendanceHistory();
  }, [fetchAttendanceHistory]);

  const metrics = reportData?.monthlyMetrics;
  const rows = reportData?.daysRows || [];

  return (
    <div className={styles.attendanceContainer}>
      {/* Header Bar with Month Filter */}
      <div className={styles.headerBar}>
        <div className={styles.headerInfo}>
          <h2>Monthly Attendance History</h2>
          <p>Historical punch records with date-specific shift rules &amp; metrics</p>
        </div>

        <div className={styles.monthPicker}>
          <Calendar size={18} color="#818cf8" />
          <select
            className={styles.monthSelect}
            value={`${year}-${month}`}
            onChange={(e) => {
              const [y, m] = e.target.value.split('-').map(Number);
              setYear(y);
              setMonth(m);
            }}
          >
            {[0, 1, 2, 3, 4, 5].map((offset) => {
              const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
              const yVal = d.getUTCFullYear();
              const mVal = d.getUTCMonth() + 1;
              const label = d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
              return (
                <option key={`${yVal}-${mVal}`} value={`${yVal}-${mVal}`}>
                  {label}
                </option>
              );
            })}
          </select>

          <Link
            href={`/${orgCode}/staff/attendance/correction`}
            className="btn btn-primary btn-sm"
            style={{ marginLeft: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <FilePlus size={15} />
            <span>Request Correction</span>
          </Link>
        </div>
      </div>

      {/* Monthly Metrics Summary Grid */}
      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <span className={styles.summaryVal}>{metrics?.workingDaysCount || 0}</span>
          <span className={styles.summaryLabel}>Working Days</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryVal} style={{ color: '#34d399' }}>
            {metrics?.presentDaysCount || 0}
          </span>
          <span className={styles.summaryLabel}>Present Days</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryVal} style={{ color: '#fbbf24' }}>
            {metrics?.partialDaysCount || 0}
          </span>
          <span className={styles.summaryLabel}>Partial / Ongoing</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryVal} style={{ color: '#c084fc' }}>
            {metrics?.leaveDaysCount || 0}
          </span>
          <span className={styles.summaryLabel}>Approved Leave</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryVal} style={{ color: '#f87171' }}>
            {metrics?.absentDaysCount || 0}
          </span>
          <span className={styles.summaryLabel}>Absent Days</span>
        </div>
      </div>

      {/* Content Section: Table on Desktop, Cards on Mobile */}
      {loading ? (
        <div className="glass-card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <Loader2 size={32} className="animate-spin" style={{ color: '#818cf8', margin: '0 auto 12px auto' }} />
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Loading attendance history...</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          No attendance records found for this month.
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className={styles.desktopTableContainer}>
            <table className={styles.attendanceTable}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Shift Pattern</th>
                  <th>Sched. Start</th>
                  <th>Clock In</th>
                  <th>Sched. End</th>
                  <th>Clock Out</th>
                  <th>Status</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row: any) => {
                  const isPresent = row.status === 'PRESENT';
                  const isPartial = row.status === 'PARTIAL' || row.status === 'IN PROGRESS';
                  const isAbsent = row.status === 'ABSENT';
                  const isLeave = row.status === 'APPROVED LEAVE';
                  const isHoliday = row.status === 'HOLIDAY';

                  return (
                    <tr key={row.date}>
                      <td style={{ fontWeight: 600, color: '#ffffff' }}>
                        {row.date}
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '6px' }}>
                          ({row.dayOfWeek.slice(0, 3)})
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{row.shiftPatternName}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{row.scheduledStart || '—'}</td>
                      <td style={{ fontWeight: 700, color: row.clockInTime ? '#34d399' : 'var(--text-muted)' }}>
                        {row.clockInTime || '—'}
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{row.scheduledEnd || '—'}</td>
                      <td style={{ fontWeight: 700, color: row.clockOutTime ? '#fbbf24' : 'var(--text-muted)' }}>
                        {row.clockOutTime || '—'}
                      </td>
                      <td>
                        <span
                          className={`${styles.statusPill} ${
                            isPresent
                              ? styles.present
                              : isPartial
                              ? styles.partial
                              : isAbsent
                              ? styles.absent
                              : isLeave
                              ? styles.leave
                              : isHoliday
                              ? styles.holiday
                              : styles.offDuty
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {row.source}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards List View */}
          <div className={styles.mobileCardsList}>
            {rows.map((row: any) => {
              const isPresent = row.status === 'PRESENT';
              const isPartial = row.status === 'PARTIAL' || row.status === 'IN PROGRESS';
              const isAbsent = row.status === 'ABSENT';
              const isLeave = row.status === 'APPROVED LEAVE';
              const isHoliday = row.status === 'HOLIDAY';

              return (
                <div key={row.date} className="glass-card" style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '14px' }}>
                      {row.date}{' '}
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 400 }}>
                        ({row.dayOfWeek})
                      </span>
                    </div>
                    <span
                      className={`${styles.statusPill} ${
                        isPresent
                          ? styles.present
                          : isPartial
                          ? styles.partial
                          : isAbsent
                          ? styles.absent
                          : isLeave
                          ? styles.leave
                          : isHoliday
                          ? styles.holiday
                          : styles.offDuty
                      }`}
                    >
                      {row.status}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                    <div>Shift: <strong style={{ color: '#ffffff' }}>{row.shiftPatternName}</strong></div>
                    <div>Schedule: <strong style={{ color: '#ffffff' }}>{row.scheduledStart && row.scheduledEnd ? `${row.scheduledStart} – ${row.scheduledEnd}` : 'Off Duty'}</strong></div>
                    <div>Clock In: <strong style={{ color: '#34d399' }}>{row.clockInTime || '—'}</strong></div>
                    <div>Clock Out: <strong style={{ color: '#fbbf24' }}>{row.clockOutTime || '—'}</strong></div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
