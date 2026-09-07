'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Calendar, Clock, Info, ShieldCheck, History, RefreshCw, Search, Filter, X } from 'lucide-react';
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

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dayFilter, setDayFilter] = useState<string>('ALL');
  const [dutyFilter, setDutyFilter] = useState<string>('ALL');
  const [showMobileFilters, setShowMobileFilters] = useState<boolean>(false);

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

  const filteredWeekdays = weekdaysList.filter((day) => {
    const dayConfig = weeklyDays.find((w: any) => w.weekday === day.key);
    const isWorking = Boolean(dayConfig);

    if (dayFilter !== 'ALL' && day.key !== dayFilter) return false;
    if (dutyFilter === 'WORKING' && !isWorking) return false;
    if (dutyFilter === 'OFF' && isWorking) return false;

    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;

    const matchesName = day.label.toLowerCase().includes(q) || day.key.toLowerCase().includes(q);
    const matchesTimes = isWorking && `${dayConfig.startTime} ${dayConfig.endTime}`.toLowerCase().includes(q);
    const matchesPattern = pattern?.name && pattern.name.toLowerCase().includes(q);
    const matchesStatus = (isWorking ? 'working' : 'off duty').includes(q);

    return matchesName || matchesTimes || matchesPattern || matchesStatus;
  });

  const isFilterActive = dayFilter !== 'ALL' || dutyFilter !== 'ALL';

  return (
    <div className={styles.shiftContainer}>
      {/* Header Bar */}
      <div className={styles.headerBar}>
        <div className={styles.headerTitle}>
          <h2>Shift Schedule &amp; Working Rules</h2>
          <p>Source of truth for your daily attendance timing, clock-in rules, and roster metrics</p>
        </div>
        <div className={styles.noticeBadge}>
          <Info size={16} />
          <span>Managed by Admin</span>
        </div>
      </div>

      {/* Search Field with Pinned Filter Icon (Org Admin Style) */}
      <div style={{ width: '100%' }}>
        <div style={{ position: 'relative', width: '100%' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="Search weekday, shift time, pattern name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 40px 9px 36px',
              borderRadius: '10px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#ffffff',
              fontSize: '13px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '42px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            style={{
              position: 'absolute',
              right: '6px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              backgroundColor: isFilterActive ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.06)',
              border: isFilterActive ? '1px solid rgba(99, 102, 241, 0.5)' : '1px solid rgba(255, 255, 255, 0.12)',
              color: isFilterActive ? '#818cf8' : '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            title="Toggle Filters"
          >
            <Filter size={15} color={isFilterActive ? '#818cf8' : 'currentColor'} />
          </button>
        </div>
      </div>

      {/* Filter Bottom Sheet Modal Overlay (Org Admin Style) */}
      {showMobileFilters && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 999,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
          onClick={() => setShowMobileFilters(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '500px',
              backgroundColor: '#0f172a',
              borderTopLeftRadius: '20px',
              borderTopRightRadius: '20px',
              border: '1px solid var(--border-medium, rgba(255, 255, 255, 0.15))',
              borderBottom: 'none',
              padding: '20px',
              boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              boxSizing: 'border-box',
              maxHeight: '85vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 800, fontSize: '14px', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Filter size={16} color="#818cf8" />
                <span>Filter Shift Schedule</span>
              </div>
              <button
                type="button"
                onClick={() => setShowMobileFilters(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '26px',
                  height: '26px',
                  color: '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Duty Status Filter */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>
                Duty Status
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {[
                  { id: 'ALL', label: 'All Days' },
                  { id: 'WORKING', label: 'Working Days Only' },
                  { id: 'OFF', label: 'Off Duty Days Only' },
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setDutyFilter(st.id)}
                    className={`btn btn-sm ${dutyFilter === st.id ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600 }}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Weekday Filter */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>
                Specific Weekday
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {[{ label: 'All Weekdays', key: 'ALL' }, ...weekdaysList].map((day) => (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => setDayFilter(day.key)}
                    className={`btn btn-sm ${dayFilter === day.key ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600 }}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Footer */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px', paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
              {isFilterActive ? (
                <button
                  type="button"
                  onClick={() => {
                    setDayFilter('ALL');
                    setDutyFilter('ALL');
                  }}
                  className="btn btn-secondary btn-xs"
                  style={{ borderRadius: '6px', fontSize: '11px', padding: '6px 12px' }}
                >
                  Reset Filters
                </button>
              ) : <div />}

              <button
                type="button"
                onClick={() => setShowMobileFilters(false)}
                className="btn btn-primary btn-sm"
                style={{ borderRadius: '8px', padding: '8px 18px', fontSize: '12.5px', fontWeight: 700 }}
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

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

            {filteredWeekdays.length === 0 ? (
              <div style={{ color: '#94a3b8', fontSize: '0.875rem', padding: '20px 0', textAlign: 'center' }}>
                No weekdays match the selected filters or search query.
              </div>
            ) : (
              <div className={styles.weeklyScheduleGrid}>
                {filteredWeekdays.map((day) => {
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
            )}
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
