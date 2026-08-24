'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  ArrowLeft,
  UserCheck,
  FilePlus,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { OrgAdminSidebar } from '@/components/layout/org-admin-sidebar';
import { OrgAdminMobileNav } from '@/components/layout/org-admin-mobile-nav';
import { useToast } from '@/components/feedback/toast-provider';
import styles from './ManualLeave.module.css';

export default function AdminManualLeavePage() {
  const params = useParams();
  const organizationCode = (params.organizationCode as string)?.toUpperCase() || '';
  const router = useRouter();
  const toast = useToast();

  const [loadingStaff, setLoadingStaff] = useState(true);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [orgData, setOrgData] = useState<any>(null);

  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [leaveType, setLeaveType] = useState('Annual Leave');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/org/${organizationCode}/branding`)
      .then((r) => r.json())
      .then((data) => {
        if (data.organization) setOrgData(data.organization);
      })
      .catch(() => {});

    fetch(`/api/org/${organizationCode}/staff`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setStaffList(data.staffMembers || []);
          if (data.staffMembers?.length > 0) {
            setSelectedStaffId(data.staffMembers[0].id);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingStaff(false));
  }, [organizationCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffId || !startDate || !endDate || !reason.trim()) {
      toast.error('Please complete all required fields including staff, dates, and reason.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/org/${organizationCode}/leave/admin/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: selectedStaffId,
          leaveType,
          startDate,
          endDate,
          reason,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Manual leave entry created successfully.');
        router.push(`/${organizationCode}/admin/leave`);
      } else {
        toast.error(data.error || 'Failed to create manual leave entry.');
      }
    } catch {
      toast.error('Network error creating manual leave.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.pageContainer}>
      <OrgAdminSidebar
        organizationCode={organizationCode}
        organizationName={orgData?.name || 'ShiftGuard'}
        logoUrl={orgData?.logoUrl}
      />

      <div className={styles.mainContent}>
        <div style={{ marginBottom: '24px' }}>
          <Link
            href={`/${organizationCode}/admin/leave`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '13px', textDecoration: 'none', marginBottom: '12px' }}
          >
            <ArrowLeft size={16} />
            <span>Back to Leave Directory</span>
          </Link>

          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
            Record Manual Leave Entry
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Record employee leave manually on behalf of staff members when normal application is not possible.
          </p>
        </div>

        <div className="glass-card" style={{ maxWidth: '640px', padding: '28px' }}>
          <form onSubmit={handleSubmit}>
            {/* Staff Selection */}
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label">Staff Member *</label>
              {loadingStaff ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading staff list...</div>
              ) : (
                <select
                  className="form-input"
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                >
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.staffId})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Leave Type */}
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label">Leave Type *</label>
              <select
                className="form-input"
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value)}
              >
                <option value="Annual Leave">Annual Leave</option>
                <option value="Sick Leave">Sick Leave</option>
                <option value="Casual Leave">Casual Leave</option>
                <option value="Duty Leave">Duty Leave</option>
                <option value="Unpaid Leave">Unpaid Leave</option>
              </select>
            </div>

            {/* Date Range */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div className="form-group">
                <label className="form-label">Start Date *</label>
                <input
                  type="date"
                  className="form-input"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">End Date *</label>
                <input
                  type="date"
                  className="form-input"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            {/* Reason */}
            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label className="form-label">Reason / Justification *</label>
              <textarea
                className="form-input"
                style={{ height: '90px' }}
                placeholder="Explain the reason for this manual leave record..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <Link href={`/${organizationCode}/admin/leave`} className="btn btn-secondary">
                Cancel
              </Link>
              <button type="submit" disabled={submitting} className="btn btn-primary">
                {submitting ? 'Creating Entry...' : 'Create Manual Entry'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <OrgAdminMobileNav organizationCode={organizationCode} />
    </div>
  );
}
