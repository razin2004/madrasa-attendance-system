'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Users, ArrowRight, RefreshCw } from 'lucide-react';

interface BranchCoverage {
  branchId: string;
  branchName: string;
  totalStaff: number;
  onLeaveStaff: number;
  availableStaff: number;
  minRequired: number;
  isUnderstaffed: boolean;
  shortageCount: number;
}

interface BranchStaffingBannerProps {
  organizationCode: string;
}

export function BranchStaffingBanner({ organizationCode }: BranchStaffingBannerProps) {
  const [data, setData] = useState<{
    overallStatus: 'OK' | 'UNDERSTAFFED';
    understaffedBranchesCount: number;
    branches: BranchCoverage[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCoverage = async () => {
    try {
      const res = await fetch(`/api/org/${organizationCode}/branches/staffing-coverage`);
      const resData = await res.json();
      if (res.ok && resData.success) {
        setData(resData);
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

  if (loading || !data || data.branches.length === 0) return null;

  const understaffedBranches = data.branches.filter((b) => b.isUnderstaffed);

  if (data.overallStatus === 'OK' || understaffedBranches.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 18px',
          backgroundColor: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          borderRadius: '10px',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CheckCircle2 size={18} color="#34d399" />
          <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#f8fafc' }}>
            All active workplace branches meet minimum required staffing levels for today.
          </span>
        </div>
        <Link
          href={`/${organizationCode}/admin/roster`}
          style={{ fontSize: '12.5px', fontWeight: 600, color: '#34d399', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          View Roster &rarr;
        </Link>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '16px 20px',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid rgba(239, 68, 68, 0.35)',
        borderRadius: '12px',
        marginBottom: '24px',
        boxShadow: '0 4px 16px rgba(239, 68, 68, 0.08)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertTriangle size={22} color="#f87171" style={{ flexShrink: 0 }} />
          <div>
            <h4 style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
              ⚠️ Staffing Coverage Alert ({data.understaffedBranchesCount} Branch{data.understaffedBranchesCount > 1 ? 'es' : ''} Below Minimum)
            </h4>
            <p style={{ fontSize: '12.5px', color: '#fca5a5', margin: '2px 0 0 0' }}>
              Staffing falls below configured minimum threshold due to active approved leaves or unassigned shifts.
            </p>
          </div>
        </div>

        <Link
          href={`/${organizationCode}/admin/leave`}
          className="btn btn-danger btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
        >
          <span>Manage Leaves &amp; Coverage</span>
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
              backgroundColor: 'rgba(15, 23, 42, 0.4)',
              padding: '8px 12px',
              borderRadius: '6px',
            }}
          >
            <div>
              <strong style={{ color: '#ffffff' }}>{b.branchName}</strong>: Available staff today is{' '}
              <span style={{ color: '#f87171', fontWeight: 800 }}>{b.availableStaff}</span> (Min required:{' '}
              <strong>{b.minRequired}</strong>)
            </div>

            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {b.onLeaveStaff} staff on leave &bull; Shortage:{' '}
              <span style={{ color: '#f87171', fontWeight: 700 }}>-{b.shortageCount} staff</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
