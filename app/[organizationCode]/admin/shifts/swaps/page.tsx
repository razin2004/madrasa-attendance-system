'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  Search,
  User,
  ArrowRight,
  Check,
  X,
  Loader2,
  ShieldCheck,
  Filter,
  Users,
} from 'lucide-react';
import { OrgAdminSidebar } from '@/components/layout/org-admin-sidebar';
import { OrgAdminMobileNav } from '@/components/layout/org-admin-mobile-nav';
import { useToast } from '@/components/feedback/toast-provider';
import styles from './ShiftSwapsAdmin.module.css';

interface SwapRequest {
  id: string;
  targetDate: string;
  shiftPatternName?: string | null;
  reason: string | null;
  status: 'PENDING_PEER' | 'PEER_ACCEPTED' | 'PEER_REJECTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  peerRespondedAt: string | null;
  adminReviewedAt: string | null;
  adminNote: string | null;
  createdAt: string;
  requester: {
    id: string;
    staffId: string;
    name: string;
    phone: string | null;
    user: { email: string };
    branchAssignments?: { branch: { name: string } }[];
  };
  peer: {
    id: string;
    staffId: string;
    name: string;
    phone: string | null;
    user: { email: string };
    branchAssignments?: { branch: { name: string } }[];
  } | null;
  recipients?: Array<{
    id: string;
    peer: { id: string; name: string; staffId: string };
    status: string;
  }>;
}

interface OrgBranding {
  id: string;
  name: string;
  logoUrl: string | null;
  organizationCode: string;
}

