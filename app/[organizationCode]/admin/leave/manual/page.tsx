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
import { OrgAdminHeader } from '@/components/layout/org-admin-header';
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
  const [leaveType, setLeaveType] = useState('ANNUAL');
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
          staffProfileId: selectedStaffId,
          staffId: selectedStaffId,
          type: leaveType,
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
        <OrgAdminHeader
          organizationCode={organizationCode}
          logoUrl={orgData?.logoUrl}
          panelTitle="Record Manual Leave Entry"
          panelSubtitle="Record employee leave manually on behalf of staff members when normal application is not possible."
          backHref={`/${organizationCode}/admin/leave`}
        />

        <main className="pageMainContent" style={{ maxWidth: '800px' }}>
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <FilePlus size={18} color="#818cf8" />
              <h3 className={styles.sectionTitle}>Manual Leave Entry Details</h3>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Staff Selection */}
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
                  Staff Member <span style={{ color: 'var(--danger-text)' }}>*</span>
                </label>
                {loadingStaff ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading staff list...</div>
                ) : (
                  <select
                    className="form-input"
                    style={{ width: '100%' }}
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
                <label className="form-label" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
                  Leave Type <span style={{ color: 'var(--danger-text)' }}>*</span>
                </label>
                <select
                  className="form-input"
                  style={{ width: '100%' }}
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                >
                  <option value="ANNUAL">Annual Leave</option>
                  <option value="SICK">Sick Leave</option>
                  <option value="OTHER">Casual / Other Leave</option>
                  <option value="DUTY">Duty Leave</option>
                </select>
              </div>

              {/* Date Range */}
              <div className={styles.dateGrid}>
                <div className="form-group" style={{ minWidth: 0, width: '100%' }}>
                  <label className="form-label" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
                    Start Date <span style={{ color: 'var(--danger-text)' }}>*</span>
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', fontSize: '13.5px', padding: '10px 12px' }}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ minWidth: 0, width: '100%' }}>
                  <label className="form-label" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
                    End Date <span style={{ color: 'var(--danger-text)' }}>*</span>
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', fontSize: '13.5px', padding: '10px 12px' }}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Reason */}
              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
                  Reason / Justification <span style={{ color: 'var(--danger-text)' }}>*</span>
                </label>
                <textarea
                  className="form-input"
                  style={{ width: '100%', height: '90px', resize: 'vertical' }}
                  placeholder="Explain the reason for this manual leave record..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>

              <div className={styles.actionRow}>
                <Link href={`/${organizationCode}/admin/leave`} className="btn btn-secondary">
                  Cancel
                </Link>
                <button type="submit" disabled={submitting} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Creating Entry...</span>
                    </>
                  ) : (
                    <>
                      <UserCheck size={16} />
                      <span>Create Manual Entry</span>
                    </>
                  )}
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
