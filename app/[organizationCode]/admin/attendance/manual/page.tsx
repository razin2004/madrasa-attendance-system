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
import { OrgAdminSidebar } from '../../../../../components/layout/org-admin-sidebar';
import { OrgAdminMobileNav } from '../../../../../components/layout/org-admin-mobile-nav';
import { useToast } from '../../../../../components/feedback/toast-provider';
import styles from './ManualAttendance.module.css';

export default function AdminManualAttendancePage() {
  const params = useParams();
  const organizationCode = (params.organizationCode as string)?.toUpperCase() || '';
  const router = useRouter();
  const toast = useToast();

  const [loadingStaff, setLoadingStaff] = useState(true);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [orgData, setOrgData] = useState<any>(null);

  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [clockInTime, setClockInTime] = useState('08:00');
  const [clockOutTime, setClockOutTime] = useState('17:00');
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
          const list = data.staffMembers || data.staff || [];
          setStaffList(list);
          if (list.length > 0) {
            setSelectedStaffId(list[0].id);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingStaff(false));
  }, [organizationCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffId || !date || !clockInTime || !reason.trim()) {
      toast.error('Please complete all required fields including staff, date, clock in time, and reason.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/org/${organizationCode}/attendance/admin/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffProfileId: selectedStaffId,
          staffId: selectedStaffId,
          date,
          clockInTime,
          clockOutTime,
          reason,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Manual attendance entry created successfully.');
        router.push(`/${organizationCode}/admin/attendance`);
      } else {
        toast.error(data.error || 'Failed to create manual attendance.');
      }
    } catch {
      toast.error('Network error creating manual attendance.');
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
            href={`/${organizationCode}/admin/attendance`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '13px', textDecoration: 'none', marginBottom: '12px' }}
          >
            <ArrowLeft size={16} />
            <span>Back to Attendance Overview</span>
          </Link>

          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
            Record Manual Attendance Punch
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Manually log attendance punches on behalf of employees with explicit justification (Source: MANUAL).
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

            {/* Date */}
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label">Attendance Date *</label>
              <input
                type="date"
                className="form-input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            {/* Times */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div className="form-group">
                <label className="form-label">Clock In Time *</label>
                <input
                  type="time"
                  className="form-input"
                  value={clockInTime}
                  onChange={(e) => setClockInTime(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Clock Out Time (Optional)</label>
                <input
                  type="time"
                  className="form-input"
                  value={clockOutTime}
                  onChange={(e) => setClockOutTime(e.target.value)}
                />
              </div>
            </div>

            {/* Reason */}
            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label className="form-label">Reason / Justification *</label>
              <textarea
                className="form-input"
                style={{ height: '90px' }}
                placeholder="Mandatory explanation for creating this manual attendance entry..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <Link href={`/${organizationCode}/admin/attendance`} className="btn btn-secondary">
                Cancel
              </Link>
              <button type="submit" disabled={submitting} className="btn btn-primary">
                {submitting ? 'Creating Entry...' : 'Create Manual Attendance'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <OrgAdminMobileNav organizationCode={organizationCode} />
    </div>
  );
}
