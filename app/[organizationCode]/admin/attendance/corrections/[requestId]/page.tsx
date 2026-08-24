'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  MapPin,
  Calendar,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { OrgAdminSidebar } from '@/components/layout/org-admin-sidebar';
import { OrgAdminMobileNav } from '@/components/layout/org-admin-mobile-nav';
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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    // Load metadata and request detail
    Promise.all([
      fetch(`/api/org/${organizationCode}/metadata`).then((r) => r.json()),
      fetch(`/api/org/${organizationCode}/attendance/admin/corrections/${requestId}`).then((r) =>
        r.json()
      ),
    ])
      .then(([metaRes, detailRes]) => {
        if (metaRes.organization) setOrgData(metaRes.organization);
        if (detailRes.success && detailRes.request) {
          setRequest(detailRes.request);
          setExistingRecords(detailRes.existingRecords || []);
        } else {
          setErrorMsg(detailRes.error || 'Correction request not found.');
        }
      })
      .catch((err) => {
        console.error('Error fetching request detail:', err);
        setErrorMsg('Network error loading request detail.');
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
          body: JSON.stringify({ comment: comment.trim() || undefined }),
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

  const formatTime = (iso?: string | null) => {
    if (!iso) return 'None';
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={styles.pageContainer}>
      <OrgAdminSidebar
        organizationCode={organizationCode}
        organizationName={orgData?.name || 'ShiftGuard'}
        logoUrl={orgData?.logoUrl}
      />

      <div className={styles.mainContent}>
        <Link href={`/${organizationCode}/admin/attendance/corrections`} className={styles.backLink}>
          <ArrowLeft size={16} /> Back to Requests
        </Link>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
            Loading request review...
          </div>
        ) : errorMsg || !request ? (
          <div className={styles.card} style={{ textAlign: 'center', padding: '40px' }}>
            <AlertCircle size={36} color="#ef4444" style={{ margin: '0 auto 12px' }} />
            <h3 style={{ color: '#ffffff' }}>Error Loading Request</h3>
            <p style={{ color: '#94a3b8' }}>{errorMsg}</p>
          </div>
        ) : (
          <>
            <div className={styles.header}>
              <div>
                <h1 className={styles.title}>Review Attendance Correction</h1>
                <p className={styles.subtitle}>
                  Target Date: <strong>{new Date(request.date).toISOString().slice(0, 10)}</strong> | Submitted{' '}
                  {new Date(request.createdAt).toLocaleDateString()}
                </p>
              </div>

              <span className={`${styles.badge} ${styles[`badge${request.status}`]}`}>
                {request.status}
              </span>
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
                    <span className={styles.detailVal}>{request.staffProfile?.name}</span>
                  </div>

                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Staff ID</span>
                    <span className={styles.detailVal}>{request.staffProfile?.staffId}</span>
                  </div>

                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Branch</span>
                    <span className={styles.detailVal}>
                      {request.branch?.name || request.staffProfile?.branchAssignments?.[0]?.branch?.name || 'Unassigned'}
                    </span>
                  </div>

                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Correction Type</span>
                    <span className={styles.detailVal}>{request.type.replace(/_/g, ' ')}</span>
                  </div>
                </div>
              </div>

              {/* Side-by-Side Comparison Box */}
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>
                  <Clock size={18} color="#f59e0b" />
                  <span>Time Punch Comparison</span>
                </h3>

                <div className={styles.comparisonBox}>
                  <div className={styles.comparisonCol}>
                    <div className={styles.colHeader}>Original Recorded Time</div>
                    <div className={styles.colValue} style={{ color: '#94a3b8' }}>
                      In: {formatTime(request.originalClockIn)}
                      <br />
                      Out: {formatTime(request.originalClockOut)}
                    </div>
                  </div>

                  <div className={styles.comparisonCol}>
                    <div className={styles.colHeader} style={{ color: '#38bdf8' }}>
                      Requested Adjusted Time
                    </div>
                    <div className={styles.colValue} style={{ color: '#34d399' }}>
                      In: {formatTime(request.requestedClockIn)}
                      <br />
                      Out: {formatTime(request.requestedClockOut)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Staff Reason */}
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>
                  <FileText size={18} color="#818cf8" />
                  <span>Staff Justification / Outage Reason</span>
                </h3>
                <div className={styles.reasonBox}>{request.reason}</div>
              </div>

              {/* Admin Action Box (If PENDING) */}
              {request.status === 'PENDING' ? (
                <div className={styles.actionCard}>
                  <h3 className={styles.cardTitle}>
                    <ShieldCheck size={18} color="#10b981" />
                    <span>Administrator Decision</span>
                  </h3>

                  <label
                    style={{
                      fontSize: '12.5px',
                      color: '#cbd5e1',
                      display: 'block',
                      marginBottom: '8px',
                      fontWeight: 600,
                    }}
                  >
                    Feedback / Reason Note (Required for Rejection, Optional for Approval)
                  </label>
                  <textarea
                    className={styles.textarea}
                    placeholder="Enter review feedback, verification notes, or reason if rejecting..."
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
                      <XCircle size={16} />
                      <span>{actionLoading ? 'Processing...' : 'Reject Request'}</span>
                    </button>

                    <button
                      type="button"
                      className={styles.approveBtn}
                      disabled={actionLoading}
                      onClick={handleApprove}
                    >
                      <CheckCircle2 size={16} />
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
