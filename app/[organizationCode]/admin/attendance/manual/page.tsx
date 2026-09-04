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
  FileText,
  Loader2,
  AlertTriangle,
  Menu,
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
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);

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
    <div className={styles.container}>
      <OrgAdminSidebar
        organizationCode={organizationCode}
        organizationName={orgData?.name || 'ShiftGuard'}
        logoUrl={orgData?.logoUrl}
      />

      <div className={styles.mainContent}>
        {/* Header Bar */}
        <header className={styles.headerBar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <Link href={`/${organizationCode}/admin/attendance`} className="btn btn-secondary btn-sm" style={{ padding: '8px' }}>
              <ArrowLeft size={16} />
            </Link>
            <div>
              <h1 className={styles.title}>Record Manual Attendance</h1>
              <p className={styles.subtitle}>
                Manually log attendance punches on behalf of employees with explicit justification.
              </p>
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setHeaderMenuOpen(!headerMenuOpen)}
              className="btn btn-secondary btn-sm"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '38px',
                height: '38px',
                padding: 0,
                borderRadius: '10px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-medium)',
                color: '#ffffff',
                cursor: 'pointer',
              }}
              title="Manual Attendance Menu"
            >
              <Menu size={18} />
            </button>

            {headerMenuOpen && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 999 }}
                  onClick={() => setHeaderMenuOpen(false)}
                />
                <div
                  className="glass-card"
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 'calc(100% + 8px)',
                    zIndex: 1000,
                    minWidth: '200px',
                    padding: '6px',
                    backgroundColor: '#0d121f',
                    border: '1px solid var(--border-medium)',
                    borderRadius: '12px',
                    boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.8)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}
                >
                  <Link
                    href={`/${organizationCode}/admin/attendance`}
                    onClick={() => setHeaderMenuOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      color: '#ffffff',
                      textDecoration: 'none',
                      fontSize: '13px',
                      fontWeight: 600,
                    }}
                  >
                    <Clock size={15} color="#38bdf8" />
                    <span>Daily Attendance</span>
                  </Link>

                  <Link
                    href={`/${organizationCode}/admin/attendance/corrections`}
                    onClick={() => setHeaderMenuOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      color: '#ffffff',
                      textDecoration: 'none',
                      fontSize: '13px',
                      fontWeight: 600,
                    }}
                  >
                    <UserCheck size={15} color="#818cf8" />
                    <span>Attendance Corrections</span>
                  </Link>

                  <Link
                    href={`/${organizationCode}/admin/reports`}
                    onClick={() => setHeaderMenuOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      color: '#cbd5e1',
                      textDecoration: 'none',
                      fontSize: '13px',
                      fontWeight: 500,
                    }}
                  >
                    <FileText size={15} color="#34d399" />
                    <span>Reports &amp; Analytics</span>
                  </Link>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Main Content Body */}
        <main className="pageMainContent" style={{ maxWidth: '800px' }}>
          <div className="glass-card" style={{ padding: '28px' }}>
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
        </main>
      </div>

      <OrgAdminMobileNav organizationCode={organizationCode} />
    </div>
  );
}
