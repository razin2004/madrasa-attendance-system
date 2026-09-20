'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, ArrowRight, Calendar } from 'lucide-react';

interface BranchCoverage {
  branchId: string;
  branchName: string;
  shiftName: string;
  isWorkingDay: boolean;
  totalStaff: number;
  workingStaff: number;
  onLeaveStaff: number;
  availableStaff: number;
  minRequired: number;
  isUnderstaffed: boolean;
  shortageCount: number;
}

interface DayCoverageData {
  date: string;
  weekday: string;
  overallStatus: 'OK' | 'UNDERSTAFFED';
  understaffedBranchesCount: number;
  branches: BranchCoverage[];
}

interface BranchStaffingBannerProps {
  organizationCode: string;
}

export function BranchStaffingBanner({ organizationCode }: BranchStaffingBannerProps) {
  const [data, setData] = useState<{
    today: DayCoverageData;
    tomorrow: DayCoverageData;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'TODAY' | 'TOMORROW'>('TODAY');

  const fetchCoverage = async () => {
    try {
      const res = await fetch(`/api/org/${organizationCode}/branches/staffing-coverage`);
      const resData = await res.json();
      if (res.ok && resData.success) {
        setData({
          today: resData.today,
          tomorrow: resData.tomorrow,
        });
        const hasToday = (resData.today?.understaffedBranchesCount || 0) > 0;
        const hasTom = (resData.tomorrow?.understaffedBranchesCount || 0) > 0;
        if (!hasToday && hasTom) {
          setActiveTab('TOMORROW');
        } else {
          setActiveTab('TODAY');
        }
      }
    } catch (err) {
      console.error('Error fetching staffing coverage:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoverage();
  }, [organizationCode]);

  if (!data) return null;

  const hasTodayShortage = (data.today?.understaffedBranchesCount || 0) > 0;
  const hasTomorrowShortage = (data.tomorrow?.understaffedBranchesCount || 0) > 0;

  // If neither day has staffing shortages, hide the alert box completely
  if (!hasTodayShortage && !hasTomorrowShortage) {
    return null;
  }

  const currentCoverage = activeTab === 'TODAY' ? data.today : data.tomorrow;
  const understaffedBranches = (currentCoverage?.branches || []).filter((b) => b.isWorkingDay && b.isUnderstaffed);

  if (understaffedBranches.length === 0 && !hasTodayShortage && !hasTomorrowShortage) {
    return null;
  }

  return (
    <div style={{ marginBottom: '20px' }}>
      {/* Date Toggle Header - Shown ONLY if multiple days have shortages */}
      {(hasTodayShortage && hasTomorrowShortage) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          {hasTodayShortage && (
            <button
              type="button"
              onClick={() => setActiveTab('TODAY')}
              style={{
                padding: '5px 12px',
                borderRadius: '20px',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: 'pointer',
                border: `1px solid ${activeTab === 'TODAY' ? 'rgba(239, 68, 68, 0.5)' : 'rgba(255, 255, 255, 0.08)'}`,
                backgroundColor: activeTab === 'TODAY' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                color: activeTab === 'TODAY' ? '#f87171' : 'var(--text-muted)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Calendar size={12} />
              <span>Today ({data.today?.weekday ? data.today.weekday.slice(0, 3) : 'Today'})</span>
              <span style={{ backgroundColor: '#ef4444', color: '#ffffff', fontSize: '9.5px', padding: '1px 5px', borderRadius: '10px', fontWeight: 800 }}>
                {data.today?.understaffedBranchesCount || 0}
              </span>
            </button>
          )}

          {hasTomorrowShortage && (
            <button
              type="button"
              onClick={() => setActiveTab('TOMORROW')}
              style={{
                padding: '5px 12px',
                borderRadius: '20px',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: 'pointer',
                border: `1px solid ${activeTab === 'TOMORROW' ? 'rgba(239, 68, 68, 0.5)' : 'rgba(255, 255, 255, 0.08)'}`,
                backgroundColor: activeTab === 'TOMORROW' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                color: activeTab === 'TOMORROW' ? '#f87171' : 'var(--text-muted)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Calendar size={12} />
              <span>Tomorrow ({data.tomorrow?.weekday ? data.tomorrow.weekday.slice(0, 3) : 'Tomorrow'})</span>
              <span style={{ backgroundColor: '#ef4444', color: '#ffffff', fontSize: '9.5px', padding: '1px 5px', borderRadius: '10px', fontWeight: 800 }}>
                {data.tomorrow?.understaffedBranchesCount || 0}
              </span>
            </button>
          )}
        </div>
      )}

      {/* Staffing Shortage Alert Box */}
      <div
        style={{
          padding: '14px 16px',
          backgroundColor: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          borderRadius: '14px',
          boxShadow: '0 4px 16px rgba(239, 68, 68, 0.1)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {/* Main Heading on a single line */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} color="#f87171" style={{ flexShrink: 0 }} />
            <h4 style={{ fontSize: '13.5px', fontWeight: 800, color: '#ffffff', margin: 0, lineHeight: 1.2 }}>
              Staff Shortage: {activeTab === 'TODAY' ? 'Today' : 'Tomorrow'} ({understaffedBranches.length} {understaffedBranches.length === 1 ? 'Branch' : 'Branches'})
            </h4>
          </div>

          {/* Subheading starting with 'Shift staffing minimums...' with small Quick Fill button at right end */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
            <p style={{ fontSize: '11.5px', color: '#fca5a5', margin: 0, flex: 1, minWidth: '160px', lineHeight: 1.3 }}>
              Shift staffing minimums not met due to leaves or missing roster assignments.
            </p>

            <Link
              href={`/${organizationCode}/admin/leave`}
              className="btn btn-danger btn-xs"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                padding: '3px 8px',
                fontSize: '11px',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                fontWeight: 700,
                borderRadius: '6px',
                marginLeft: 'auto',
              }}
            >
              <span>Quick Fill</span>
              <ArrowRight size={11} />
            </Link>
          </div>
        </div>

        {understaffedBranches.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(239, 68, 68, 0.2)' }}>
            {understaffedBranches.map((b) => (
              <div
                key={b.branchId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  color: '#f8fafc',
                  backgroundColor: 'rgba(15, 23, 42, 0.6)',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  flexWrap: 'wrap',
                  gap: '6px',
                }}
              >
                <div>
                  <strong style={{ color: '#ffffff' }}>{b.branchName}</strong> ({b.shiftName}): Available{' '}
                  <span style={{ color: '#f87171', fontWeight: 800 }}>{b.availableStaff}</span> / Min: <strong>{b.minRequired}</strong>
                </div>

                <div style={{ fontSize: '11px', color: '#f87171', fontWeight: 700 }}>
                  Shortage: -{b.shortageCount} staff
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
