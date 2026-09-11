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
import { formatDateIST } from '@/lib/timezone';
import styles from './StaffAttendanceHistory.module.css';

import { BreakPopover } from '@/components/attendance/break-popover';

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
              const label = formatDateIST(d, { month: 'long', year: 'numeric' });
              return (
                <option key={`${yVal}-${mVal}`} value={`${yVal}-${mVal}`}>
                  {label}
                </option>
              );
            })}
          </select>

          <Link
            href={`/${orgCode}/staff/attendance/corrections`}
            className={`btn btn-secondary btn-sm ${styles.desktopOnlyAction}`}
            style={{ marginLeft: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <FileText size={15} />
            <span>My Corrections</span>
          </Link>

          <Link
            href={`/${orgCode}/staff/attendance/correction`}
            className={`btn btn-primary btn-sm ${styles.desktopOnlyAction}`}
            style={{ marginLeft: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <FilePlus size={15} />
            <span>Request Correction</span>
          </Link>
        </div>
      </div>

      {/* Monthly Metrics Summary Grid */}
      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard} style={{ borderLeft: '3px solid #818cf8' }}>
          <div>
            <div className={styles.summaryVal}>{metrics?.workingDaysCount || 0}</div>
            <div className={styles.summaryLabel}>Working Days</div>
          </div>
        </div>

        <div className={styles.summaryCard} style={{ borderLeft: '3px solid #34d399' }}>
          <div>
            <div className={styles.summaryVal} style={{ color: '#34d399' }}>
              {metrics?.presentDaysCount || 0}
            </div>
            <div className={styles.summaryLabel}>Present Days</div>
          </div>
        </div>

        <div className={styles.summaryCard} style={{ borderLeft: '3px solid #c084fc' }}>
          <div>
            <div className={styles.summaryVal} style={{ color: '#c084fc' }}>
              {metrics?.leaveDaysCount || 0}
            </div>
            <div className={styles.summaryLabel}>Approved Leave</div>
          </div>
        </div>

        <div className={styles.summaryCard} style={{ borderLeft: '3px solid #f87171' }}>
          <div>
            <div className={styles.summaryVal} style={{ color: '#f87171' }}>
              {metrics?.absentDaysCount || 0}
            </div>
            <div className={styles.summaryLabel}>Absent Days</div>
          </div>
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
                  <th>Clock In Time</th>
                  <th>Clock Out Time</th>
                  <th>Break Time</th>
                  <th>Total Working Hours</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row: any, idx: number) => {
                  const isPresent = row.status === 'PRESENT';
                  const isPartial = row.status === 'PARTIAL' || row.status === 'IN PROGRESS';
                  const isAbsent = row.status === 'ABSENT';
                  const isLeave = row.status === 'APPROVED LEAVE';
                  const isHoliday = row.status === 'HOLIDAY';
                  const isAdd = row.isAdditionalShift;

                  const breaksList = (row.breakDetails || []).map((b: any, bIdx: number) => ({
                    breakNumber: bIdx + 1,
                    startTime: b.clockOutTime,
                    endTime: b.clockInTime,
                    durationMinutes: b.durationMinutes,
                  }));

                  return (
                    <tr
                      key={isAdd ? `${row.date}-add-${idx}` : `${row.date}-reg-${idx}`}
                      style={
                        isAdd
                          ? { backgroundColor: 'rgba(245, 158, 11, 0.06)', borderLeft: '3px solid #f59e0b' }
                          : undefined
                      }
                    >
                      <td style={{ fontWeight: 600, color: '#ffffff' }}>
                        {row.date}
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '6px' }}>
                          ({row.dayOfWeek?.slice(0, 3)})
                        </span>
                      </td>
                      <td>
                        {isAdd ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '9999px', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)', fontSize: '11px', fontWeight: 700 }}>
                            ⚡ {row.shiftPatternName || 'Additional Shift'}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)' }}>{row.shiftPatternName}</span>
                        )}
                      </td>
                      <td style={{ fontWeight: 700, color: row.displayClockInTime || row.clockInTime ? '#34d399' : 'var(--text-muted)' }}>
                        {row.displayClockInTime || row.clockInTime || '—'}
                      </td>
                      <td style={{ fontWeight: 700, color: row.displayClockOutTime || row.clockOutTime ? '#fbbf24' : 'var(--text-muted)' }}>
                        {row.displayClockOutTime || row.clockOutTime || '—'}
                      </td>
                      <td>
                        <BreakPopover totalBreakMinutes={row.totalBreakMinutes || 0} breaks={breaksList} />
                      </td>
                      <td style={{ fontWeight: 700, color: '#818cf8' }}>
                        {row.totalWorkingHoursFormatted || '0h'}
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards List View */}
          <div className={styles.mobileCardsList}>
            {rows.map((row: any, idx: number) => {
              const isPresent = row.status === 'PRESENT';
              const isPartial = row.status === 'PARTIAL' || row.status === 'IN PROGRESS';
              const isAbsent = row.status === 'ABSENT';
              const isLeave = row.status === 'APPROVED LEAVE';
              const isHoliday = row.status === 'HOLIDAY';
              const isAdd = row.isAdditionalShift;

              const breaksList = (row.breakDetails || []).map((b: any, bIdx: number) => ({
                breakNumber: bIdx + 1,
                startTime: b.clockOutTime,
                endTime: b.clockInTime,
                durationMinutes: b.durationMinutes,
              }));

              const formattedDate = (() => {
                try {
                  const d = new Date(row.date);
                  if (!isNaN(d.getTime())) {
                    return formatDateIST(row.date, { month: 'short', day: 'numeric', year: 'numeric' });
                  }
                } catch {}
                return row.date;
              })();

              return (
                <div
                  key={isAdd ? `${row.date}-add-${idx}` : `${row.date}-reg-${idx}`}
                  className={styles.historyCardMobile}
                  style={isAdd ? { borderColor: 'rgba(245, 158, 11, 0.4)', backgroundColor: 'rgba(245, 158, 11, 0.05)' } : undefined}
                >
                  <div className={styles.cardHeaderMobile}>
                    <div className={styles.cardDateGroup}>
                      <div className={styles.calendarIconBox} style={isAdd ? { backgroundColor: 'rgba(245, 158, 11, 0.15)' } : undefined}>
                        {isAdd ? <span style={{ color: '#fbbf24', fontSize: '13px' }}>⚡</span> : <Calendar size={15} color="#818cf8" />}
                      </div>
                      <div>
                        <div className={styles.cardDateText}>{formattedDate}</div>
                        <div className={styles.cardDayText}>
                          {row.dayOfWeek} {isAdd ? '• Additional Shift' : ''}
                        </div>
                      </div>
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
                      {isPresent && <CheckCircle2 size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />}
                      {isPartial && <Clock size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />}
                      {isAbsent && <XCircle size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />}
                      {row.status}
                    </span>
                  </div>

                  <div className={styles.cardBodyMobile}>
                    <div className={styles.shiftInfoRow}>
                      <span className={styles.shiftLabel}>Shift:</span>
                      <span className={styles.shiftValue}>{row.shiftPatternName || 'Default Shift'}</span>
                    </div>

                    <div className={styles.punchGridMobile}>
                      <div className={styles.punchBoxIn}>
                        <span className={styles.punchBoxLabel}>Clock In</span>
                        <span className={styles.punchBoxTime}>
                          {row.displayClockInTime || row.clockInTime || '—'}
                        </span>
                      </div>

                      <div className={styles.punchBoxOut}>
                        <span className={styles.punchBoxLabel}>Clock Out</span>
                        <span className={styles.punchBoxTime}>
                          {row.displayClockOutTime || row.clockOutTime || '—'}
                        </span>
                      </div>
                    </div>

                    <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Break:</span>
                        <BreakPopover totalBreakMinutes={row.totalBreakMinutes || 0} breaks={breaksList} />
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', marginRight: '6px' }}>Working Hours:</span>
                        <span style={{ fontWeight: 700, color: '#818cf8' }}>{row.totalWorkingHoursFormatted || '0h'}</span>
                      </div>
                    </div>
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