export default function ShiftSwapsAdminPage() {
  const params = useParams();
  const organizationCode = (params.organizationCode as string)?.toUpperCase() || '';
  const router = useRouter();
  const toast = useToast();

  const [branding, setBranding] = useState<OrgBranding | null>(null);
  const [swapRequests, setSwapRequests] = useState<SwapRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('PEER_ACCEPTED');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal Review State
  const [selectedSwap, setSelectedSwap] = useState<SwapRequest | null>(null);
  const [reviewAction, setReviewAction] = useState<'APPROVE' | 'REJECT' | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const brandRes = await fetch(`/api/org/${organizationCode}/branding`);
      const brandData = await brandRes.json();
      if (brandData.success) {
        setBranding(brandData.organization);
      }

      const res = await fetch(`/api/org/${organizationCode}/admin/swaps`);
      const data = await res.json();

      if (res.ok && data.success) {
        setSwapRequests(data.swapRequests || []);
      } else {
        toast.error(data.error || 'Failed to fetch shift swap requests.');
      }
    } catch {
      toast.error('Network error fetching shift swaps.');
    } finally {
      setLoading(false);
    }
  }, [organizationCode, toast]);

  useEffect(() => {
    if (organizationCode) {
      fetchData();
    }
  }, [organizationCode, fetchData]);

  const handleReview = async () => {
    if (!selectedSwap || !reviewAction) return;
    setIsProcessing(true);

    try {
      const res = await fetch(`/api/org/${organizationCode}/admin/swaps/${selectedSwap.id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: reviewAction,
          adminNote: adminNote.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        toast.success(data.message || 'Shift swap review completed.');
        closeModal();
        fetchData();
      } else {
        toast.error(data.error || 'Failed to complete review.');
      }
    } catch {
      toast.error('Network error during review.');
    } finally {
      setIsProcessing(false);
    }
  };

  const closeModal = () => {
    setSelectedSwap(null);
    setReviewAction(null);
    setAdminNote('');
    setIsProcessing(false);
  };

  // Filtered swap requests
  const filteredSwaps = swapRequests.filter((item) => {
    const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
    const q = searchQuery.toLowerCase().trim();
    const peerMatch = item.peer
      ? item.peer.name.toLowerCase().includes(q) || item.peer.staffId.toLowerCase().includes(q)
      : false;

    const matchesSearch =
      !q ||
      item.requester.name.toLowerCase().includes(q) ||
      item.requester.staffId.toLowerCase().includes(q) ||
      peerMatch;

    return matchesStatus && matchesSearch;
  });

  const pendingAdminCount = swapRequests.filter((s) => s.status === 'PEER_ACCEPTED').length;

  return (
    <div className={styles.container}>
      <OrgAdminSidebar
        organizationCode={organizationCode}
        organizationName={branding?.name || 'Organization'}
        logoUrl={branding?.logoUrl}
      />

      <div className={styles.mainContent}>
        {/* Header Bar */}
        <header className={styles.headerBar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link href={`/${organizationCode}/admin/shifts`} className="btn btn-secondary btn-sm" style={{ padding: '8px' }}>
              <ArrowLeft size={16} />
            </Link>
            <div>
              <h1 className={styles.title}>Shift Swapping &amp; Substitutions</h1>
              <p className={styles.subtitle}>
                Review 2-step peer shift swap requests and manage colleague schedule substitutions.
              </p>
            </div>
          </div>

          <button onClick={fetchData} disabled={loading} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </header>

        <main className="pageMainContent" style={{ padding: '24px' }}>
          {/* Action Needed Banner */}
          {pendingAdminCount > 0 && (
            <div
              style={{
                marginBottom: '24px',
                padding: '16px 20px',
                borderRadius: '14px',
                backgroundColor: 'rgba(99, 102, 241, 0.12)',
                border: '1px solid rgba(99, 102, 241, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: '#818cf8',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Clock size={22} color="#818cf8" />
                <div>
                  <strong style={{ color: '#ffffff', fontSize: '14.5px' }}>
                    {pendingAdminCount} {pendingAdminCount === 1 ? 'Shift Swap' : 'Shift Swaps'} Awaiting Org Admin Approval
                  </strong>
                  <div style={{ fontSize: '12.5px', color: '#c7d2fe', marginTop: '2px' }}>
                    Peers have accepted these swap requests. Approving will automatically update target shift schedules.
                  </div>
                </div>
              </div>
              <button
                onClick={() => setStatusFilter('PEER_ACCEPTED')}
                className="btn btn-primary btn-sm"
                style={{ fontWeight: 700, whiteSpace: 'nowrap' }}
              >
                Review Pending Swaps ({pendingAdminCount})
              </button>
            </div>
          )}

          {/* Filter Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[
                { id: 'PEER_ACCEPTED', label: `Action Needed (${pendingAdminCount})` },
                { id: 'PENDING_PEER', label: 'Pending Peer Response' },
                { id: 'APPROVED', label: 'Approved Swaps' },
                { id: 'REJECTED', label: 'Rejected' },
                { id: 'ALL', label: 'All History' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setStatusFilter(t.id)}
                  className={`btn btn-sm ${statusFilter === t.id ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ borderRadius: '8px', fontSize: '12.5px' }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div style={{ position: 'relative', width: '260px' }}>
              <input
                type="text"
                placeholder="Search staff name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input"
                style={{ width: '100%', paddingLeft: '36px', fontSize: '13px' }}
              />
              <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '11px' }} />
            </div>
          </div>

          {/* Swap Requests Cards / List */}
          {loading ? (
            <div className="glass-card" style={{ padding: '48px', textAlign: 'center' }}>
              <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 12px auto', color: '#818cf8' }} />
              <p style={{ color: 'var(--text-secondary)' }}>Loading shift swap requests...</p>
            </div>
          ) : filteredSwaps.length === 0 ? (
            <div className="glass-card" style={{ padding: '60px 24px', textAlign: 'center' }}>
              <CheckCircle2 size={32} color="#34d399" style={{ margin: '0 auto 12px auto' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>No Shift Swap Requests Found</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                There are no shift swap records matching the selected status filter.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {filteredSwaps.map((item) => {
                const targetDateFormatted = new Date(item.targetDate).toLocaleDateString(undefined, {
                  weekday: 'short',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                });

                return (
                  <div
                    key={item.id}
                    className="glass-card"
                    style={{
                      padding: '20px',
                      borderRadius: '14px',
                      border:
                        item.status === 'PEER_ACCEPTED'
                          ? '1px solid rgba(99, 102, 241, 0.4)'
                          : '1px solid var(--border-subtle)',
                      backgroundColor:
                        item.status === 'PEER_ACCEPTED' ? 'rgba(99, 102, 241, 0.04)' : 'rgba(13, 18, 31, 0.8)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Calendar size={18} color="#38bdf8" />
                        <div>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Target Shift Date</span>
                          <div style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff' }}>
                            {targetDateFormatted}
                            {item.shiftPatternName && (
                              <span style={{ fontSize: '12.5px', color: '#a5b4fc', marginLeft: '8px', fontWeight: 600 }}>
                                ({item.shiftPatternName})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <span
                        className={`badge ${
                          item.status === 'APPROVED'
                            ? 'badge-active'
                            : item.status === 'PEER_ACCEPTED'
                            ? 'badge-pending'
                            : item.status === 'PENDING_PEER'
                            ? 'badge-info'
                            : 'badge-rejected'
                        }`}
                        style={{ fontSize: '11.5px', padding: '4px 10px' }}
                      >
                        {item.status === 'PEER_ACCEPTED'
                          ? 'ACTION NEEDED (PEER ACCEPTED)'
                          : item.status === 'PENDING_PEER'
                          ? 'AWAITING PEER ACCEPTANCE'
                          : item.status}
                      </span>
                    </div>

                    {/* Swap Participant Flow (Requester ➔ Peer) */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                        gap: '16px',
                        padding: '16px',
                        borderRadius: '10px',
                        backgroundColor: 'rgba(255,255,255,0.02)',
                        border: '1px solid var(--border-subtle)',
                        marginBottom: '16px',
                      }}
                    >
                      {/* Requester */}
                      <div>
                        <div style={{ fontSize: '11px', color: '#818cf8', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
                          Requester (Original Shift Holder)
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>{item.requester.name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          ID: <span style={{ fontFamily: 'var(--font-mono)' }}>{item.requester.staffId}</span> | {item.requester.user.email}
                        </div>
                        {item.requester.branchAssignments?.[0] && (
                          <div style={{ fontSize: '11.5px', color: '#38bdf8', marginTop: '3px' }}>
                            Branch: {item.requester.branchAssignments[0].branch.name}
                          </div>
                        )}
                      </div>

                      {/* Arrow / Swap Icon */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ padding: '8px 14px', borderRadius: '20px', backgroundColor: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>Swapping with</span>
                          <ArrowRight size={14} />
                        </div>
                      </div>

                      {/* Peer */}
                      <div>
                        <div style={{ fontSize: '11px', color: '#34d399', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
                          Substitute Colleague (Peer)
                        </div>
                        {item.peer ? (
                          <>
                            <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>{item.peer.name}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                              ID: <span style={{ fontFamily: 'var(--font-mono)' }}>{item.peer.staffId}</span> | {item.peer.user.email}
                            </div>
                            {item.peer.branchAssignments?.[0] && (
                              <div style={{ fontSize: '11.5px', color: '#38bdf8', marginTop: '3px' }}>
                                Branch: {item.peer.branchAssignments[0].branch.name}
                              </div>
                            )}
                          </>
                        ) : (
                          <div style={{ fontSize: '13px', color: '#fbbf24', fontStyle: 'italic' }}>
                            Broadcast to {item.recipients?.length || 0} Colleagues (Pending First Acceptance)
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Swap Reason Note */}
                    {item.reason && (
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', padding: '8px 12px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                        <strong>Reason:</strong> {item.reason}
                      </div>
                    )}

                    {/* Admin Note if already reviewed */}
                    {item.adminNote && (
                      <div style={{ fontSize: '12.5px', color: '#c7d2fe', marginBottom: '16px', padding: '8px 12px', backgroundColor: 'rgba(99, 102, 241, 0.1)', borderRadius: '6px' }}>
                        <strong>Admin Note:</strong> {item.adminNote}
                      </div>
                    )}

                    {/* Actions Bar for Admin */}
                    {item.status === 'PEER_ACCEPTED' && item.peer && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
                        <button
                          onClick={() => {
                            setSelectedSwap(item);
                            setReviewAction('REJECT');
                          }}
                          className="btn btn-danger btn-sm"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        >
                          <X size={14} />
                          <span>Reject Swap</span>
                        </button>

                        <button
                          onClick={() => {
                            setSelectedSwap(item);
                            setReviewAction('APPROVE');
                          }}
                          className="btn btn-success btn-sm"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
                        >
                          <Check size={14} />
                          <span>Approve &amp; Swap Shift</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      <OrgAdminMobileNav organizationCode={organizationCode} />

      {/* REVIEW CONFIRMATION MODAL */}
      {selectedSwap && reviewAction && selectedSwap.peer && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content glass-card" onClick={(e) => e.stopPropagation()} style={{ padding: '28px', maxWidth: '480px', width: '100%', borderRadius: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldCheck size={22} color={reviewAction === 'APPROVE' ? '#34d399' : '#f87171'} />
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                  {reviewAction === 'APPROVE' ? 'Approve Shift Swap?' : 'Reject Shift Swap?'}
                </h3>
              </div>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '16px' }}>
              {reviewAction === 'APPROVE'
                ? `Approving will reassign the shift on ${new Date(selectedSwap.targetDate).toLocaleDateString()} between ${selectedSwap.requester.name} and ${selectedSwap.peer.name}.`
                : `Are you sure you want to reject this shift swap request?`}
            </p>

            <div style={{ marginBottom: '20px' }}>
              <label className="form-label" style={{ fontSize: '12.5px', fontWeight: 600, color: '#ffffff' }}>
                Admin Review Note (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="Add optional note for staff..."
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                disabled={isProcessing}
                className="form-input"
                style={{ width: '100%', marginTop: '6px', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={closeModal} disabled={isProcessing} className="btn btn-secondary btn-sm">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReview}
                disabled={isProcessing}
                className={`btn ${reviewAction === 'APPROVE' ? 'btn-success' : 'btn-danger'} btn-sm`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
              >
                {isProcessing ? <Loader2 size={14} className="animate-spin" /> : reviewAction === 'APPROVE' ? <Check size={14} /> : <X size={14} />}
                <span>{isProcessing ? 'Processing...' : reviewAction === 'APPROVE' ? 'Confirm Approval' : 'Confirm Rejection'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
