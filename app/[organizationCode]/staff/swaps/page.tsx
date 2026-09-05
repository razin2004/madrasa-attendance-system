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
  MessageSquare,
} from 'lucide-react';
import { useToast } from '@/components/feedback/toast-provider';
import styles from './ShiftSwapsStaff.module.css';

interface Colleague {
  id: string;
  staffId: string;
  name: string;
  phone: string | null;
  user: { email: string };
  branchAssignments?: { branch: { name: string } }[];
}

interface OutgoingRequest {
  id: string;
  targetDate: string;
  reason: string | null;
  status: 'PENDING_PEER' | 'PEER_ACCEPTED' | 'PEER_REJECTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  createdAt: string;
  peer: {
    id: string;
    staffId: string;
    name: string;
    phone: string | null;
    user: { email: string };
  };
}

interface IncomingRequest {
  id: string;
  targetDate: string;
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
}

export default function StaffShiftSwapsPage() {
  const params = useParams();
  const organizationCode = (params.organizationCode as string)?.toUpperCase() || '';
  const router = useRouter();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [outgoingRequests, setOutgoingRequests] = useState<OutgoingRequest[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>([]);
  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const [activeTab, setActiveTab] = useState<'INCOMING' | 'OUTGOING'>('INCOMING');

  // New Swap Request Modal
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedPeerId, setSelectedPeerId] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Peer Respond Loading State
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/org/${organizationCode}/staff/swaps`);
      const data = await res.json();

      if (res.ok && data.success) {
        setOutgoingRequests(data.outgoingRequests || []);
        setIncomingRequests(data.incomingRequests || []);
        setColleagues(data.colleagues || []);
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

  const handleCreateSwap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPeerId) return toast.error('Please select a colleague to swap with.');
    if (!targetDate) return toast.error('Please select a shift target date.');

    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/org/${organizationCode}/staff/swaps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          peerStaffId: selectedPeerId,
          targetDate,
          reason: reason.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || 'Shift swap request sent!');
        setIsNewModalOpen(false);
        setSelectedPeerId('');
        setTargetDate('');
        setReason('');
        fetchData();
      } else {
        toast.error(data.error || 'Failed to send shift swap request.');
      }
    } catch {
      toast.error('Network error sending shift swap request.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
        toast.success(data.message || 'Response submitted.');
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

  const pendingIncomingCount = incomingRequests.filter((r) => r.status === 'PENDING_PEER').length;

  return (
    <div className={styles.container}>
      <div className={styles.mainContent}>
        {/* Header Bar */}
        <header className={styles.headerBar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => router.back()} className="btn btn-secondary btn-sm" style={{ padding: '8px' }}>
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 className={styles.title}>Shift Swapping &amp; Substitutions</h1>
              <p className={styles.subtitle}>
                Request colleagues to cover or swap workplace shifts with 2-step approval.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={() => setIsNewModalOpen(true)}
              className="btn btn-primary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
            >
              <Plus size={16} />
              <span>New Swap Request</span>
            </button>

            <button onClick={fetchData} disabled={loading} className="btn btn-secondary btn-sm" style={{ padding: '8px' }}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </header>

        <main className="pageMainContent" style={{ padding: '24px', maxWidth: '840px', margin: '0 auto' }}>
          {/* Incoming Notification Banner */}
          {pendingIncomingCount > 0 && (
            <div
              style={{
                marginBottom: '20px',
                padding: '14px 18px',
                borderRadius: '12px',
                backgroundColor: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: '#38bdf8',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Clock size={20} color="#38bdf8" />
                <div>
                  <strong style={{ color: '#ffffff', fontSize: '14px' }}>
                    {pendingIncomingCount} Incoming Shift Swap Request{pendingIncomingCount > 1 ? 's' : ''}
                  </strong>
                  <div style={{ fontSize: '12px', color: '#bae6fd' }}>
                    A colleague has asked you to cover/swap a shift.
                  </div>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('INCOMING')}
                className="btn btn-primary btn-sm"
                style={{ fontSize: '12px', fontWeight: 700 }}
              >
                View Incoming
              </button>
            </div>
          )}

          {/* Navigation Tabs */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
            <button
              onClick={() => setActiveTab('INCOMING')}
              className={`btn btn-sm ${activeTab === 'INCOMING' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', borderRadius: '8px' }}
            >
              <Users size={14} />
              <span>Incoming Requests ({incomingRequests.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('OUTGOING')}
              className={`btn btn-sm ${activeTab === 'OUTGOING' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', borderRadius: '8px' }}
            >
              <Send size={14} />
              <span>My Requests ({outgoingRequests.length})</span>
            </button>
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
                  {incomingRequests.length === 0 ? (
                    <div className="glass-card" style={{ padding: '48px 24px', textAlign: 'center' }}>
                      <CheckCircle2 size={32} color="#34d399" style={{ margin: '0 auto 12px auto' }} />
                      <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>No Incoming Swap Invites</h3>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        No colleagues have requested you to cover a shift yet.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {incomingRequests.map((req) => {
                        const targetDateFormatted = new Date(req.targetDate).toLocaleDateString(undefined, {
                          weekday: 'short',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        });
                        const isResponding = respondingId === req.id;

                        return (
                          <div
                            key={req.id}
                            className="glass-card"
                            style={{
                              padding: '20px',
                              borderRadius: '14px',
                              border: req.status === 'PENDING_PEER' ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid var(--border-subtle)',
                              backgroundColor: req.status === 'PENDING_PEER' ? 'rgba(56, 189, 248, 0.04)' : 'rgba(13, 18, 31, 0.8)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
                                  <User size={18} />
                                </div>
                                <div>
                                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff' }}>{req.requester.name}</div>
                                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                                    Staff ID: <span style={{ fontFamily: 'var(--font-mono)' }}>{req.requester.staffId}</span>
                                  </div>
                                </div>
                              </div>

                              <span className={`badge ${req.status === 'APPROVED' ? 'badge-active' : req.status === 'PENDING_PEER' ? 'badge-pending' : 'badge-info'}`}>
                                {req.status === 'PENDING_PEER' ? 'ACTION NEEDED (ACCEPT/DECLINE)' : req.status}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#38bdf8', fontWeight: 700, marginBottom: '10px' }}>
                              <Calendar size={16} />
                              <span>Target Shift Date: {targetDateFormatted}</span>
                            </div>

                            {req.reason && (
                              <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '16px', padding: '8px 12px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                                <strong>Colleague Note:</strong> {req.reason}
                              </div>
                            )}

                            {/* Response Actions */}
                            {req.status === 'PENDING_PEER' && (
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
                  {outgoingRequests.length === 0 ? (
                    <div className="glass-card" style={{ padding: '48px 24px', textAlign: 'center' }}>
                      <Calendar size={32} color="var(--text-muted)" style={{ margin: '0 auto 12px auto' }} />
                      <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>No Outgoing Swap Requests</h3>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', marginBottom: '16px' }}>
                        You haven&apos;t initiated any shift swap requests yet.
                      </p>
                      <button onClick={() => setIsNewModalOpen(true)} className="btn btn-primary btn-sm">
                        Create Shift Swap Request
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {outgoingRequests.map((req) => {
                        const targetDateFormatted = new Date(req.targetDate).toLocaleDateString(undefined, {
                          weekday: 'short',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        });

                        return (
                          <div key={req.id} className="glass-card" style={{ padding: '20px', borderRadius: '14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                              <div>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Requested Colleague</span>
                                <div style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff' }}>{req.peer.name}</div>
                              </div>

                              <span className={`badge ${req.status === 'APPROVED' ? 'badge-active' : req.status === 'PEER_ACCEPTED' ? 'badge-pending' : req.status === 'PENDING_PEER' ? 'badge-info' : 'badge-rejected'}`}>
                                {req.status === 'PENDING_PEER'
                                  ? 'AWAITING PEER RESPONSE'
                                  : req.status === 'PEER_ACCEPTED'
                                  ? 'PEER ACCEPTED (AWAITING ADMIN)'
                                  : req.status}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#38bdf8', fontWeight: 700, marginBottom: '8px' }}>
                              <Calendar size={16} />
                              <span>Shift Date: {targetDateFormatted}</span>
                            </div>

                            {req.reason && (
                              <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '6px' }}>
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
        </main>
      </div>

      {/* NEW SHIFT SWAP MODAL */}
      {isNewModalOpen && (
        <div className="modal-overlay" onClick={() => setIsNewModalOpen(false)}>
          <div className="modal-content glass-card" onClick={(e) => e.stopPropagation()} style={{ padding: '28px', maxWidth: '480px', width: '100%', borderRadius: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
                  <Plus size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#ffffff', margin: 0 }}>Request Shift Swap</h3>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Select colleague &amp; target shift date</div>
                </div>
              </div>
              <button onClick={() => setIsNewModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <form onSubmit={handleCreateSwap}>
              {/* Select Colleague */}
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontSize: '12.5px', fontWeight: 600, color: '#ffffff' }}>
                  Select Colleague / Peer <span style={{ color: 'var(--danger-text)' }}>*</span>
                </label>
                <select
                  value={selectedPeerId}
                  onChange={(e) => setSelectedPeerId(e.target.value)}
                  required
                  className="form-input"
                  style={{ width: '100%', marginTop: '4px' }}
                >
                  <option value="">-- Choose a colleague --</option>
                  {colleagues.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.staffId})
                    </option>
                  ))}
                </select>
              </div>

              {/* Target Shift Date */}
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontSize: '12.5px', fontWeight: 600, color: '#ffffff' }}>
                  Shift Target Date <span style={{ color: 'var(--danger-text)' }}>*</span>
                </label>
                <input
                  type="date"
                  required
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  className="form-input"
                  style={{ width: '100%', marginTop: '4px' }}
                />
              </div>

              {/* Reason */}
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label" style={{ fontSize: '12.5px', fontWeight: 600, color: '#ffffff' }}>
                  Reason Note (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Personal commitment / Exam schedule..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="form-input"
                  style={{ width: '100%', marginTop: '4px', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setIsNewModalOpen(false)} disabled={isSubmitting} className="btn btn-secondary btn-sm">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="btn btn-primary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                  {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  <span>{isSubmitting ? 'Sending...' : 'Send Swap Request'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
