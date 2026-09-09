'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  MapPin,
  Calendar,
  AlertCircle,
  FileText,
  Loader2,
  ArrowLeft,
  Building2,
} from 'lucide-react';
import { OrgAdminSidebar } from '@/components/layout/org-admin-sidebar';
import { OrgAdminMobileNav } from '@/components/layout/org-admin-mobile-nav';
import { OrgAdminHeader } from '@/components/layout/org-admin-header';
import { useToast } from '@/components/feedback/toast-provider';
import styles from './CorrectionReview.module.css';

interface PageProps {
  params: {
    organizationCode: string;
    requestId: string;
  };
}

export default function AdminCorrectionReviewPage({ params }: PageProps) {
  const { organizationCode, requestId } = params;
  const router = useRouter();
  const toast = useToast();

  const [request, setRequest] = useState<any>(null);
  const [existingRecords, setExistingRecords] = useState<any[]>([]);
  const [orgData, setOrgData] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [customClockIn, setCustomClockIn] = useState('');
  const [customClockOut, setCustomClockOut] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const formatIsoToTimeInput = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const hours = String(d.getUTCHours()).padStart(2, '0');
    const minutes = String(d.getUTCMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const formatTime = (iso?: string | null) => {
    if (!iso) return 'None';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  };

  const formatDate = (iso?: string | null) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toISOString().slice(0, 10);
    } catch {
      return String(iso);
    }
  };

  useEffect(() => {
    if (!organizationCode || !requestId) return;

    setLoading(true);
    setErrorMsg(null);

    Promise.all([
      fetch(`/api/org/${organizationCode}/branding`)
        .then((r) => (r.ok ? r.json() : {}))
        .catch(() => ({})),
      fetch(`/api/org/${organizationCode}/attendance/admin/corrections/${requestId}`).then((r) =>
        r.json()
      ),
    ])
      .then(([brandRes, detailRes]) => {
        if ((brandRes as any)?.organization) setOrgData((brandRes as any).organization);

        if (detailRes && detailRes.success && detailRes.request) {
          setRequest(detailRes.request);
          setExistingRecords(detailRes.existingRecords || []);

          const reqIn = detailRes.request.requestedClockIn || detailRes.request.originalClockIn;
          const reqOut = detailRes.request.requestedClockOut || detailRes.request.originalClockOut;
          if (reqIn) setCustomClockIn(formatIsoToTimeInput(reqIn));
          if (reqOut) setCustomClockOut(formatIsoToTimeInput(reqOut));
        } else {
          setErrorMsg(detailRes?.error || 'Correction request detail not found.');
        }
      })
      .catch((err) => {
        console.error('Error fetching request detail:', err);
        setErrorMsg('Failed to load request detail. Please check network connection.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [organizationCode, requestId]);

  const handleApprove = async () => {
    if (!confirm('Are you sure you want to APPROVE this attendance correction?')) return;

    setActionLoading(true);
    try {
      const res = await fetch(
        `/api/org/${organizationCode}/attendance/admin/corrections/${requestId}/approve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            comment: comment.trim() || undefined,
            customClockInTime: customClockIn.trim() || undefined,
            customClockOutTime: customClockOut.trim() || undefined,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to approve correction request.');
      }

      toast.success('Attendance correction approved. Records updated with source: ADJUSTED.');
      router.push(`/${organizationCode}/admin/attendance/corrections`);
    } catch (err: any) {
      toast.error(err.message || 'An error occurred.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!comment.trim()) {
      alert('Please provide a rejection reason in the comment box.');
      return;
    }

    if (!confirm('Are you sure you want to REJECT this attendance correction?')) return;

    setActionLoading(true);
    try {
      const res = await fetch(
        `/api/org/${organizationCode}/attendance/admin/corrections/${requestId}/reject`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rejectionReason: comment.trim() }),
        }
      );

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to reject correction request.');
      }

      toast.info('Attendance correction request rejected.');
      router.push(`/${organizationCode}/admin/attendance/corrections`);
    } catch (err: any) {
      toast.error(err.message || 'An error occurred.');
    } finally {
      setActionLoading(false);
    }
  };

  const staffName = request?.staffProfile?.name || request?.staff?.name || 'Staff Member';
  const staffId = request?.staffProfile?.staffId || request?.staff?.staffId || '—';
  const branchName =
    request?.branch?.name || request?.staffProfile?.branchAssignments?.[0]?.branch?.name || 'Unassigned';

  const renderTypeBadge = (type?: string) => {
    if (!type) return null;
    if (type === 'MISSING_CLOCK_IN' || type === 'INCORRECT_CLOCK_IN') {
      return (
        <span
          className={styles.badge}
          style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' }}
        >
          🔴 Unverified Clock In
        </span>
      );
    }
    if (type === 'MISSING_CLOCK_OUT' || type === 'INCORRECT_CLOCK_OUT') {
      return (
        <span
          className={styles.badge}
          style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)' }}
        >
          🟡 Unverified Clock Out
        </span>
      );
    }
    return (
      <span
        className={styles.badge}
        style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)' }}
      >
        🔵 Manual Entry Request
      </span>
    );
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
          panelTitle="Review Attendance Correction"
          panelSubtitle={request ? `Target Punch Date: ${formatDate(request.date)}` : 'Review employee correction request'}
          backHref={`/${organizationCode}/admin/attendance/corrections`}
        />

        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#94a3b8' }}>
            <Loader2 size={36} className="animate-spin" style={{ margin: '0 auto 16px auto', color: '#818cf8' }} />
            <p style={{ fontSize: '15px', fontWeight: 600, color: '#f1f5f9' }}>Loading correction details...</p>
          </div>
        ) : errorMsg || !request ? (
          <div className={styles.card} style={{ textAlign: 'center', padding: '48px 24px', marginTop: '24px' }}>
            <AlertCircle size={40} color="#ef4444" style={{ margin: '0 auto 16px auto' }} />
            <h3 style={{ color: '#ffffff', fontSize: '18px', fontWeight: 700, margin: '0 0 8px 0' }}>
              Error Loading Request
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 20px 0' }}>{errorMsg}</p>
            <button
              onClick={() => router.push(`/${organizationCode}/admin/attendance/corrections`)}
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <ArrowLeft size={14} />
              <span>Back to Corrections Queue</span>
            </button>
          </div>
        ) : (
          <>
            {/* Top Bar Badges */}
            <div className={styles.header} style={{ marginTop: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span className={`${styles.badge} ${styles[`badge${request.status}`]}`}>
                  Status: {request.status}
                </span>
                {renderTypeBadge(request.type)}
                <span className={styles.badge} style={{ background: '#1e293b', color: '#cbd5e1', border: '1px solid #334155' }}>
                  📅 Date: {formatDate(request.date)}
                </span>
              </div>
            </div>

            <div className={styles.cardsContainer}>
              {/* Staff & Incident Information */}
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>
                  <User size={18} color="#38bdf8" />
                  <span>Staff &amp; Incident Information</span>
                </h3>

                <div className={styles.detailsGrid}>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Staff Member</span>
                    <span className={styles.detailVal} style={{ color: '#818cf8' }}>{staffName}</span>
                  </div>

                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Staff ID</span>
                    <span className={styles.detailVal}>{staffId}</span>
                  </div>

                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Assigned Branch</span>
                    <span className={styles.detailVal}>{branchName}</span>
                  </div>

                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Correction Category</span>
                    <span className={styles.detailVal}>{request.type?.replace(/_/g, ' ')}</span>
                  </div>
                </div>
              </div>

              {/* Side-by-Side Time Punch Comparison */}
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>
                  <Clock size={18} color="#f59e0b" />
                  <span>Time Punch Comparison</span>
                </h3>

                <div className={styles.comparisonBox}>
                  <div className={styles.comparisonCol}>
                    <div className={styles.colHeader}>Original Recorded Time</div>
                    <div className={styles.colValue} style={{ color: '#94a3b8' }}>
                      In: <span style={{ color: '#e2e8f0' }}>{formatTime(request.originalClockIn)}</span>
                      <br />
                      Out: <span style={{ color: '#e2e8f0' }}>{formatTime(request.originalClockOut)}</span>
                    </div>
                  </div>

                  <div className={styles.comparisonCol}>
                    <div className={styles.colHeader} style={{ color: '#38bdf8' }}>
                      Requested Punch Correction
                    </div>
                    <div className={styles.colValue} style={{ color: '#34d399' }}>
                      In: <strong>{formatTime(request.requestedClockIn)}</strong>
                      <br />
                      Out: <strong style={{ color: '#fbbf24' }}>{formatTime(request.requestedClockOut)}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Staff Justification / Reason Box */}
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>
                  <FileText size={18} color="#818cf8" />
                  <span>Staff Justification / Outage Reason</span>
                </h3>
                <div className={styles.reasonBox}>
                  &ldquo;{request.reason || 'No detailed explanation provided.'}&rdquo;
                </div>
              </div>

              {/* Administrator Decision Card (If PENDING) */}
              {request.status === 'PENDING' ? (
                <div className={styles.actionCard}>
                  <h3 className={styles.cardTitle}>
                    <ShieldCheck size={18} color="#10b981" />
                    <span>Administrator Decision &amp; Time Override</span>
                  </h3>

                  {/* Custom Clock-In / Clock-Out Override Inputs */}
                  <div style={{ marginBottom: '20px', padding: '16px', background: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#38bdf8', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={15} />
                      <span>Approved Punch Time Override (Customize below if required)</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                          Clock-In Time
                        </label>
                        <input
                          type="time"
                          value={customClockIn}
                          onChange={(e) => setCustomClockIn(e.target.value)}
                          style={{
                            width: '100%',
                            backgroundColor: '#111827',
                            border: '1px solid #334155',
                            borderRadius: '8px',
                            color: '#ffffff',
                            padding: '8px 12px',
                            fontSize: '14px',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                          Clock-Out Time
                        </label>
                        <input
                          type="time"
                          value={customClockOut}
                          onChange={(e) => setCustomClockOut(e.target.value)}
                          style={{
                            width: '100%',
                            backgroundColor: '#111827',
                            border: '1px solid #334155',
                            borderRadius: '8px',
                            color: '#ffffff',
                            padding: '8px 12px',
                            fontSize: '14px',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <label
                    style={{
                      fontSize: '12.5px',
                      color: '#cbd5e1',
                      display: 'block',
                      marginBottom: '8px',
                      fontWeight: 600,
                    }}
                  >
                    Feedback / Review Note (Required for Rejection, Optional for Approval)
                  </label>
                  <textarea
                    className={styles.textarea}
                    placeholder="Enter review notes, justification comments, or reason if rejecting..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />

                  <div className={styles.buttonRow}>
                    <button
                      type="button"
                      className={styles.rejectBtn}
                      disabled={actionLoading}
                      onClick={handleReject}
                    >
                      {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                      <span>{actionLoading ? 'Processing...' : 'Reject Request'}</span>
                    </button>

                    <button
                      type="button"
                      className={styles.approveBtn}
                      disabled={actionLoading}
                      onClick={handleApprove}
                    >
                      {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                      <span>{actionLoading ? 'Processing...' : 'Approve & Adjust Attendance'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.card}>
                  <h3 className={styles.cardTitle}>
                    <ShieldCheck size={18} color="#94a3b8" />
                    <span>Review Decision Details</span>
                  </h3>
                  <div className={styles.detailsGrid}>
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Reviewed By</span>
                      <span className={styles.detailVal}>{request.reviewerUser?.name || 'Administrator'}</span>
                    </div>
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Reviewed Date</span>
                      <span className={styles.detailVal}>
                        {request.reviewedAt ? new Date(request.reviewedAt).toLocaleString() : '—'}
                      </span>
                    </div>
                    {request.reviewerComment && (
                      <div className={styles.detailItem} style={{ gridColumn: '1 / -1' }}>
                        <span className={styles.detailLabel}>Admin Comment</span>
                        <div className={styles.reasonBox} style={{ borderLeftColor: '#f59e0b' }}>
                          {request.reviewerComment}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      <OrgAdminMobileNav organizationCode={organizationCode} />
    </div>
  );
}
