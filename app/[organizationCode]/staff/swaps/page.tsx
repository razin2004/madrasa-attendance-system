'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  RefreshCw,
  User,
  Plus,
  ArrowRight,
  Check,
  X,
  Loader2,
  Users,
  Send,
  ShieldCheck,
  Search,
  Filter,
} from 'lucide-react';
import { useToast } from '@/components/feedback/toast-provider';
import styles from './ShiftSwapsStaff.module.css';

interface ShiftSwapRecipient {
  id: string;
  peerId: string;
  status: string;
  peer: {
    id: string;
    staffId: string;
    name: string;
    user: { email: string };
  };
}

interface OutgoingRequest {
  id: string;
  targetDate: string;
  shiftPatternName: string | null;
  reason: string | null;
  status: 'PENDING_PEER' | 'PEER_ACCEPTED' | 'PEER_REJECTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  createdAt: string;
  peer: {
    id: string;
    staffId: string;
    name: string;
    phone: string | null;
    user: { email: string };
  } | null;
  recipients?: ShiftSwapRecipient[];
}

interface IncomingRequest {
  id: string;
  targetDate: string;
  shiftPatternName: string | null;
  reason: string | null;
  status: 'PENDING_PEER' | 'PEER_ACCEPTED' | 'PEER_REJECTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  createdAt: string;
  requester: {
    id: string;
    staffId: string;
    name: string;
    phone: string | null;
    user: { email: string };
  };
  peer: {
    id: string;
    name: string;
  } | null;
  recipients?: ShiftSwapRecipient[];
}

