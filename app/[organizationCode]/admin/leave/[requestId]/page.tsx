'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  ShieldCheck,
  UserCheck,
  Users,
  FileText,
  Loader2,
} from 'lucide-react';
import { OrgAdminSidebar } from '@/components/layout/org-admin-sidebar';
import { OrgAdminMobileNav } from '@/components/layout/org-admin-mobile-nav';
import { useToast } from '@/components/feedback/toast-provider';
import { ConfirmationModal } from '@/components/feedback/confirmation-modal';
import styles from './LeaveReview.module.css';

export default function AdminLeaveReviewPage() {
  const params = useParams();
  const organizationCode = (params.organizationCode as string)?.toUpperCase() || '';
  const requestId = params.requestId as string;
  const router = useRouter();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [requestDetails, setRequestDetails] = useState<any>(null);
  const [impactData, setImpactData] = useState<any[]>([]);
  const [hasShortage, setHasShortage] = useState(false);
  const [orgData, setOrgData] = useState<any>(null);

  // Approval & Rejection Modal States
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetch(`/api/org/${organizationCode}/branding`)
      .then((r) => r.json())
      .then((data) => {
        if (data.organization) setOrgData(data.organization);
      })
      .catch(() => {});
  }, [organizationCode]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/org/${organizationCode}/leave/admin/${requestId}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setRequestDetails(data.request);
        if (data.staffingImpact) {
          setImpactData(data.staffingImpact);
          const shortageFound = data.staffingImpact.some((day: any) => day.isShortage);
          setHasShortage(shortageFound);
        }
      } else {
        toast.error(data.error || 'Failed to load leave request details.');
      }
    } catch {
      toast.error('Network error loading request.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (requestId) {
      fetchData();
    }
  }, [organizationCode, requestId]);

  const handleApprove = async () => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/org/${organizationCode}/leave/admin/${requestId}/approve`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Leave request approved successfully.');
        setShowApproveModal(false);
        fetchData();
      } else {
        toast.error(data.error || 'Failed to approve leave request.');
      }
    } catch {
      toast.error('Network error approving leave.');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error('Please enter a rejection comment.');
      return;
    }
    setProcessing(true);
    try {
      const res = await fetch(`/api/org/${organizationCode}/leave/admin/${requestId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: rejectReason }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Leave request rejected.');
        setShowRejectModal(false);
        fetchData();
      } else {
        toast.error(data.error || 'Failed to reject leave request.');
      }
    } catch {
      toast.error('Network error rejecting leave.');
    } finally {
      setProcessing(false);
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
        {/* Navigation & Header */}
        <div style={{ marginBottom: '24px' }}>
          <Link
            href={`/${organizationCode}/admin/leave`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '13px', textDecoration: 'none', marginBottom: '12px' }}
          >
            <ArrowLeft size={16} />
            <span>Back to Leave Requests</span>
          </Link>

          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
            Leave Decision Support & Review
          </h1>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <Loader2 size={36} className="animate-spin" style={{ color: '#818cf8', margin: '0 auto 12px auto' }} />
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading request details &amp; staffing impact...</p>
          </div>
        ) : !requestDetails ? (
          <div className="glass-card" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Leave request details could not be found.
          </div>
        ) : (
          <div>
            {/* Request Summary Card */}
            <div className="glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff' }}>
                    {requestDetails.staff?.name}
                  </div>
                  <div style={{ fontSize: '13px', color: '#818cf8', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                    Staff ID: {requestDetails.staff?.staffId} &bull; {requestDetails.staff?.department || 'General'}
                  </div>
                </div>

                <span className={`badge ${requestDetails.status === 'APPROVED' ? 'badge-success' : requestDetails.status === 'REJECTED' ? 'badge-danger' : 'badge-warning'}`}>
                  {requestDetails.status}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border-subtle)' }}>
                <div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Leave Type</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', marginTop: '2px' }}>{requestDetails.leaveType}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Date Range</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc', marginTop: '2px' }}>
                    {new Date(requestDetails.startDate).toLocaleDateString()} – {new Date(requestDetails.endDate).toLocaleDateString()}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Duration</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#818cf8', marginTop: '2px' }}>{requestDetails.daysCount} Days</div>
                </div>
                <div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Reason</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px', fontStyle: 'italic' }}>
                    &ldquo;{requestDetails.reason || 'No reason provided'}&rdquo;
                  </div>
                </div>
              </div>
            </div>

            {/* STAFFING SHORTAGE WARNING CALLOUT (Section 15 & 16) */}
            {hasShortage && (
              <div className={styles.shortageWarning}>
                <AlertTriangle size={24} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '15px', color: '#ffffff' }}>
                    Minimum Staffing Threshold Exceeded
                  </div>
                  <div style={{ fontSize: '13px', marginTop: '2px', color: 'rgba(255, 255, 255, 0.9)' }}>
                    Approving this request will reduce available staff below the required minimum staffing threshold on one or more dates. Review the impact analysis below before deciding.
                  </div>
                </div>
              </div>
            )}

            {/* STAFFING IMPACT ANALYSIS MATRIX (Section 15) */}
            <div className={styles.impactCard}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={18} color="#818cf8" />
                <span>Shift Staffing Impact Breakdown</span>
              </h2>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left' }}>
                      <th style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '11.5px', textTransform: 'uppercase' }}>Date</th>
                      <th style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '11.5px', textTransform: 'uppercase' }}>Scheduled Staff</th>
                      <th style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '11.5px', textTransform: 'uppercase' }}>On Leave</th>
                      <th style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '11.5px', textTransform: 'uppercase' }}>Remaining Available</th>
                      <th style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '11.5px', textTransform: 'uppercase' }}>Min Required</th>
                      <th style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '11.5px', textTransform: 'uppercase' }}>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {impactData.map((day: any, idx: number) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '12px', fontWeight: 700, color: '#ffffff' }}>{day.date}</td>
                        <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{day.totalScheduled}</td>
                        <td style={{ padding: '12px', color: '#fbbf24' }}>{day.onLeaveCount + 1}</td>
                        <td style={{ padding: '12px', fontWeight: 700, color: day.isShortage ? '#f87171' : '#34d399' }}>
                          {day.remainingStaff}
                        </td>
                        <td style={{ padding: '12px', color: 'var(--text-muted)' }}>{day.minRequired}</td>
                        <td style={{ padding: '12px' }}>
                          {day.isShortage ? (
                            <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <XCircle size={12} /> Below Minimum
                            </span>
                          ) : (
                            <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <CheckCircle2 size={12} /> Meets Minimum
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ACTION CONTROLS */}
            {requestDetails.status === 'PENDING' && (
              <div className={styles.actionsCard}>
                <button
                  onClick={() => setShowRejectModal(true)}
                  className="btn btn-danger"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <XCircle size={16} />
                  <span>Reject Leave</span>
                </button>

                <button
                  onClick={() => setShowApproveModal(true)}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <CheckCircle2 size={16} />
                  <span>Approve Leave</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* APPROVAL MODAL */}
      <ConfirmationModal
        isOpen={showApproveModal}
        onClose={() => setShowApproveModal(false)}
        onConfirm={handleApprove}
        title="Approve Leave Request?"
        message={`Are you sure you want to approve ${requestDetails?.daysCount} days of ${requestDetails?.leaveType} for ${requestDetails?.staff?.name}?`}
        confirmText="Approve Leave"
        variant="primary"
      />

      {/* REJECTION MODAL */}
      {showRejectModal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 999999, backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '440px', padding: '24px', backgroundColor: '#0d121f' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', margin: '0 0 8px 0' }}>
              Reject Leave Request
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px 0' }}>
              Please provide a reason for rejecting this leave request. This will be sent to the employee.
            </p>

            <textarea
              className="form-input"
              style={{ width: '100%', height: '90px', marginBottom: '20px', fontSize: '13px' }}
              placeholder="Enter rejection reason..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setShowRejectModal(false)} className="btn btn-secondary btn-sm">
                Cancel
              </button>
              <button onClick={handleReject} disabled={processing} className="btn btn-danger btn-sm">
                {processing ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      <OrgAdminMobileNav organizationCode={organizationCode} />
    </div>
  );
}
