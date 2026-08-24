'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Calendar, Clock, Info, ShieldCheck, History, RefreshCw } from 'lucide-react';
import { useToast } from '@/components/feedback/toast-provider';
import styles from './StaffShift.module.css';

export default function StaffShiftPage() {
  const params = useParams();
  const orgCode = (params.organizationCode as string)?.toUpperCase() || '';
  const toast = useToast();

  const [shiftData, setShiftData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchShiftDetails = useCallback(async () => {
    setLoading(true);
    try {
      // First get staff profile ID via precheck
      const preRes = await fetch(`/api/org/${orgCode}/attendance/precheck`, { method: 'POST' });
      if (!preRes.ok) {
        toast.error('Failed to authenticate staff workspace.');
        return;
      }
      const preData = await preRes.json();
      const staffId = preData.staffProfile?.id;

      if (staffId) {
        const sRes = await fetch(`/api/org/${orgCode}/staff/${staffId}/shift`);
        if (sRes.ok) {
          const sData = await sRes.json();
          setShiftData(sData);
        }
      }
    } catch {
      toast.error('Network error fetching shift assignment.');
    } finally {
      setLoading(false);
    }
  }, [orgCode, toast]);

  useEffect(() => {
    fetchShiftDetails();
  }, [fetchShiftDetails]);

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
        <RefreshCw size={24} className="animate-spin text-indigo-400" />
        <p style={{ marginTop: '8px' }}>Loading shift schedule & rules...</p>
      </div>
    );
  }

  const currentAssignment = shiftData?.currentAssignment || shiftData?.activeAssignment;
  const history = shiftData?.history || [];
  const pattern = currentAssignment?.shiftPattern;
  const weeklyDays = pattern?.weeklyDays || [];

  const weekdaysList = [
    { label: 'Mon', key: 'MONDAY' },
    { label: 'Tue', key: 'TUESDAY' },
    { label: 'Wed', key: 'WEDNESDAY' },
    { label: 'Thu', key: 'THURSDAY' },
    { label: 'Fri', key: 'FRIDAY' },
    { label: 'Sat', key: 'SATURDAY' },
    { label: 'Sun', key: 'SUNDAY' },
  ];

  return (
    <div className={styles.shiftContainer}>
      {/* Header Bar */}
      <div className={styles.headerBar}>
        <div className={styles.headerTitle}>
          <h2>Shift Schedule & Working Rules</h2>
          <p>Source of truth for your daily attendance timing, clock-in rules, and roster metrics</p>
        </div>
        <div className={styles.noticeBadge}>
          <Info size={16} />
          <span>Managed by Admin</span>
        </div>
      </div>

      {/* Card 1: Current Assigned Shift */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>
          <Calendar size={20} color="#818cf8" />
          Current Assigned Shift
        </h3>

        {currentAssignment ? (
          <>
            <div className={styles.shiftInfoGrid}>
              <div className={styles.infoBox}>
                <span className={styles.infoLabel}>Shift Pattern</span>
                <span className={styles.infoVal}>{pattern?.name || 'Standard Shift'}</span>
              </div>
              <div className={styles.infoBox}>
                <span className={styles.infoLabel}>Effective From</span>
                <span className={styles.infoVal}>
                  {new Date(currentAssignment.effectiveFrom).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <div className={styles.infoBox}>
                <span className={styles.infoLabel}>Min Staffing Threshold</span>
                <span className={styles.infoVal}>{pattern?.minimumStaffingThreshold || 1} Staff</span>
              </div>
            </div>

            <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '12px' }}>
              Weekly Schedule Breakdown
            </h4>

            <div className={styles.weeklyScheduleGrid}>
              {weekdaysList.map((day) => {
                const dayConfig = weeklyDays.find((w: any) => w.weekday === day.key);
                const isWorking = Boolean(dayConfig);

                return (
                  <div
                    key={day.key}
                    className={`${styles.dayCard} ${isWorking ? styles.working : ''}`}
                  >
                    <span className={styles.dayName}>{day.label}</span>
                    {isWorking ? (
                      <span className={styles.dayTimes}>
                        {dayConfig.startTime} – {dayConfig.endTime}
                      </span>
                    ) : (
                      <span className={styles.offText}>Off Duty</span>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
            No shift pattern assigned yet. Please contact your Organization Administrator.
          </div>
        )}
      </div>

      {/* Card 2: Shift Assignment History */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>
          <History size={20} color="#34d399" />
          Shift Assignment History
        </h3>

        {history.length === 0 ? (
          <div style={{ color: '#64748b', fontSize: '0.875rem' }}>
            No historical shift changes recorded.
          </div>
        ) : (
          <table className={styles.historyTable}>
            <thead>
              <tr>
                <th>Shift Pattern</th>
                <th>Effective From</th>
                <th>Effective To</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h: any) => {
                const isCurrent = !h.effectiveTo;
                return (
                  <tr key={h.id}>
                    <td style={{ fontWeight: 600 }}>{h.shiftPattern?.name || 'Shift Pattern'}</td>
                    <td>{new Date(h.effectiveFrom).toLocaleDateString()}</td>
                    <td>{h.effectiveTo ? new Date(h.effectiveTo).toLocaleDateString() : 'Present'}</td>
                    <td>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '12px',
                          background: isCurrent ? 'rgba(52, 211, 153, 0.15)' : 'rgba(148, 163, 184, 0.12)',
                          color: isCurrent ? '#34d399' : '#94a3b8',
                        }}
                      >
                        {isCurrent ? 'ACTIVE' : 'PREVIOUS'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