export default function StaffShiftSwapsPage() {
  const params = useParams();
  const organizationCode = (params.organizationCode as string)?.toUpperCase() || '';
  const router = useRouter();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [currentStaff, setCurrentStaff] = useState<any>(null);

  const [outgoingRequests, setOutgoingRequests] = useState<OutgoingRequest[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'INCOMING' | 'OUTGOING'>('INCOMING');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showMobileFilters, setShowMobileFilters] = useState<boolean>(false);

  // Peer Respond Loading State
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/org/${organizationCode}/staff/swaps`);
      const data = await res.json();

      if (res.ok && data.success) {
        setCurrentStaff(data.currentStaff);
        setOutgoingRequests(data.outgoingRequests || []);
        setIncomingRequests(data.incomingRequests || []);
      } else {
        toast.error(data.error || 'Failed to load shift swaps.');
      }
    } catch {
      toast.error('Network error loading shift swaps.');
    } finally {
      setLoading(false);
    }
  }, [organizationCode, toast]);

  useEffect(() => {
    if (organizationCode) {
      fetchData();
    }
  }, [organizationCode, fetchData]);

  const handlePeerRespond = async (swapId: string, action: 'ACCEPT' | 'REJECT') => {
    try {
      setRespondingId(swapId);
      const res = await fetch(`/api/org/${organizationCode}/staff/swaps/${swapId}/peer-respond`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || 'Response submitted successfully!');
        fetchData();
      } else {
        toast.error(data.error || 'Failed to submit response.');
      }
    } catch {
      toast.error('Network error processing response.');
    } finally {
      setRespondingId(null);
    }
  };

  const pendingIncomingCount = incomingRequests.filter(
    (r) =>
      r.status === 'PENDING_PEER' &&
      (!r.peer || r.peer.id === currentStaff?.id)
  ).length;

  const filterRequest = (r: any) => {
    const matchesStatus = statusFilter === 'ALL' ? true : r.status === statusFilter;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return matchesStatus;
    const matchesQuery =
      (r.reason && r.reason.toLowerCase().includes(q)) ||
      (r.shiftPatternName && r.shiftPatternName.toLowerCase().includes(q)) ||
      (r.targetDate && r.targetDate.toLowerCase().includes(q)) ||
      (r.requester?.name && r.requester.name.toLowerCase().includes(q)) ||
      (r.peer?.name && r.peer.name.toLowerCase().includes(q));
    return matchesStatus && matchesQuery;
  };

  const filteredIncoming = incomingRequests.filter(filterRequest);
  const filteredOutgoing = outgoingRequests.filter(filterRequest);

  return (
    <div className={styles.container} style={{ padding: '16px', maxWidth: '920px', margin: '0 auto' }}>
      {/* Top Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
            Shift Swapping &amp; Substitute Requests
          </h1>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0 0' }}>
            Request colleagues for shift coverage with first-come peer acceptance &amp; 1-click admin approval.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', width: '100%', maxWidth: '400px' }}>
          <Link
            href={`/${organizationCode}/staff/swaps/new`}
            className={`btn btn-primary btn-sm ${styles.desktopOnlyAction}`}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: 800, padding: '10px 16px', borderRadius: '10px', flex: 1 }}
          >
            <Plus size={16} />
            <span>Apply for Shift Swap</span>
          </Link>

          <button onClick={fetchData} disabled={loading} className="btn btn-secondary btn-sm" style={{ padding: '10px' }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>


      {/* Incoming Notification Banner */}
      {pendingIncomingCount > 0 && (
        <div
          style={{
            marginBottom: '20px',
            padding: '16px 20px',
            borderRadius: '14px',
            backgroundColor: 'rgba(56, 189, 248, 0.12)',
            border: '1px solid rgba(56, 189, 248, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: '#38bdf8',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Clock size={22} color="#38bdf8" />
            <div>
              <strong style={{ color: '#ffffff', fontSize: '14.5px' }}>
                {pendingIncomingCount} Incoming Shift Swap Invitation{pendingIncomingCount > 1 ? 's' : ''}
              </strong>
              <div style={{ fontSize: '12.5px', color: '#bae6fd', marginTop: '2px' }}>
                A colleague has requested shift coverage. First colleague to accept secures the swap.
              </div>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('INCOMING')}
            className="btn btn-primary btn-sm"
            style={{ fontSize: '12px', fontWeight: 700 }}
          >
            View Invites ({pendingIncomingCount})
          </button>
        </div>
      )}

      {/* Search & Filter Header Bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              type="text"
              placeholder="Search by colleague name, shift, or reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 36px 9px 36px',
                borderRadius: '10px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#ffffff',
                fontSize: '13px',
                outline: 'none',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 14px', borderRadius: '10px' }}
          >
            <Filter size={15} />
            <span>Filter</span>
            {statusFilter !== 'ALL' && (
              <span style={{ backgroundColor: '#818cf8', color: '#ffffff', fontSize: '10px', fontWeight: 800, padding: '1px 6px', borderRadius: '10px' }}>
                1
              </span>
            )}
          </button>
        </div>

        {/* Navigation Tabs (Incoming vs Outgoing) */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
          <button
            onClick={() => setActiveTab('INCOMING')}
            className={`btn btn-sm ${activeTab === 'INCOMING' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', borderRadius: '8px', fontSize: '13px' }}
          >
            <Users size={14} />
            <span>Incoming Invites ({incomingRequests.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('OUTGOING')}
            className={`btn btn-sm ${activeTab === 'OUTGOING' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', borderRadius: '8px', fontSize: '13px' }}
          >
            <Send size={14} />
            <span>My Sent Requests ({outgoingRequests.length})</span>
          </button>
        </div>

        {/* Status Filter Tabs Drawer */}
        {(showMobileFilters || statusFilter !== 'ALL') && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {['ALL', 'PENDING_PEER', 'PEER_ACCEPTED', 'APPROVED', 'REJECTED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`btn btn-xs ${statusFilter === st ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '5px 12px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 600 }}
              >
                {st}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="glass-card" style={{ padding: '48px', textAlign: 'center' }}>
          <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 12px auto', color: '#818cf8' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Loading shift swaps...</p>
        </div>
      ) : (
        <>
          {/* TAB 1: INCOMING REQUESTS */}
          {activeTab === 'INCOMING' && (
            <div>
              {filteredIncoming.length === 0 ? (
                <div className="glass-card" style={{ padding: '48px 24px', textAlign: 'center' }}>
                  <CheckCircle2 size={32} color="#34d399" style={{ margin: '0 auto 12px auto' }} />
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>No Incoming Swap Invites Found</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    No incoming shift swap requests match your search filter.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {filteredIncoming.map((req) => {
                    const targetDateFormatted = new Date(req.targetDate).toLocaleDateString(undefined, {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    });
                    const isResponding = respondingId === req.id;
                    const isBroadCast = (req.recipients?.length || 0) > 1;

                    // Check if accepted by someone else
                    const acceptedByOther =
                      req.status === 'PEER_ACCEPTED' &&
                      req.peer &&
                      req.peer.id !== currentStaff?.id;

                    // Check current staff recipient status
                    const myRecipientStatus = req.recipients?.find(
                      (r) => r.peerId === currentStaff?.id
                    )?.status;

                    return (
                      <div
                        key={req.id}
                        className="glass-card"
                        style={{
                          padding: '20px',
                          borderRadius: '14px',
                          border:
                            req.status === 'PENDING_PEER' && !acceptedByOther
                              ? '1px solid rgba(56, 189, 248, 0.4)'
                              : '1px solid var(--border-subtle)',
                          backgroundColor:
                            req.status === 'PENDING_PEER' && !acceptedByOther
                              ? 'rgba(56, 189, 248, 0.04)'
                              : 'rgba(13, 18, 31, 0.8)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
                              <User size={18} />
                            </div>
                            <div>
                              <div style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff' }}>{req.requester.name}</div>
                              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                                Staff ID: <span style={{ fontFamily: 'var(--font-mono)' }}>{req.requester.staffId}</span> | {req.requester.user.email}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {isBroadCast && (
                              <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '12px', backgroundColor: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', fontWeight: 700 }}>
                                Broadcast to {req.recipients?.length} Colleagues
                              </span>
                            )}
                            <span
                              className={`badge ${
                                req.status === 'APPROVED'
                                  ? 'badge-active'
                                  : acceptedByOther
                                  ? 'badge-rejected'
                                  : req.status === 'PENDING_PEER'
                                  ? 'badge-pending'
                                  : 'badge-info'
                              }`}
                            >
                              {acceptedByOther
                                ? `ACCEPTED BY ${req.peer?.name.toUpperCase()}`
                                : req.status === 'PENDING_PEER'
                                ? 'ACTION NEEDED (ACCEPT / DECLINE)'
                                : req.status}
                            </span>
                          </div>
                        </div>

                        {/* Side-by-Side Shift Comparison Mini-Boxes */}
                        <div className={styles.swapComparisonGrid}>
                          <div className={styles.swapMiniBox}>
                            <div className={styles.swapMiniBoxTitle}>Colleague's Shift</div>
                            <div className={styles.swapMiniBoxValue}>{targetDateFormatted}</div>
                            <div style={{ fontSize: '11px', color: '#a5b4fc', marginTop: '2px' }}>{req.shiftPatternName || 'Scheduled Shift'}</div>
                          </div>
                          <div className={styles.swapMiniBox}>
                            <div className={styles.swapMiniBoxTitle}>My Assigned Shift</div>
                            <div className={styles.swapMiniBoxValue}>{targetDateFormatted}</div>
                            <div style={{ fontSize: '11px', color: '#34d399', marginTop: '2px' }}>Offered for Swap</div>
                          </div>
                        </div>

                        {req.reason && (
                          <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '16px', padding: '8px 12px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                            <strong>Reason Note:</strong> {req.reason}
                          </div>
                        )}

                        {acceptedByOther && (
                          <div style={{ fontSize: '12px', color: '#fbbf24', fontStyle: 'italic', marginBottom: '12px' }}>
                            This shift request was accepted by {req.peer?.name} and is locked awaiting Org Admin approval.
                          </div>
                        )}

                        {/* Response Actions */}
                        {req.status === 'PENDING_PEER' && !acceptedByOther && myRecipientStatus !== 'REJECTED' && (
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
                            <button
                              onClick={() => handlePeerRespond(req.id, 'REJECT')}
                              disabled={isResponding}
                              className="btn btn-secondary btn-sm"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            >
                              <X size={14} />
                              <span>Decline Swap</span>
                            </button>

                            <button
                              onClick={() => handlePeerRespond(req.id, 'ACCEPT')}
                              disabled={isResponding}
                              className="btn btn-primary btn-sm"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
                            >
                              {isResponding ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                              <span>Accept Shift Swap</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: OUTGOING REQUESTS */}
          {activeTab === 'OUTGOING' && (
            <div>
              {filteredOutgoing.length === 0 ? (
                <div className="glass-card" style={{ padding: '48px 24px', textAlign: 'center' }}>
                  <Calendar size={32} color="var(--text-muted)" style={{ margin: '0 auto 12px auto' }} />
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>No Outgoing Swap Requests Found</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', marginBottom: '16px' }}>
                    No outgoing shift swap requests match your search filter.
                  </p>
                  <Link href={`/${organizationCode}/staff/swaps/new`} className="btn btn-primary btn-sm">
                    + Apply for Shift Swap
                  </Link>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {filteredOutgoing.map((req) => {
                    const targetDateFormatted = new Date(req.targetDate).toLocaleDateString(undefined, {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    });

                    const recipientCount = req.recipients?.length || 0;
                    const acceptedRecipient = req.recipients?.find((r) => r.status === 'ACCEPTED');

                    return (
                      <div key={req.id} className="glass-card" style={{ padding: '20px', borderRadius: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
                          <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                              Target Shift &amp; Recipients
                            </div>
                            <div style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff' }}>
                              {req.peer
                                ? `Direct Request to ${req.peer.name}`
                                : acceptedRecipient
                                ? `Accepted by ${acceptedRecipient.peer.name}`
                                : `Broadcast Sent to ${recipientCount} Colleagues`}
                            </div>
                          </div>

                          <span
                            className={`badge ${
                              req.status === 'APPROVED'
                                ? 'badge-active'
                                : req.status === 'PEER_ACCEPTED'
                                ? 'badge-pending'
                                : req.status === 'PENDING_PEER'
                                ? 'badge-info'
                                : 'badge-rejected'
                            }`}
                          >
                            {req.status === 'PENDING_PEER'
                              ? `AWAITING PEER ACCEPTANCE (${recipientCount} INVITED)`
                              : req.status === 'PEER_ACCEPTED'
                              ? 'PEER ACCEPTED (AWAITING ADMIN)'
                              : req.status}
                          </span>
                        </div>

                        {/* Side-by-Side Shift Comparison Mini-Boxes */}
                        <div className={styles.swapComparisonGrid}>
                          <div className={styles.swapMiniBox}>
                            <div className={styles.swapMiniBoxTitle}>My Current Shift</div>
                            <div className={styles.swapMiniBoxValue}>{targetDateFormatted}</div>
                            <div style={{ fontSize: '11px', color: '#38bdf8', marginTop: '2px' }}>{req.shiftPatternName || 'Scheduled Shift'}</div>
                          </div>
                          <div className={styles.swapMiniBox}>
                            <div className={styles.swapMiniBoxTitle}>Target Cover Shift</div>
                            <div className={styles.swapMiniBoxValue}>{targetDateFormatted}</div>
                            <div style={{ fontSize: '11px', color: '#c084fc', marginTop: '2px' }}>Requested Coverage</div>
                          </div>
                        </div>

                        {/* Recipients List Pills */}
                        {req.recipients && req.recipients.length > 0 && (
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                            {req.recipients.map((r) => (
                              <span
                                key={r.id}
                                style={{
                                  fontSize: '11px',
                                  padding: '3px 8px',
                                  borderRadius: '12px',
                                  backgroundColor:
                                    r.status === 'ACCEPTED'
                                      ? 'rgba(52, 211, 153, 0.2)'
                                      : r.status === 'REJECTED'
                                      ? 'rgba(244, 63, 94, 0.2)'
                                      : 'rgba(255,255,255,0.05)',
                                  color:
                                    r.status === 'ACCEPTED'
                                      ? '#34d399'
                                      : r.status === 'REJECTED'
                                      ? '#f43f5e'
                                      : 'var(--text-muted)',
                                  border: '1px solid var(--border-subtle)',
                                }}
                              >
                                {r.peer.name}: {r.status}
                              </span>
                            ))}
                          </div>
                        )}

                        {req.reason && (
                          <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                            <strong>Reason Note:</strong> {req.reason}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
