'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  Layers,
  Info,
} from 'lucide-react';
import styles from './leave-shifts-graph.module.css';

export interface DayStaffingPicture {
  date: string; // YYYY-MM-DD
  dayOfWeek: string;
  shiftName?: string | null;
  shiftHours?: string | null;
  totalScheduled?: number;
  totalAssignedStaff?: number;
  onLeaveCount?: number;
  onLeaveWithThis?: number;
  alreadyOnLeaveStaff?: number;
  remainingStaff?: number;
  afterApprovalAvailable?: number;
  minRequired?: number;
  minimumStaffingThreshold?: number;
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

interface ShiftGroup {
  shiftName: string;
  shiftHours: string;
  workingDays: DayStaffingPicture[];
  hasShortage: boolean;
  hasTight: boolean;
}

export function LeaveShiftsGraph({
  impactData,
}: LeaveShiftsGraphProps) {
  const [activeTooltip, setActiveTooltip] = useState<{ shiftName: string; date: string } | null>(null);

  if (!impactData || impactData.length === 0) {
    return null;
  }

  // 1. Group data by shift name
  const shiftMap = new Map<string, ShiftGroup>();

  impactData.forEach((item) => {
    // Exclude off-duty or general non-shift items if unassigned
    const name = item.shiftName || 'Standard Shift';
    const hours = item.shiftHours || '';

    const isOffDuty = item.status === 'OFF_DUTY' || name === 'Off Duty';
    const isHoliday = item.status === 'HOLIDAY' || item.isHoliday;

    // Filter out holidays and off-duty days for this shift graph
    if (isOffDuty || isHoliday) {
      return;
    }

    if (!shiftMap.has(name)) {
      shiftMap.set(name, {
        shiftName: name,
        shiftHours: hours,
        workingDays: [],
        hasShortage: false,
        hasTight: false,
      });
    }

    const group = shiftMap.get(name)!;
    if (hours && !group.shiftHours) {
      group.shiftHours = hours;
    }

    const scheduled = item.totalScheduled ?? item.totalAssignedStaff ?? 0;
    const onLeave = item.onLeaveWithThis ?? (item.onLeaveCount ?? 0) + 1;
    const available = item.remainingStaff ?? item.afterApprovalAvailable ?? 0;
    const minReq = item.minRequired ?? item.minimumStaffingThreshold ?? 1;
    const shortage = item.isShortage ?? available < minReq;
    const tight = !shortage && available === minReq;

    if (shortage) group.hasShortage = true;
    if (tight) group.hasTight = true;

    group.workingDays.push(item);
  });

  const shiftGroups = Array.from(shiftMap.values());

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
                Leave Request Per-Shift Staffing Graphs
              </h3>
              <p className={styles.subtitleText}>
                Shift-by-shift staffing levels across working days (Holidays / Off-days excluded)
              </p>
            </div>
          </div>

          <div className={styles.legendGroup}>
            <span className={styles.legendItem}>
              <span className={styles.dotGreen} /> Available &ge; Min Req
            </span>
            <span className={styles.legendItem}>
              <span className={styles.dotRed} /> Shortage (Below Min Req)
            </span>
            <span className={styles.legendItem}>
              <span style={{ width: '12px', height: '2px', backgroundColor: '#ef4444', borderTop: '1px dashed #ef4444' }} /> Min Required Line
            </span>
          </div>
        </div>

        {/* Render a dedicated graph for each shift */}
        {shiftGroups.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
            <Calendar size={24} style={{ color: '#818cf8', margin: '0 auto 8px auto', display: 'block' }} />
            No active shift working days in requested date range (All days are Holidays or Off-Duty).
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {shiftGroups.map((group) => {
              const { shiftName, shiftHours, workingDays, hasShortage, hasTight } = group;

              // Calculate Y-axis bounds
              let maxVal = 0;
              workingDays.forEach((d) => {
                const s = d.totalScheduled ?? d.totalAssignedStaff ?? 0;
                const m = d.minRequired ?? d.minimumStaffingThreshold ?? 0;
                const a = d.remainingStaff ?? d.afterApprovalAvailable ?? 0;
                if (s > maxVal) maxVal = s;
                if (m > maxVal) maxVal = m;
                if (a > maxVal) maxVal = a;
              });

              // Add Y-axis headroom
              const yMax = Math.max(maxVal + 2, 4);

              // SVG Dimensions
              const svgHeight = 220;
              const paddingLeft = 40;
              const paddingRight = 20;
              const paddingTop = 30;
              const paddingBottom = 45;
              const graphHeight = svgHeight - paddingTop - paddingBottom;

              // Compute Y ticks
              const yTicks: number[] = [];
              for (let i = 0; i <= yMax; i += yMax <= 6 ? 1 : Math.ceil(yMax / 5)) {
                yTicks.push(i);
              }

              return (
                <div
                  key={shiftName}
                  className={`${styles.shiftCard} ${
                    hasShortage ? styles.shiftCardRed : hasTight ? styles.shiftCardAmber : styles.shiftCardGreen
                  }`}
                >
                  {/* Shift Graph Header */}
                  <div className={styles.cardHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <div className={styles.shiftTitle}>
                        <span>{shiftName}</span>
                        {shiftHours && (
                          <span className={styles.hoursPill}>
                            <Clock size={11} style={{ marginRight: '4px' }} />
                            {shiftHours}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>
                        &bull; {workingDays.length} Working Day{workingDays.length > 1 ? 's' : ''}
                      </span>
                    </div>

                    {hasShortage ? (
                      <span className="badge badge-danger" style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <XCircle size={12} /> Critical Shortage Alert
                      </span>
                    ) : hasTight ? (
                      <span className="badge badge-warning" style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <AlertTriangle size={12} /> Tight (At Minimum)
                      </span>
                    ) : (
                      <span className="badge badge-success" style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle2 size={12} /> Optimal Staffing
                      </span>
                    )}
                  </div>

                  {/* SVG GRAPH CANVAS */}
                  <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
                    <div style={{ minWidth: workingDays.length > 5 ? `${workingDays.length * 90}px` : '100%' }}>
                      <svg
                        viewBox={`0 0 ${Math.max(600, workingDays.length * 100)} ${svgHeight}`}
                        style={{ width: '100%', height: 'auto', display: 'block' }}
                      >
                        <defs>
                          <linearGradient id={`gradScheduled-${shiftName.replace(/\s+/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#818cf8" stopOpacity="0.85" />
                            <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.3" />
                          </linearGradient>

                          <linearGradient id={`gradGreen-${shiftName.replace(/\s+/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#34d399" stopOpacity="0.95" />
                            <stop offset="100%" stopColor="#059669" stopOpacity="0.6" />
                          </linearGradient>

                          <linearGradient id={`gradRed-${shiftName.replace(/\s+/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#f87171" stopOpacity="0.95" />
                            <stop offset="100%" stopColor="#dc2626" stopOpacity="0.6" />
                          </linearGradient>
                        </defs>

                        {/* Y-Axis Horizontal Gridlines */}
                        {yTicks.map((val) => {
                          const y = paddingTop + graphHeight - (val / yMax) * graphHeight;
                          return (
                            <g key={val}>
                              <line
                                x1={paddingLeft}
                                y1={y}
                                x2={Math.max(600, workingDays.length * 100) - paddingRight}
                                y2={y}
                                stroke="rgba(255, 255, 255, 0.08)"
                                strokeDasharray={val === 0 ? undefined : '3 3'}
                              />
                              <text
                                x={paddingLeft - 8}
                                y={y + 4}
                                fill="#94a3b8"
                                fontSize="11"
                                textAnchor="end"
                                fontFamily="monospace"
                              >
                                {val}
                              </text>
                            </g>
                          );
                        })}

                        {/* Minimum Required Staff Line (per day or overall) */}
                        {workingDays.map((day, idx) => {
                          const minReq = day.minRequired ?? day.minimumStaffingThreshold ?? 1;
                          const totalCols = workingDays.length;
                          const chartWidth = Math.max(600, workingDays.length * 100) - paddingLeft - paddingRight;
                          const colWidth = chartWidth / totalCols;
                          const xCenter = paddingLeft + idx * colWidth + colWidth / 2;

                          const yMinReq = paddingTop + graphHeight - (minReq / yMax) * graphHeight;

                          return (
                            <g key={`minreq-${idx}`}>
                              {/* Short segment for this day's min threshold */}
                              <line
                                x1={xCenter - colWidth * 0.4}
                                y1={yMinReq}
                                x2={xCenter + colWidth * 0.4}
                                y2={yMinReq}
                                stroke="#ef4444"
                                strokeWidth="2.5"
                                strokeDasharray="4 3"
                              />
                            </g>
                          );
                        })}

                        {/* DAY COLUMNS (BARS & MARKERS) */}
                        {workingDays.map((day, idx) => {
                          const totalCols = workingDays.length;
                          const chartWidth = Math.max(600, workingDays.length * 100) - paddingLeft - paddingRight;
                          const colWidth = chartWidth / totalCols;
                          const xCenter = paddingLeft + idx * colWidth + colWidth / 2;

                          const scheduled = day.totalScheduled ?? day.totalAssignedStaff ?? 0;
                          const available = day.remainingStaff ?? day.afterApprovalAvailable ?? 0;
                          const minReq = day.minRequired ?? day.minimumStaffingThreshold ?? 1;
                          const onLeave = day.onLeaveWithThis ?? (day.onLeaveCount ?? 0) + 1;
                          const isShortage = day.isShortage ?? available < minReq;

                          // Bar heights
                          const hScheduled = (scheduled / yMax) * graphHeight;
                          const yScheduled = paddingTop + graphHeight - hScheduled;

                          const hAvailable = (available / yMax) * graphHeight;
                          const yAvailable = paddingTop + graphHeight - hAvailable;

                          const barW = Math.min(36, colWidth * 0.35);

                          const dateLabel = day.date.slice(5); // MM-DD
                          const isSelected = activeTooltip?.shiftName === shiftName && activeTooltip?.date === day.date;

                          return (
                            <g
                              key={day.date}
                              style={{ cursor: 'pointer' }}
                              onClick={() =>
                                setActiveTooltip(
                                  isSelected ? null : { shiftName, date: day.date }
                                )
                              }
                            >
                              {/* Hover Highlight Area */}
                              <rect
                                x={paddingLeft + idx * colWidth + 4}
                                y={paddingTop}
                                width={colWidth - 8}
                                height={graphHeight}
                                fill={isSelected ? 'rgba(255, 255, 255, 0.08)' : 'transparent'}
                                rx="6"
                              />

                              {/* Scheduled Staff Bar */}
                              <rect
                                x={xCenter - barW - 2}
                                y={yScheduled}
                                width={barW}
                                height={hScheduled}
                                fill={`url(#gradScheduled-${shiftName.replace(/\s+/g, '')})`}
                                rx="4"
                              />

                              {/* Scheduled Staff Value Label */}
                              <text
                                x={xCenter - barW / 2 - 2}
                                y={yScheduled - 6}
                                fill="#c7d2fe"
                                fontSize="10.5"
                                fontWeight="bold"
                                textAnchor="middle"
                              >
                                {scheduled}
                              </text>

                              {/* Available Staff Bar (After Leave Approval) */}
                              <rect
                                x={xCenter + 2}
                                y={yAvailable}
                                width={barW}
                                height={hAvailable}
                                fill={
                                  isShortage
                                    ? `url(#gradRed-${shiftName.replace(/\s+/g, '')})`
                                    : `url(#gradGreen-${shiftName.replace(/\s+/g, '')})`
                                }
                                rx="4"
                              />

                              {/* Available Staff Value Label */}
                              <text
                                x={xCenter + barW / 2 + 2}
                                y={yAvailable - 6}
                                fill={isShortage ? '#f87171' : '#34d399'}
                                fontSize="11"
                                fontWeight="800"
                                textAnchor="middle"
                              >
                                {available}
                              </text>

                              {/* On Leave Badge Tag */}
                              {onLeave > 0 && (
                                <g>
                                  <rect
                                    x={xCenter - 22}
                                    y={paddingTop + graphHeight + 22}
                                    width="44"
                                    height="16"
                                    fill="rgba(245, 158, 11, 0.15)"
                                    stroke="rgba(245, 158, 11, 0.4)"
                                    rx="8"
                                  />
                                  <text
                                    x={xCenter}
                                    y={paddingTop + graphHeight + 33}
                                    fill="#fbbf24"
                                    fontSize="9.5"
                                    fontWeight="bold"
                                    textAnchor="middle"
                                  >
                                    -{onLeave} Leave
                                  </text>
                                </g>
                              )}

                              {/* X-Axis Date & Day of Week Text */}
                              <text
                                x={xCenter}
                                y={paddingTop + graphHeight + 14}
                                fill="#ffffff"
                                fontSize="11"
                                fontWeight="bold"
                                textAnchor="middle"
                                fontFamily="monospace"
                              >
                                {dateLabel}
                              </text>
                            </g>
                          );
                        })}

                        {/* Legend Overlay inside Chart Top Right */}
                        <g transform={`translate(${Math.max(600, workingDays.length * 100) - 240}, 10)`}>
                          <rect width="220" height="20" fill="rgba(0,0,0,0.5)" rx="10" />
                          <rect x="8" y="6" width="8" height="8" fill="#818cf8" rx="2" />
                          <text x="20" y="13" fill="#cbd5e1" fontSize="9.5">Sched</text>
                          <rect x="65" y="6" width="8" height="8" fill="#34d399" rx="2" />
                          <text x="77" y="13" fill="#cbd5e1" fontSize="9.5">Avail</text>
                          <rect x="115" y="6" width="8" height="8" fill="#f87171" rx="2" />
                          <text x="127" y="13" fill="#cbd5e1" fontSize="9.5">Shortage</text>
                          <line x1="175" y1="10" x2="190" y2="10" stroke="#ef4444" strokeWidth="2" strokeDasharray="3 2" />
                          <text x="195" y="13" fill="#ef4444" fontSize="9.5" fontWeight="bold">Min</text>
                        </g>
                      </svg>
                    </div>
                  </div>

                  {/* POPUP TOOLTIP DETAILS ON SELECTION */}
                  {activeTooltip?.shiftName === shiftName && (
                    <div style={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid #818cf8', borderRadius: '10px', padding: '12px', fontSize: '12px' }}>
                      {(() => {
                        const day = workingDays.find((d) => d.date === activeTooltip.date);
                        if (!day) return null;
                        const scheduled = day.totalScheduled ?? day.totalAssignedStaff ?? 0;
                        const available = day.remainingStaff ?? day.afterApprovalAvailable ?? 0;
                        const minReq = day.minRequired ?? day.minimumStaffingThreshold ?? 1;
                        const onLeave = day.onLeaveWithThis ?? (day.onLeaveCount ?? 0) + 1;
                        const isShortage = day.isShortage ?? available < minReq;

                        return (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px' }}>
                            <div>
                              <span style={{ color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase' }}>Date</span>
                              <div style={{ fontWeight: 800, color: '#ffffff' }}>{day.date} ({day.dayOfWeek})</div>
                            </div>
                            <div>
                              <span style={{ color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase' }}>Scheduled</span>
                              <div style={{ fontWeight: 800, color: '#818cf8' }}>{scheduled} Staff</div>
                            </div>
                            <div>
                              <span style={{ color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase' }}>On Leave</span>
                              <div style={{ fontWeight: 800, color: '#fbbf24' }}>{onLeave} Staff</div>
                            </div>
                            <div>
                              <span style={{ color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase' }}>Available</span>
                              <div style={{ fontWeight: 800, color: isShortage ? '#f87171' : '#34d399' }}>{available} Staff</div>
                            </div>
                            <div>
                              <span style={{ color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase' }}>Min Required</span>
                              <div style={{ fontWeight: 800, color: '#cbd5e1' }}>{minReq} Staff</div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* SHIFT SUMMARY EXPLICIT CALLOUT MESSAGE */}
                  <div
                    className={`${styles.messageBox} ${
                      hasShortage ? styles.msgRed : hasTight ? styles.msgAmber : styles.msgGreen
                    }`}
                  >
                    {hasShortage ? (
                      <>
                        <XCircle size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#f87171' }} />
                        <div>
                          <strong>🚨 Shortage Alert for {shiftName}:</strong> Approving this leave causes available staff to drop below the minimum required threshold of <strong>{workingDays[0]?.minRequired ?? 1} staff</strong> on one or more working days.
                        </div>
                      </>
                    ) : hasTight ? (
                      <>
                        <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#fbbf24' }} />
                        <div>
                          <strong>⚠️ Tight Staffing for {shiftName}:</strong> Available staff strictly equals the required minimum of <strong>{workingDays[0]?.minRequired ?? 1} staff</strong>. Zero staffing buffer remaining.
                        </div>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#34d399' }} />
                        <div>
                          <strong>✅ Optimal Staffing for {shiftName}:</strong> All {workingDays.length} working day(s) maintain sufficient available staff to meet or exceed minimum staffing requirements.
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
