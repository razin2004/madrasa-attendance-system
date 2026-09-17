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
import { OrgAdminHeader } from '@/components/layout/org-admin-header';
import { useToast } from '@/components/feedback/toast-provider';
import { ConfirmationModal } from '@/components/feedback/confirmation-modal';
import { LeaveShiftsGraph } from '@/components/leave/leave-shifts-graph';
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
  const [showDocModal, setShowDocModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const [balances, setBalances] = useState<any[]>([]);

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
        if (data.request?.startDate) {
          const s = new Date(data.request.startDate).toISOString().split('T')[0];
          setApprovedStartDate(s);
        }
        if (data.request?.endDate) {
          const e = new Date(data.request.endDate).toISOString().split('T')[0];
          setApprovedEndDate(e);
        }
        if (data.balances) setBalances(data.balances);
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

  // Partial & Full Approval States
  const [approveMode, setApproveMode] = useState<'FULL' | 'PARTIAL'>('FULL');
  const [approvedStartDate, setApprovedStartDate] = useState('');
  const [approvedEndDate, setApprovedEndDate] = useState('');
  const [approveComment, setApproveComment] = useState('');

  const handleApprove = async () => {
    setProcessing(true);
    try {
      const payload: any = {
        comment: approveComment,
      };

      if (approveMode === 'PARTIAL') {
        if (!approvedStartDate || !approvedEndDate) {
          toast.error('Please select approved start and end dates.');
          setProcessing(false);
          return;
        }
        if (new Date(approvedStartDate) > new Date(approvedEndDate)) {
          toast.error('Approved start date cannot be after end date.');
          setProcessing(false);
          return;
        }
        payload.approvedStartDate = approvedStartDate;
        payload.approvedEndDate = approvedEndDate;
      }

      const res = await fetch(`/api/org/${organizationCode}/leave/admin/${requestId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(approveMode === 'PARTIAL' ? 'Leave partially approved successfully!' : 'Leave request approved successfully.');
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
        <OrgAdminHeader
          organizationCode={organizationCode}
          logoUrl={orgData?.logoUrl}
          panelTitle="Leave Decision Support & Review"
          panelSubtitle={requestDetails ? `${requestDetails.staff?.name || 'Staff'} • ${requestDetails.daysCount} Days ${requestDetails.leaveType}` : 'Review employee leave application'}
          backHref={`/${organizationCode}/admin/leave`}
        />

        <div className={styles.pageBody}>
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

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px', marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border-subtle)' }}>
                <div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Leave Type</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', marginTop: '2px' }}>{requestDetails.leaveType}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Date Range</div>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#f8fafc', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                    {new Date(requestDetails.startDate).toLocaleDateString(undefined, { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })} – {new Date(requestDetails.endDate).toLocaleDateString(undefined, { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Duration</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#818cf8', marginTop: '2px' }}>{requestDetails.daysCount} Days</div>
                </div>
                <div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Reason</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px', fontStyle: 'italic', lineHeight: 1.4 }}>
                    &ldquo;{requestDetails.reason || 'No reason provided'}&rdquo;
                  </div>
                </div>
              </div>

              {/* Employee Current Leave Balances Preview */}
              {balances.length > 0 && (
                <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px dashed var(--border-subtle)' }}>
                  <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
                    Staff Current Entitlement Balances ({new Date().getUTCFullYear()})
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                    {balances.map((b: any) => (
                      <div key={b.leaveType} style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                        <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>{b.leaveType}</div>
                        <div style={{ fontSize: '16px', fontWeight: 800, color: b.remaining > 0 ? '#34d399' : '#f87171', marginTop: '2px' }}>
                          {b.remaining} <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 400 }}>/ {b.entitlement} left</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* REVIEW DECISION DETAILS CARD (If Reviewed) */}
            {requestDetails.status !== 'PENDING' && (
              <div className="glass-card" style={{ padding: '20px', marginBottom: '24px', borderLeft: `3px solid ${requestDetails.status === 'APPROVED' ? '#10b981' : '#ef4444'}` }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={18} color={requestDetails.status === 'APPROVED' ? '#34d399' : '#f87171'} />
                  <span>Review Decision Summary</span>
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', fontSize: '13px' }}>
                  <div>
                    <span style={{ color: '#94a3b8', fontSize: '11.5px', textTransform: 'uppercase', display: 'block', fontWeight: 700 }}>Reviewed By</span>
                    <strong style={{ color: '#ffffff' }}>{requestDetails.reviewerUser?.name || 'Administrator'}</strong>
                  </div>
                  {requestDetails.reviewedAt && (
                    <div>
                      <span style={{ color: '#94a3b8', fontSize: '11.5px', textTransform: 'uppercase', display: 'block', fontWeight: 700 }}>Decision Date</span>
                      <strong style={{ color: '#ffffff' }}>{new Date(requestDetails.reviewedAt).toLocaleString()}</strong>
                    </div>
                  )}
                  {requestDetails.reviewerComment && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <span style={{ color: '#94a3b8', fontSize: '11.5px', textTransform: 'uppercase', display: 'block', fontWeight: 700, marginBottom: '4px' }}>Admin Feedback / Comment</span>
                      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 14px', borderRadius: '8px', color: '#ffffff', border: '1px solid rgba(255,255,255,0.08)' }}>
                        {requestDetails.reviewerComment}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STAFFING SHORTAGE WARNING CALLOUT */}
            {hasShortage ? (
              <div className={styles.shortageWarning}>
                <AlertTriangle size={24} color="#f87171" style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 800, fontSize: '15px', color: '#ffffff' }}>
                    Critical Staffing Shortage Detected
                  </div>
                  <div style={{ fontSize: '13px', marginTop: '2px', color: 'rgba(255, 255, 255, 0.9)', lineHeight: 1.4 }}>
                    Approving this request will reduce available staff below the required minimum threshold for one or more scheduled shifts.
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: '16px 20px', borderRadius: '12px', backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', color: '#34d399', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <CheckCircle2 size={22} color="#34d399" style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 800, fontSize: '14.5px', color: '#ffffff' }}>
                    Optimal Staffing Coverage
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#cbd5e1', marginTop: '2px' }}>
                    All scheduled shifts meet or exceed minimum staffing requirements during this requested leave period.
                  </div>
                </div>
              </div>
            )}

            {/* LEAVE REQUEST RANGE SHIFTS GRAPH VISUALIZER */}
            {impactData && impactData.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <LeaveShiftsGraph
                  impactData={impactData}
                  startDate={requestDetails.startDate}
                  endDate={requestDetails.endDate}
                  daysCount={requestDetails.daysCount}
                  leaveType={requestDetails.leaveType}
                />
              </div>
            )}

            {/* STAFFING IMPACT ANALYSIS MATRIX & VISUAL COVERAGE GAUGES */}
            <div className={styles.impactCard}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={18} color="#818cf8" />
                  <span>Per-Shift Staffing Coverage &amp; Impact Analysis</span>
                </h2>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#34d399', fontWeight: 600 }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#34d399' }} /> Meets Minimum
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#f87171', fontWeight: 600 }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f87171' }} /> Below Minimum
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#94a3b8', fontWeight: 600 }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#64748b' }} /> Off Duty / Holiday
                  </span>
                </div>
              </div>

              {/* Desktop Table View */}
              <div className={styles.desktopOnlyImpact} style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                      <th style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Date</th>
                      <th style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Target Shift</th>
                      <th style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Scheduled</th>
                      <th style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>On Leave</th>
                      <th style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Available</th>
                      <th style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Min Req</th>
                      <th style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Coverage Meter</th>
                      <th style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {impactData.map((day: any, idx: number) => {
                      const isOffDuty = day.status === 'OFF_DUTY' || day.shiftName === 'Off Duty';
                      const isHoliday = day.status === 'HOLIDAY' || day.isHoliday;
                      const totalScheduled = day.totalScheduled ?? day.totalAssignedStaff ?? 0;
                      const onLeaveCount = day.onLeaveCount ?? day.alreadyOnLeaveStaff ?? 0;
                      const onLeaveWithThis = day.onLeaveWithThis ?? (onLeaveCount + 1);
                      const remainingStaff = day.remainingStaff ?? day.afterApprovalAvailable ?? 0;
                      const minRequired = day.minRequired ?? day.minimumStaffingThreshold ?? (isOffDuty || isHoliday ? 0 : 1);
                      const isShortage = !isOffDuty && !isHoliday && (day.isShortage ?? remainingStaff < minRequired);

                      // Calculate coverage bar percentage
                      const coveragePct = isOffDuty || isHoliday
                        ? 100
                        : minRequired > 0
                        ? Math.min(100, Math.round((remainingStaff / minRequired) * 100))
                        : 100;

                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: isShortage ? 'rgba(239, 68, 68, 0.04)' : undefined }}>
                          <td style={{ padding: '12px 14px', fontWeight: 700, color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
                            {day.date}
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px', fontWeight: 400 }}>
                              ({day.dayOfWeek?.slice(0, 3)})
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ fontWeight: 700, color: isOffDuty ? '#94a3b8' : isHoliday ? '#818cf8' : '#fbbf24' }}>
                              {day.shiftName || 'Default Shift'}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                              {day.shiftHours || '09:00 - 17:00'}
                            </div>
                          </td>
                          <td style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontWeight: 600 }}>{totalScheduled}</td>
                          <td style={{ padding: '12px 14px', color: '#fbbf24', fontWeight: 600 }}>{onLeaveWithThis}</td>
                          <td style={{ padding: '12px 14px', fontWeight: 800, color: isOffDuty || isHoliday ? '#94a3b8' : isShortage ? '#f87171' : '#34d399' }}>
                            {remainingStaff}
                          </td>
                          <td style={{ padding: '12px 14px', color: 'var(--text-muted)', fontWeight: 600 }}>{minRequired}</td>
                          <td style={{ padding: '12px 14px', minWidth: '140px' }}>
                            {isOffDuty ? (
                              <div style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>Off Duty</div>
                            ) : isHoliday ? (
                              <div style={{ fontSize: '11px', color: '#818cf8', fontStyle: 'italic' }}>Holiday</div>
                            ) : (
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', marginBottom: '3px', fontWeight: 700, color: isShortage ? '#f87171' : '#34d399' }}>
                                  <span>{coveragePct}% Covered</span>
                                  <span>{remainingStaff}/{minRequired}</span>
                                </div>
                                <div style={{ height: '6px', width: '100%', backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '9999px', overflow: 'hidden' }}>
                                  <div
                                    style={{
                                      height: '100%',
                                      width: `${coveragePct}%`,
                                      backgroundColor: isShortage ? '#ef4444' : '#10b981',
                                      borderRadius: '9999px',
                                      transition: 'width 0.3s ease',
                                    }}
                                  />
                                </div>
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            {isOffDuty ? (
                              <span className="badge badge-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                                🌙 Off Duty
                              </span>
                            ) : isHoliday ? (
                              <span className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                                🎉 Holiday
                              </span>
                            ) : isShortage ? (
                              <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                                <XCircle size={12} /> Below Minimum
                              </span>
                            ) : (
                              <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                                <CheckCircle2 size={12} /> Meets Minimum
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Staffing Cards View */}
              <div className={styles.mobileOnlyImpact} style={{ flexDirection: 'column', gap: '12px' }}>
                {impactData.map((day: any, idx: number) => {
                  const isOffDuty = day.status === 'OFF_DUTY' || day.shiftName === 'Off Duty';
                  const isHoliday = day.status === 'HOLIDAY' || day.isHoliday;
                  const totalScheduled = day.totalScheduled ?? day.totalAssignedStaff ?? 0;
                  const onLeaveCount = day.onLeaveCount ?? day.alreadyOnLeaveStaff ?? 0;
                  const onLeaveWithThis = day.onLeaveWithThis ?? (onLeaveCount + 1);
                  const remainingStaff = day.remainingStaff ?? day.afterApprovalAvailable ?? 0;
                  const minRequired = day.minRequired ?? day.minimumStaffingThreshold ?? (isOffDuty || isHoliday ? 0 : 1);
                  const isShortage = !isOffDuty && !isHoliday && (day.isShortage ?? remainingStaff < minRequired);
                  const coveragePct = isOffDuty || isHoliday ? 100 : minRequired > 0 ? Math.min(100, Math.round((remainingStaff / minRequired) * 100)) : 100;

                  return (
                    <div
                      key={idx}
                      style={{
                        padding: '14px',
                        borderRadius: '12px',
                        backgroundColor: isShortage ? 'rgba(239, 68, 68, 0.08)' : 'rgba(15, 23, 42, 0.65)',
                        border: `1px solid ${isShortage ? 'rgba(239, 68, 68, 0.35)' : 'rgba(255, 255, 255, 0.1)'}`,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div>
                          <strong style={{ fontSize: '14px', color: '#ffffff', fontFamily: 'var(--font-mono)' }}>{day.date}</strong>
                          <span style={{ fontSize: '11.5px', color: '#94a3b8', marginLeft: '6px' }}>({day.dayOfWeek})</span>
                        </div>
                        {isOffDuty ? (
                          <span className="badge badge-secondary" style={{ fontSize: '11px' }}>🌙 Off Duty</span>
                        ) : isHoliday ? (
                          <span className="badge badge-info" style={{ fontSize: '11px' }}>🎉 Holiday</span>
                        ) : isShortage ? (
                          <span className="badge badge-danger" style={{ fontSize: '11px' }}>🚨 Below Minimum</span>
                        ) : (
                          <span className="badge badge-success" style={{ fontSize: '11px' }}>✅ Meets Minimum</span>
                        )}
                      </div>

                      <div style={{ fontSize: '13px', fontWeight: 700, color: isOffDuty ? '#94a3b8' : isHoliday ? '#818cf8' : '#fbbf24', marginBottom: '10px' }}>
                        {day.shiftName} <span style={{ fontSize: '11.5px', color: '#94a3b8', fontWeight: 400 }}>({day.shiftHours})</span>
                      </div>

                      {!isOffDuty && !isHoliday && (
                        <div style={{ marginBottom: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, color: isShortage ? '#f87171' : '#34d399', marginBottom: '3px' }}>
                            <span>Staffing Coverage: {coveragePct}%</span>
                            <span>{remainingStaff} Available / {minRequired} Required</span>
                          </div>
                          <div style={{ height: '6px', width: '100%', backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '9999px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${coveragePct}%`, backgroundColor: isShortage ? '#ef4444' : '#10b981', borderRadius: '9999px' }} />
                          </div>
                        </div>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', fontSize: '11px', textTransform: 'uppercase', textAlign: 'center' }}>
                        <div style={{ background: 'rgba(255,255,255,0.04)', padding: '6px 4px', borderRadius: '6px' }}>
                          <div style={{ color: '#94a3b8', fontSize: '9.5px', fontWeight: 700 }}>Scheduled</div>
                          <div style={{ fontSize: '13px', fontWeight: 800, color: '#ffffff', marginTop: '2px' }}>{totalScheduled}</div>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.04)', padding: '6px 4px', borderRadius: '6px' }}>
                          <div style={{ color: '#94a3b8', fontSize: '9.5px', fontWeight: 700 }}>On Leave</div>
                          <div style={{ fontSize: '13px', fontWeight: 800, color: '#fbbf24', marginTop: '2px' }}>{onLeaveWithThis}</div>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.04)', padding: '6px 4px', borderRadius: '6px' }}>
                          <div style={{ color: '#94a3b8', fontSize: '9.5px', fontWeight: 700 }}>Available</div>
                          <div style={{ fontSize: '13px', fontWeight: 800, color: isShortage ? '#f87171' : '#34d399', marginTop: '2px' }}>{remainingStaff}</div>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.04)', padding: '6px 4px', borderRadius: '6px' }}>
                          <div style={{ color: '#94a3b8', fontSize: '9.5px', fontWeight: 700 }}>Min Required</div>
                          <div style={{ fontSize: '13px', fontWeight: 800, color: '#cbd5e1', marginTop: '2px' }}>{minRequired}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Document / Medical Certificate Attachment */}
            {(requestDetails.documentUrl || requestDetails.attachmentUrl || requestDetails.certificateUrl) && (
              <div className="glass-card" style={{ padding: '20px', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={16} color="#38bdf8" />
                  <span>Medical Certificate / Proof Document</span>
                </h2>
                <div
                  onClick={() => setShowDocModal(true)}
                  style={{ cursor: 'pointer', overflow: 'hidden', borderRadius: '10px', border: '1px solid var(--border-medium)', background: '#0d121f', position: 'relative' }}
                >
                  <img
                    src={requestDetails.documentUrl || requestDetails.attachmentUrl || requestDetails.certificateUrl}
                    alt="Leave Proof Attachment"
                    style={{ width: '100%', maxHeight: '220px', objectFit: 'cover', display: 'block' }}
                  />
                  <div style={{ position: 'absolute', bottom: '8px', right: '8px', backgroundColor: 'rgba(0,0,0,0.75)', color: '#ffffff', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Tap for Fullscreen
                  </div>
                </div>
              </div>
            )}

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
      </div>

      {/* FULLSCREEN ATTACHMENT MODAL */}
      {showDocModal && (
        <div
          onClick={() => setShowDocModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <img
              src={requestDetails?.documentUrl || requestDetails?.attachmentUrl || requestDetails?.certificateUrl}
              alt="Fullscreen Document Preview"
              style={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain', borderRadius: '8px' }}
            />
            <p style={{ color: '#ffffff', textAlign: 'center', fontSize: '12px', marginTop: '8px' }}>
              Tap anywhere to close
            </p>
          </div>
        </div>
      )}

      {/* APPROVAL DECISION MODAL WITH PARTIAL RANGE SELECTOR */}
      {showApproveModal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 999999, backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '500px', padding: '24px', backgroundColor: '#0d121f' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={20} color="#34d399" />
              <span>Approve Leave Request</span>
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 20px 0' }}>
              Approve full requested duration or select a specific partial date range for {requestDetails?.staff?.name}.
            </p>

            {/* Scope Switcher */}
            <div style={{ marginBottom: '20px' }}>
              <label className="form-label" style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', marginBottom: '8px', display: 'block' }}>Approval Scope</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setApproveMode('FULL')}
                  className={`btn ${approveMode === 'FULL' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '10px', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <CheckCircle2 size={14} />
                  <span>Full Request ({requestDetails?.daysCount} Days)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setApproveMode('PARTIAL')}
                  className={`btn ${approveMode === 'PARTIAL' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '10px', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <Calendar size={14} />
                  <span>Specific Date Range</span>
                </button>
              </div>
            </div>

            {/* Partial Date Range Pickers */}
            {approveMode === 'PARTIAL' && (
              <div style={{ marginBottom: '20px', padding: '14px', borderRadius: '10px', backgroundColor: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.25)' }}>
                <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#818cf8', textTransform: 'uppercase', marginBottom: '10px' }}>
                  Select Approved Date Range (Within Request Bounds)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '8px' }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '11.5px' }}>Approved Start *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={approvedStartDate}
                      min={requestDetails?.startDate ? new Date(requestDetails.startDate).toISOString().split('T')[0] : undefined}
                      max={requestDetails?.endDate ? new Date(requestDetails.endDate).toISOString().split('T')[0] : undefined}
                      onChange={(e) => setApprovedStartDate(e.target.value)}
                      style={{ width: '100%', fontSize: '12.5px', backgroundColor: '#0f172a', colorScheme: 'dark' }}
                    />
                  </div>

                  <div>
                    <label className="form-label" style={{ fontSize: '11.5px' }}>Approved End *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={approvedEndDate}
                      min={requestDetails?.startDate ? new Date(requestDetails.startDate).toISOString().split('T')[0] : undefined}
                      max={requestDetails?.endDate ? new Date(requestDetails.endDate).toISOString().split('T')[0] : undefined}
                      onChange={(e) => setApprovedEndDate(e.target.value)}
                      style={{ width: '100%', fontSize: '12.5px', backgroundColor: '#0f172a', colorScheme: 'dark' }}
                    />
                  </div>
                </div>

                <div style={{ fontSize: '11.5px', color: '#cbd5e1', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                  Approved Days: {(() => {
                    if (!approvedStartDate || !approvedEndDate) return 0;
                    const s = new Date(`${approvedStartDate}T00:00:00Z`);
                    const e = new Date(`${approvedEndDate}T00:00:00Z`);
                    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return 0;
                    return Math.floor((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                  })()} Days
                </div>
              </div>
            )}

            {/* Optional Comment */}
            <div style={{ marginBottom: '20px' }}>
              <label className="form-label" style={{ fontSize: '12px' }}>Admin Decision Note / Feedback to Staff</label>
              <textarea
                className="form-input"
                style={{ width: '100%', height: '70px', fontSize: '13px' }}
                placeholder="Optional feedback for employee (e.g. approved 2 out of 4 days due to coverage)..."
                value={approveComment}
                onChange={(e) => setApproveComment(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setShowApproveModal(false)} className="btn btn-secondary btn-sm">
                Cancel
              </button>
              <button onClick={handleApprove} disabled={processing} className="btn btn-primary btn-sm">
                {processing ? 'Approving...' : approveMode === 'PARTIAL' ? 'Confirm Partial Approval' : 'Confirm Full Approval'}
              </button>
            </div>
          </div>
        </div>
      )}

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
