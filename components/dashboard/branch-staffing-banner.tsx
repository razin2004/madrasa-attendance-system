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

  if (loading || !data) return null;

  const currentCoverage = activeTab === 'TODAY' ? data.today : data.tomorrow;
  const understaffedBranches = (currentCoverage.branches || []).filter((b) => b.isWorkingDay && b.isUnderstaffed);
  const isOk = currentCoverage.overallStatus === 'OK' || understaffedBranches.length === 0;

  return (
    <div style={{ marginBottom: '24px' }}>
      {/* Date Toggle Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('TODAY')}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              border: `1px solid ${activeTab === 'TODAY' ? 'rgba(99, 102, 241, 0.5)' : 'rgba(255, 255, 255, 0.08)'}`,
              backgroundColor: activeTab === 'TODAY' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.03)',
              color: activeTab === 'TODAY' ? '#818cf8' : 'var(--text-muted)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Calendar size={13} />
            <span>Today ({data.today.weekday.slice(0, 3)})</span>
            {data.today.understaffedBranchesCount > 0 && (
              <span style={{ backgroundColor: '#ef4444', color: '#ffffff', fontSize: '10px', padding: '1px 6px', borderRadius: '10px' }}>
                {data.today.understaffedBranchesCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('TOMORROW')}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              border: `1px solid ${activeTab === 'TOMORROW' ? 'rgba(99, 102, 241, 0.5)' : 'rgba(255, 255, 255, 0.08)'}`,
              backgroundColor: activeTab === 'TOMORROW' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.03)',
              color: activeTab === 'TOMORROW' ? '#818cf8' : 'var(--text-muted)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Calendar size={13} />
            <span>Tomorrow ({data.tomorrow.weekday.slice(0, 3)})</span>
            {data.tomorrow.understaffedBranchesCount > 0 && (
              <span style={{ backgroundColor: '#ef4444', color: '#ffffff', fontSize: '10px', padding: '1px 6px', borderRadius: '10px' }}>
                {data.tomorrow.understaffedBranchesCount}
              </span>
            )}
          </button>
        </div>

        <Link
          href={`/${organizationCode}/admin/roster`}
          style={{ fontSize: '12px', fontWeight: 600, color: '#38bdf8', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
        >
          <span>View Weekly Roster</span>
          <ArrowRight size={13} />
        </Link>
      </div>

      {/* Banner Content Card */}
      {isOk ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            backgroundColor: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle2 size={18} color="#34d399" />
            <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#f8fafc' }}>
              All active workplace branches meet minimum required staffing levels for {activeTab === 'TODAY' ? 'today' : 'tomorrow'} ({currentCoverage.weekday}).
            </span>
          </div>
        </div>
      ) : (
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: '12px',
            boxShadow: '0 4px 16px rgba(239, 68, 68, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertTriangle size={22} color="#f87171" style={{ flexShrink: 0 }} />
              <div>
                <h4 style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                  ⚠️ Staffing Coverage Alert for {activeTab === 'TODAY' ? 'Today' : 'Tomorrow'} ({understaffedBranches.length} Branch{understaffedBranches.length > 1 ? 'es' : ''} Below Minimum)
                </h4>
                <p style={{ fontSize: '12.5px', color: '#fca5a5', margin: '2px 0 0 0' }}>
                  Coverage falls below shift minimum threshold on working days due to active approved leaves or unassigned shifts.
                </p>
              </div>
            </div>

            <Link
              href={`/${organizationCode}/admin/leave`}
              className="btn btn-danger btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
            >
              <span>Manage Coverage &amp; Leaves</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(239, 68, 68, 0.2)' }}>
            {understaffedBranches.map((b) => (
              <div
                key={b.branchId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '13px',
                  color: '#f8fafc',
                  backgroundColor: 'rgba(15, 23, 42, 0.5)',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <div>
                  <strong style={{ color: '#ffffff' }}>{b.branchName}</strong> &bull; <span style={{ color: '#818cf8', fontWeight: 600 }}>{b.shiftName}</span>: Available staff {activeTab === 'TODAY' ? 'today' : 'tomorrow'} is{' '}
                  <span style={{ color: '#f87171', fontWeight: 800 }}>{b.availableStaff}</span> (Min required:{' '}
                  <strong>{b.minRequired}</strong>)
                </div>

                <div style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{b.onLeaveStaff} on leave</span> &bull;
                  <span style={{ color: '#f87171', fontWeight: 700 }}>Shortage: -{b.shortageCount} staff</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
