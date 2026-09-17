'use client';

import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  Users,
  Moon,
  Sparkles,
  Info,
  Layers,
} from 'lucide-react';
import styles from './leave-shifts-graph.module.css';

export interface DayStaffingPicture {
  date: string;
  dayOfWeek: string;
  shiftName?: string | null;
  shiftHours?: string | null;
  totalScheduled?: number;
  onLeaveCount?: number;
  onLeaveWithThis?: number;
  remainingStaff?: number;
  minRequired?: number;
  isShortage?: boolean;
  isHoliday?: boolean;
  status?: 'GREEN' | 'AMBER' | 'RED' | 'HOLIDAY' | 'NO_SHIFT' | 'OFF_DUTY';
  statusMessage?: string;
}

interface LeaveShiftsGraphProps {
  impactData: DayStaffingPicture[];
  startDate?: string;
  endDate?: string;
  daysCount?: number;
  leaveType?: string;
}

export function LeaveShiftsGraph({
  impactData,
  startDate,
  endDate,
  daysCount,
  leaveType,
}: LeaveShiftsGraphProps) {
  if (!impactData || impactData.length === 0) {
    return null;
  }

  // Count totals for quick top-bar metrics
  let totalShortageShifts = 0;
  let totalTightShifts = 0;
  let totalOptimalShifts = 0;
  let totalOffDutyShifts = 0;

  impactData.forEach((day) => {
    const isOffDuty = day.status === 'OFF_DUTY' || day.shiftName === 'Off Duty';
    const isHoliday = day.status === 'HOLIDAY' || day.isHoliday;
    const remainingStaff = day.remainingStaff ?? 0;
    const minRequired = day.minRequired ?? (isOffDuty || isHoliday ? 0 : 1);
    const isShortage = !isOffDuty && !isHoliday && (day.isShortage ?? remainingStaff < minRequired);
    const isTight = !isOffDuty && !isHoliday && !isShortage && remainingStaff === minRequired;

    if (isOffDuty || isHoliday) totalOffDutyShifts++;
    else if (isShortage) totalShortageShifts++;
    else if (isTight) totalTightShifts++;
    else totalOptimalShifts++;
  });

  return (
    <div className={styles.container}>
      <div className={styles.graphCard}>
        {/* Header Title & Legend */}
        <div className={styles.graphHeader}>
          <div className={styles.titleGroup}>
            <div className={styles.titleIcon}>
              <Layers size={20} />
            </div>
            <div>
              <h3 className={styles.titleText}>
                Leave Request Range Shifts Visualizer
              </h3>
              <p className={styles.subtitleText}>
                Shift-by-shift staffing impact &amp; requirement analysis for requested leave
              </p>
            </div>
          </div>

          <div className={styles.legendGroup}>
            <span className={styles.legendItem}>
              <span className={styles.dotGreen} /> Meets Requirement
            </span>
            <span className={styles.legendItem}>
              <span className={styles.dotAmber} /> Exactly at Minimum
            </span>
            <span className={styles.legendItem}>
              <span className={styles.dotRed} /> Below Minimum Shortage
            </span>
            <span className={styles.legendItem}>
              <span className={styles.dotSlate} /> Off Duty / Holiday
            </span>
          </div>
        </div>

        {/* Timeline Horizontal Overview Strip */}
        <div className={styles.timelineOverview}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontWeight: 700, color: '#ffffff' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={14} color="#818cf8" />
              <span>Range Timeline Overview ({impactData.length} Shift Window{impactData.length > 1 ? 's' : ''})</span>
            </span>
            <span style={{ color: totalShortageShifts > 0 ? '#f87171' : '#34d399', fontSize: '11.5px', fontFamily: 'var(--font-mono)' }}>
              {totalShortageShifts > 0
                ? `🚨 ${totalShortageShifts} Shift Shortage${totalShortageShifts > 1 ? 's' : ''} Detected`
                : '✅ All Shifts Fully Covered'}
            </span>
          </div>

          <div className={styles.timelineBar}>
            {impactData.map((day, idx) => {
              const isOffDuty = day.status === 'OFF_DUTY' || day.shiftName === 'Off Duty';
              const isHoliday = day.status === 'HOLIDAY' || day.isHoliday;
              const remainingStaff = day.remainingStaff ?? 0;
              const minRequired = day.minRequired ?? 0;
              const isShortage = !isOffDuty && !isHoliday && (day.isShortage ?? remainingStaff < minRequired);
              const isTight = !isOffDuty && !isHoliday && !isShortage && remainingStaff === minRequired;

              let color = '#10b981'; // Green
              if (isOffDuty || isHoliday) color = '#64748b'; // Slate
              else if (isShortage) color = '#ef4444'; // Red
              else if (isTight) color = '#f59e0b'; // Amber

              return (
                <div
                  key={idx}
                  className={styles.timelineSegment}
                  style={{ backgroundColor: color }}
                  title={`${day.date} (${day.dayOfWeek}): ${day.shiftName} - ${isShortage ? 'Shortage Alert' : isTight ? 'Tight Staffing' : isOffDuty ? 'Off Duty' : 'Meets Minimum'}`}
                />
              );
            })}
          </div>
        </div>

        {/* Shift-by-Shift Detailed Cards Grid */}
        <div className={styles.shiftsGrid}>
          {impactData.map((day, idx) => {
            const isOffDuty = day.status === 'OFF_DUTY' || day.shiftName === 'Off Duty';
            const isHoliday = day.status === 'HOLIDAY' || day.isHoliday;
            const totalScheduled = day.totalScheduled ?? 0;
            const onLeaveWithThis = day.onLeaveWithThis ?? 1;
            const remainingStaff = day.remainingStaff ?? 0;
            const minRequired = day.minRequired ?? (isOffDuty || isHoliday ? 0 : 1);
            const isShortage = !isOffDuty && !isHoliday && (day.isShortage ?? remainingStaff < minRequired);
            const isTight = !isOffDuty && !isHoliday && !isShortage && remainingStaff === minRequired;
            const isOptimal = !isOffDuty && !isHoliday && !isShortage && !isTight;

            // Compute coverage percentage
            const coveragePct = isOffDuty || isHoliday
              ? 100
              : minRequired > 0
              ? Math.min(100, Math.round((remainingStaff / minRequired) * 100))
              : 100;

            // Determine styling variant
            const cardClass = isShortage
              ? styles.shiftCardRed
              : isTight
              ? styles.shiftCardAmber
              : isOptimal
              ? styles.shiftCardGreen
              : styles.shiftCardSlate;

            const msgClass = isShortage
              ? styles.msgRed
              : isTight
              ? styles.msgAmber
              : isOptimal
              ? styles.msgGreen
              : styles.msgSlate;

            const meterFillClass = isShortage
              ? styles.meterFillRed
              : isTight
              ? styles.meterFillAmber
              : isOptimal
              ? styles.meterFillGreen
              : styles.meterFillSlate;

            return (
              <div key={idx} className={`${styles.shiftCard} ${cardClass}`}>
                {/* Card Top Header */}
                <div className={styles.cardHeader}>
                  <div>
                    <span className={styles.dateBadge}>{day.date}</span>
                    <span className={styles.weekdayTag}>({day.dayOfWeek})</span>
                  </div>

                  {isOffDuty ? (
                    <span className="badge badge-secondary" style={{ fontSize: '11px', gap: '4px' }}>
                      <Moon size={12} /> Off Duty
                    </span>
                  ) : isHoliday ? (
                    <span className="badge badge-info" style={{ fontSize: '11px', gap: '4px' }}>
                      <Sparkles size={12} /> Holiday
                    </span>
                  ) : isShortage ? (
                    <span className="badge badge-danger" style={{ fontSize: '11px', gap: '4px' }}>
                      <XCircle size={12} /> Below Minimum
                    </span>
                  ) : isTight ? (
                    <span className="badge badge-warning" style={{ fontSize: '11px', gap: '4px' }}>
                      <AlertTriangle size={12} /> Exactly at Minimum
                    </span>
                  ) : (
                    <span className="badge badge-success" style={{ fontSize: '11px', gap: '4px' }}>
                      <CheckCircle2 size={12} /> Meets Minimum
                    </span>
                  )}
                </div>

                {/* Shift Name & Hours */}
                <div className={styles.shiftTitle}>
                  <span>{day.shiftName || 'Standard Shift'}</span>
                  {day.shiftHours && (
                    <span className={styles.hoursPill}>
                      <Clock size={11} style={{ marginRight: '4px' }} />
                      {day.shiftHours}
                    </span>
                  )}
                </div>

                {/* Meter Progress Bar */}
                {!isOffDuty && !isHoliday && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, marginBottom: '4px', color: isShortage ? '#f87171' : isTight ? '#fbbf24' : '#34d399' }}>
                      <span>Staffing Meter ({coveragePct}%)</span>
                      <span>{remainingStaff} Available / {minRequired} Minimum</span>
                    </div>
                    <div className={styles.meterTrack}>
                      <div className={meterFillClass} style={{ width: `${coveragePct}%` }} />
                    </div>
                  </div>
                )}

                {/* Explicit Message Box */}
                <div className={`${styles.messageBox} ${msgClass}`}>
                  {isShortage ? (
                    <>
                      <XCircle size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#f87171' }} />
                      <div>
                        <strong>🚨 Shortage Alert (Below Minimum):</strong> Approving leave reduces available staff to <strong>{remainingStaff}</strong>, falling below the required minimum of <strong>{minRequired}</strong> by <strong>{minRequired - remainingStaff} staff</strong>.
                      </div>
                    </>
                  ) : isTight ? (
                    <>
                      <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#fbbf24' }} />
                      <div>
                        <strong>⚠️ Tight Coverage (At Minimum):</strong> Available staff will be <strong>{remainingStaff}</strong>, which exactly equals the minimum requirement of <strong>{minRequired}</strong>. Zero staffing buffer left.
                      </div>
                    </>
                  ) : isOptimal ? (
                    <>
                      <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#34d399' }} />
                      <div>
                        <strong>✅ Optimal Staffing Coverage:</strong> Available staff (<strong>{remainingStaff}</strong>) comfortably meets the minimum required threshold of <strong>{minRequired}</strong> (+{remainingStaff - minRequired} extra buffer).
                      </div>
                    </>
                  ) : (
                    <>
                      <Moon size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#94a3b8' }} />
                      <div>
                        <strong>🌙 Non-Working Day / Holiday:</strong> No active shift scheduled or minimum staffing requirement for this date.
                      </div>
                    </>
                  )}
                </div>

                {/* Stats Breakdown Chips */}
                <div className={styles.statsRow}>
                  <div className={styles.statChip}>
                    <div className={styles.statLabel}>Scheduled</div>
                    <div className={styles.statVal}>{totalScheduled}</div>
                  </div>
                  <div className={styles.statChip}>
                    <div className={styles.statLabel}>On Leave</div>
                    <div className={styles.statVal} style={{ color: '#fbbf24' }}>{onLeaveWithThis}</div>
                  </div>
                  <div className={styles.statChip}>
                    <div className={styles.statLabel}>Available</div>
                    <div className={styles.statVal} style={{ color: isShortage ? '#f87171' : isTight ? '#fbbf24' : '#34d399' }}>{remainingStaff}</div>
                  </div>
                  <div className={styles.statChip}>
                    <div className={styles.statLabel}>Min Req</div>
                    <div className={styles.statVal} style={{ color: '#cbd5e1' }}>{minRequired}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
