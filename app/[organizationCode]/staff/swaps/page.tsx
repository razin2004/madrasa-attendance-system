'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Calendar,
  Clock,
  CheckCircle2,
  Plus,
  Check,
  X,
  Loader2,
  Users,
  Send,
  Search,
  Filter,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useToast } from '@/components/feedback/toast-provider';
import { StaffAvatar } from '@/components/ui/staff-avatar';
import styles from './ShiftSwapsStaff.module.css';

interface ShiftSwapRecipient {
  id: string;
  peerId: string;
  status: string;
  peer: {
    id: string;
    staffId: string;
    name: string;
    avatarUrl?: string | null;
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
    avatarUrl?: string | null;
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
    avatarUrl?: string | null;
    user: { email: string };
  };
  peer: {
    id: string;
    name: string;
    avatarUrl?: string | null;
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

  // Status Filter Options with Badges
  const filterOptions = [
    { id: 'ALL', label: 'All Statuses' },
    { id: 'PENDING_PEER', label: 'Pending Peer' },
    { id: 'PEER_ACCEPTED', label: 'Peer Accepted' },
    { id: 'APPROVED', label: 'Approved' },
    { id: 'REJECTED', label: 'Rejected' },
  ];

  return (
    <div className={styles.pageContainer}>
      {/* Top Header Section */}
      <div className={styles.headerSection}>
        <div className={styles.headerTitleGroup}>
          <h1 className={styles.pageTitle}>
            <Sparkles size={22} color="#818cf8" />
            <span>Shift Swapping &amp; Coverage</span>
          </h1>
          <p className={styles.pageSubtitle}>
            Request colleagues for shift coverage with first-come peer acceptance &amp; 1-click admin approval.
          </p>
        </div>

        <div className={styles.headerActionGroup}>
          <Link
            href={`/${organizationCode}/staff/swaps/new`}
            className={styles.primaryActionBtn}
          >
            <Plus size={16} />
            <span>Apply for Shift Swap</span>
          </Link>
        </div>
      </div>

      {/* Incoming Notification Banner */}
      {pendingIncomingCount > 0 && (
        <div className={styles.bannerAlert}>
          <div className={styles.bannerTextGroup}>
            <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(56, 189, 248, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
              <Clock size={22} />
            </div>
            <div>
              <div className={styles.bannerTitle}>
                {pendingIncomingCount} Incoming Shift Swap Invitation{pendingIncomingCount > 1 ? 's' : ''}
              </div>
              <div className={styles.bannerSubtitle}>
                A colleague has requested shift coverage. First colleague to accept secures the swap.
              </div>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('INCOMING')}
            className="btn btn-primary btn-sm"
            style={{ fontSize: '12.5px', fontWeight: 700, borderRadius: '10px', padding: '8px 14px' }}
          >
            View Invites ({pendingIncomingCount})
          </button>
        </div>
      )}

      {/* Controls Toolbar: Search & Filters */}
      <div className={styles.controlsCard}>
        <div className={styles.searchAndFilterRow}>
          <div className={styles.searchWrapper}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search by colleague name, shift, or reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className={styles.clearSearchBtn}
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Desktop Filter Pills */}
          <div className={styles.desktopFilterGroup}>
            {filterOptions.map((st) => {
              const isActive = statusFilter === st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStatusFilter(st.id)}
                  className={`${styles.filterPill} ${isActive ? styles.filterPillActive : ''}`}
                >
                  {st.label}
                </button>
              );
            })}
          </div>

          {/* Mobile Filter Trigger Button */}
          <button
            type="button"
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className={styles.filterToggleBtn}
          >
            <Filter size={15} style={{ marginRight: '6px' }} />
            <span>Filters {statusFilter !== 'ALL' ? `(${statusFilter})` : ''}</span>
          </button>
        </div>

        {/* Navigation Tabs (Incoming vs Outgoing) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', paddingTop: '4px' }}>
          <div className={styles.tabBar}>
            <button
              onClick={() => setActiveTab('INCOMING')}
              className={`${styles.tabBtn} ${activeTab === 'INCOMING' ? styles.tabBtnActive : ''}`}
            >
              <Users size={15} />
              <span>Incoming Invites</span>
              <span className={`${styles.tabBadge} ${activeTab === 'INCOMING' ? styles.tabBadgeActive : ''}`}>
                {incomingRequests.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('OUTGOING')}
              className={`${styles.tabBtn} ${activeTab === 'OUTGOING' ? styles.tabBtnActive : ''}`}
            >
              <Send size={15} />
              <span>My Sent Requests</span>
              <span className={`${styles.tabBadge} ${activeTab === 'OUTGOING' ? styles.tabBadgeActive : ''}`}>
                {outgoingRequests.length}
              </span>
            </button>
          </div>

          {(statusFilter !== 'ALL' || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter('ALL');
                setSearchQuery('');
              }}
              style={{ background: 'none', border: 'none', color: '#818cf8', fontSize: '12px', fontWeight: 700, cursor: 'pointer', padding: '4px 8px' }}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Mobile Filter Drawer Overlay */}
      {showMobileFilters && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(6px)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
          onClick={() => setShowMobileFilters(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '500px',
              backgroundColor: '#0f172a',
              borderTopLeftRadius: '20px',
              borderTopRightRadius: '20px',
              border: '1px solid var(--border-medium)',
              borderBottom: 'none',
              padding: '24px 20px',
              boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              boxSizing: 'border-box',
              maxHeight: '85vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 800, fontSize: '16px', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Filter size={18} color="#818cf8" />
                <span>Filter Requests</span>
              </div>
              <button
                type="button"
                onClick={() => setShowMobileFilters(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '30px',
                  height: '30px',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#94a3b8', marginBottom: '10px' }}>
                Request Status
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {filterOptions.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setStatusFilter(st.id)}
                    className={`btn btn-sm ${statusFilter === st.id ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ borderRadius: '8px', padding: '8px 14px', fontSize: '12.5px', fontWeight: 600 }}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '12px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('ALL');
                  setSearchQuery('');
                }}
                className="btn btn-secondary btn-sm"
                style={{ flex: 1, padding: '12px' }}
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setShowMobileFilters(false)}
                className="btn btn-primary btn-sm"
                style={{ flex: 1, padding: '12px', fontWeight: 700 }}
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {loading ? (
        <div className="glass-card" style={{ padding: '60px 24px', textAlign: 'center', borderRadius: '16px' }}>
          <Loader2 size={36} className="animate-spin" style={{ margin: '0 auto 14px auto', color: '#818cf8' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading shift swap requests...</p>
        </div>
      ) : (
        <>
          {/* TAB 1: INCOMING REQUESTS */}
          {activeTab === 'INCOMING' && (
            <div>
              {filteredIncoming.length === 0 ? (
                <div className="glass-card" style={{ padding: '60px 24px', textAlign: 'center', borderRadius: '16px' }}>
                  <CheckCircle2 size={36} color="#34d399" style={{ margin: '0 auto 14px auto' }} />
                  <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#ffffff', margin: 0 }}>No Incoming Invites Found</h3>
                  <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                    {searchQuery || statusFilter !== 'ALL'
                      ? 'No incoming shift swap requests match your current filters.'
                      : 'You do not have any incoming shift swap invitations right now.'}
                  </p>
                </div>
              ) : (
                <div className={styles.cardsGrid}>
                  {filteredIncoming.map((req) => {
                    const targetDateFormatted = new Date(req.targetDate).toLocaleDateString(undefined, {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    });
                    const isResponding = respondingId === req.id;
                    const isBroadcast = (req.recipients?.length || 0) > 1;

                    const acceptedByOther =
                      req.status === 'PEER_ACCEPTED' &&
                      req.peer &&
                      req.peer.id !== currentStaff?.id;

                    const myRecipientStatus = req.recipients?.find(
                      (r) => r.peerId === currentStaff?.id
                    )?.status;

                    const isActionNeeded = req.status === 'PENDING_PEER' && !acceptedByOther && myRecipientStatus !== 'REJECTED';

                    return (
                      <div
                        key={req.id}
                        className={`${styles.swapCard} ${isActionNeeded ? styles.swapCardActionNeeded : ''}`}
                      >
                        <div>
                          {/* Card Top Header */}
                          <div className={styles.cardHeader}>
                            <div className={styles.userInfo}>
                              <StaffAvatar
                                name={req.requester.name}
                                avatarUrl={req.requester.avatarUrl}
                                size="md"
                              />
                              <div>
                                <div className={styles.userName}>{req.requester.name}</div>
                                <div className={styles.userSubtext}>
                                  Staff ID: <span style={{ fontFamily: 'var(--font-mono)' }}>{req.requester.staffId}</span>
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                              <span
                                className={`badge ${
                                  req.status === 'APPROVED'
                                    ? 'badge-active'
                                    : acceptedByOther
                                    ? 'badge-rejected'
                                    : isActionNeeded
                                    ? 'badge-pending'
                                    : 'badge-info'
                                }`}
                                style={{ fontSize: '11px', fontWeight: 800 }}
                              >
                                {acceptedByOther
                                  ? `TAKEN BY ${req.peer?.name.toUpperCase()}`
                                  : isActionNeeded
                                  ? 'ACTION NEEDED'
                                  : req.status}
                              </span>

                              {isBroadcast && (
                                <span style={{ fontSize: '10.5px', padding: '2px 8px', borderRadius: '10px', backgroundColor: 'rgba(99, 102, 241, 0.2)', color: '#a5b4fc', fontWeight: 700 }}>
                                  Broadcast ({req.recipients?.length})
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Shift Comparison Mini-Boxes */}
                          <div className={styles.swapComparisonGrid}>
                            <div className={styles.swapMiniBox}>
                              <div className={styles.swapMiniBoxTitle}>Requester's Shift</div>
                              <div className={styles.swapMiniBoxValue}>{targetDateFormatted}</div>
                              <div className={styles.swapMiniBoxSub} style={{ color: '#818cf8' }}>
                                {req.shiftPatternName || 'Scheduled Shift'}
                              </div>
                            </div>

                            <div className={styles.swapMiniBox}>
                              <div className={styles.swapMiniBoxTitle}>Your Coverage Date</div>
                              <div className={styles.swapMiniBoxValue}>{targetDateFormatted}</div>
                              <div className={styles.swapMiniBoxSub} style={{ color: '#34d399' }}>
                                Direct Swap Offer
                              </div>
                            </div>
                          </div>

                          {/* Reason Quote */}
                          {req.reason && (
                            <div className={styles.reasonBox}>
                              <strong>Reason:</strong> {req.reason}
                            </div>
                          )}

                          {acceptedByOther && (
                            <div style={{ fontSize: '12px', color: '#fbbf24', fontStyle: 'italic', marginBottom: '12px', padding: '8px 12px', borderRadius: '8px', backgroundColor: 'rgba(251, 191, 36, 0.08)' }}>
                              This swap request was accepted by {req.peer?.name} and is locked awaiting Org Admin approval.
                            </div>
                          )}
                        </div>

                        {/* Card Footer Actions */}
                        {isActionNeeded && (
                          <div className={styles.cardFooter}>
                            <button
                              onClick={() => handlePeerRespond(req.id, 'REJECT')}
                              disabled={isResponding}
                              className="btn btn-secondary btn-sm"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', borderRadius: '8px' }}
                            >
                              <X size={14} />
                              <span>Decline</span>
                            </button>

                            <button
                              onClick={() => handlePeerRespond(req.id, 'ACCEPT')}
                              disabled={isResponding}
                              className="btn btn-primary btn-sm"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 800, borderRadius: '8px', padding: '8px 16px' }}
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
                <div className="glass-card" style={{ padding: '60px 24px', textAlign: 'center', borderRadius: '16px' }}>
                  <Calendar size={36} color="var(--text-muted)" style={{ margin: '0 auto 14px auto' }} />
                  <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#ffffff', margin: 0 }}>No Sent Requests Found</h3>
                  <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginTop: '6px', marginBottom: '20px' }}>
                    {searchQuery || statusFilter !== 'ALL'
                      ? 'No sent swap requests match your search filter.'
                      : 'You have not submitted any shift swap requests yet.'}
                  </p>
                  <Link href={`/${organizationCode}/staff/swaps/new`} className={styles.primaryActionBtn} style={{ display: 'inline-flex', width: 'auto' }}>
                    <Plus size={16} />
                    <span>Apply for Shift Swap</span>
                  </Link>
                </div>
              ) : (
                <div className={styles.cardsGrid}>
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
                      <div key={req.id} className={styles.swapCard}>
                        <div>
                          {/* Card Header */}
                          <div className={styles.cardHeader}>
                            <div>
                              <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>
                                Target Shift &amp; Recipients
                              </div>
                              <div style={{ fontSize: '15.5px', fontWeight: 800, color: '#ffffff', marginTop: '2px' }}>
                                {req.peer
                                  ? `Direct Request to ${req.peer.name}`
                                  : acceptedRecipient
                                  ? `Accepted by ${acceptedRecipient.peer.name}`
                                  : `Broadcast Request (${recipientCount} Invited)`}
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
                              style={{ fontSize: '11px', fontWeight: 800 }}
                            >
                              {req.status === 'PENDING_PEER'
                                ? `AWAITING PEER (${recipientCount})`
                                : req.status === 'PEER_ACCEPTED'
                                ? 'PEER ACCEPTED (AWAITING ADMIN)'
                                : req.status}
                            </span>
                          </div>

                          {/* Side-by-Side Shift Comparison */}
                          <div className={styles.swapComparisonGrid}>
                            <div className={styles.swapMiniBox}>
                              <div className={styles.swapMiniBoxTitle}>My Assigned Shift</div>
                              <div className={styles.swapMiniBoxValue}>{targetDateFormatted}</div>
                              <div className={styles.swapMiniBoxSub} style={{ color: '#38bdf8' }}>
                                {req.shiftPatternName || 'Scheduled Shift'}
                              </div>
                            </div>

                            <div className={styles.swapMiniBox}>
                              <div className={styles.swapMiniBoxTitle}>Requested Cover</div>
                              <div className={styles.swapMiniBoxValue}>{targetDateFormatted}</div>
                              <div className={styles.swapMiniBoxSub} style={{ color: '#c084fc' }}>
                                Outgoing Swap Request
                              </div>
                            </div>
                          </div>

                          {/* Invited Recipients Pills */}
                          {req.recipients && req.recipients.length > 0 && (
                            <div style={{ marginBottom: '12px' }}>
                              <div style={{ fontSize: '11.5px', color: '#94a3b8', fontWeight: 700, marginBottom: '6px' }}>
                                Invited Colleagues ({req.recipients.length}):
                              </div>
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                {req.recipients.map((r) => (
                                  <div
                                    key={r.id}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      fontSize: '11.5px',
                                      padding: '4px 10px',
                                      borderRadius: '20px',
                                      backgroundColor:
                                        r.status === 'ACCEPTED'
                                          ? 'rgba(52, 211, 153, 0.15)'
                                          : r.status === 'REJECTED'
                                          ? 'rgba(244, 63, 94, 0.15)'
                                          : 'rgba(255,255,255,0.05)',
                                      color:
                                        r.status === 'ACCEPTED'
                                          ? '#34d399'
                                          : r.status === 'REJECTED'
                                          ? '#f43f5e'
                                          : '#cbd5e1',
                                      border: '1px solid rgba(255,255,255,0.08)',
                                    }}
                                  >
                                    <StaffAvatar name={r.peer.name} avatarUrl={r.peer.avatarUrl} size="xs" />
                                    <span style={{ fontWeight: 600 }}>{r.peer.name}</span>
                                    <span style={{ fontSize: '10px', opacity: 0.8, textTransform: 'uppercase' }}>({r.status})</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Reason Quote */}
                          {req.reason && (
                            <div className={styles.reasonBox}>
                              <strong>Reason:</strong> {req.reason}
                            </div>
                          )}
                        </div>
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
