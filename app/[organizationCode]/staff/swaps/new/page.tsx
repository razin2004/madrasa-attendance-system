'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Send,
  Search,
  Filter,
  Check,
} from 'lucide-react';
import { useToast } from '@/components/feedback/toast-provider';
import styles from '../ShiftSwapsStaff.module.css';

interface ShiftPattern {
  id: string;
  name: string;
  description: string | null;
  weeklyDays: Array<{
    weekday: string;
    startTime: string | null;
    endTime: string | null;
    isHoliday: boolean;
  }>;
}

interface Colleague {
  id: string;
  staffId: string;
  name: string;
  phone: string | null;
  user: { email: string };
  branchAssignments?: Array<{ branch: { name: string } }>;
  shiftAssignments?: Array<{
    shiftPattern: { id: string; name: string };
  }>;
}

export default function NewShiftSwapPage() {
  const params = useParams();
  const organizationCode = (params.organizationCode as string)?.toUpperCase() || '';
  const router = useRouter();
  const toast = useToast();

  const [loading, setLoading] = useState(true);

  // Form Data
  const [shiftPatterns, setShiftPatterns] = useState<ShiftPattern[]>([]);
  const [colleagues, setColleagues] = useState<Colleague[]>([]);

  // Selected State
  const [targetDate, setTargetDate] = useState<string>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [selectedShiftPatternId, setSelectedShiftPatternId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPeerIds, setSelectedPeerIds] = useState<string[]>([]);
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/org/${organizationCode}/staff/swaps`);
      const data = await res.json();

      if (res.ok && data.success) {
        setShiftPatterns(data.shiftPatterns || []);
        setColleagues(data.colleagues || []);
      } else {
        toast.error(data.error || 'Failed to load colleagues and shift details.');
      }
    } catch {
      toast.error('Network error loading shift swap data.');
    } finally {
      setLoading(false);
    }
  }, [organizationCode, toast]);

  useEffect(() => {
    if (organizationCode) {
      fetchData();
    }
  }, [organizationCode, fetchData]);

  // Filter colleagues by shift pattern and search text
  const filteredColleagues = colleagues.filter((colleague) => {
    const matchesShift =
      selectedShiftPatternId === 'ALL' ||
      colleague.shiftAssignments?.some(
        (sa) => sa.shiftPattern?.id === selectedShiftPatternId
      );

    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      colleague.name.toLowerCase().includes(q) ||
      colleague.staffId.toLowerCase().includes(q) ||
      colleague.user.email.toLowerCase().includes(q);

    return matchesShift && matchesSearch;
  });

  const handleTogglePeer = (peerId: string) => {
    setSelectedPeerIds((prev) =>
      prev.includes(peerId) ? prev.filter((id) => id !== peerId) : [...prev, peerId]
    );
  };

  const handleSelectAllFiltered = () => {
    const filteredIds = filteredColleagues.map((c) => c.id);
    const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedPeerIds.includes(id));

    if (allSelected) {
      setSelectedPeerIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
    } else {
      setSelectedPeerIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  const selectedShiftPattern = shiftPatterns.find((s) => s.id === selectedShiftPatternId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!targetDate) {
      toast.error('Please pick a target date for the shift swap.');
      return;
    }

    if (selectedPeerIds.length === 0) {
      toast.error('Please select at least one colleague to send the shift swap request to.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/org/${organizationCode}/staff/swaps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetDate,
          shiftPatternId: selectedShiftPatternId !== 'ALL' ? selectedShiftPatternId : null,
          shiftPatternName: selectedShiftPattern ? selectedShiftPattern.name : 'Branch Shift',
          peerStaffIds: selectedPeerIds,
          reason: reason.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        toast.success(data.message || 'Shift swap request created successfully!');
        router.push(`/${organizationCode}/staff/swaps`);
      } else {
        toast.error(data.error || 'Failed to create shift swap request.');
      }
    } catch {
      toast.error('Network error submitting shift swap.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isAllFilteredSelected =
    filteredColleagues.length > 0 &&
    filteredColleagues.every((c) => selectedPeerIds.includes(c.id));

  return (
    <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
      {/* Top Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <Link
            href={`/${organizationCode}/staff/swaps`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '13px', textDecoration: 'none', marginBottom: '8px' }}
          >
            <ArrowLeft size={16} />
            <span>Back to Shift Swaps</span>
          </Link>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
            New Shift Swap Request
          </h1>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0 0' }}>
            Select target date, filter by shift, and choose colleagues for coverage.
          </p>
        </div>

        <Link href={`/${organizationCode}/staff/swaps`} className="btn btn-secondary btn-sm" style={{ padding: '8px 14px', borderRadius: '8px' }}>
          Cancel
        </Link>
      </div>

      {loading ? (
        <div className="glass-card" style={{ padding: '60px', textAlign: 'center' }}>
          <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 12px auto', color: '#818cf8' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Loading shift patterns and colleagues...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="glass-card" style={{ padding: '28px', borderRadius: '16px' }}>
            {/* SECTION 1: TARGET DATE & SHIFT PATTERN SELECTION */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginBottom: '24px' }}>
              {/* Target Shift Date */}
              <div>
                <label className="form-label" style={{ fontSize: '13px', color: '#ffffff', fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={15} color="#38bdf8" />
                  <span>Target Shift Date <span style={{ color: 'var(--danger-text)' }}>*</span></span>
                </label>
                <input
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  required
                  className="form-input"
                  style={{ width: '100%', padding: '10px 14px', fontSize: '14px' }}
                />
              </div>

              {/* Shift Pattern Selection Dropdown */}
              <div>
                <label className="form-label" style={{ fontSize: '13px', color: '#ffffff', fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={15} color="#818cf8" />
                  <span>Filter Colleagues by Shift Schedule</span>
                </label>
                <select
                  value={selectedShiftPatternId}
                  onChange={(e) => setSelectedShiftPatternId(e.target.value)}
                  className="form-input"
                  style={{ width: '100%', padding: '10px 14px', fontSize: '14px', color: '#ffffff', backgroundColor: 'rgba(15, 23, 42, 0.9)' }}
                >
                  <option value="ALL">All Active Shifts (Show All Colleagues)</option>
                  {shiftPatterns.map((shift) => (
                    <option key={shift.id} value={shift.id}>
                      {shift.name} ({colleagues.filter((c) => c.shiftAssignments?.some((sa) => sa.shiftPattern?.id === shift.id)).length} staff members)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* SECTION 2: COLLEAGUE SELECTION & FILTERING */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '20px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Users size={16} color="#34d399" />
                    <span>Select Colleagues ({selectedPeerIds.length} Selected)</span>
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                    First colleague to accept will secure the shift swap request.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* Quick Search */}
                  <div style={{ position: 'relative', width: '220px' }}>
                    <input
                      type="text"
                      placeholder="Search colleague name/ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="form-input"
                      style={{ width: '100%', paddingLeft: '32px', fontSize: '12.5px', padding: '6px 10px 6px 32px' }}
                    />
                    <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '9px' }} />
                  </div>

                  {filteredColleagues.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSelectAllFiltered}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '12px', padding: '6px 12px' }}
                    >
                      {isAllFilteredSelected ? 'Deselect All' : 'Select All Filtered'}
                    </button>
                  )}
                </div>
              </div>

              {filteredColleagues.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                  <Users size={28} color="var(--text-muted)" style={{ margin: '0 auto 8px auto' }} />
                  <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', margin: 0 }}>
                    No active colleagues found matching the selected shift pattern or search query.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '10px', maxHeight: '340px', overflowY: 'auto', paddingRight: '4px' }}>
                  {filteredColleagues.map((colleague) => {
                    const isSelected = selectedPeerIds.includes(colleague.id);
                    const shiftName = colleague.shiftAssignments?.[0]?.shiftPattern?.name || 'General Shift';

                    return (
                      <div
                        key={colleague.id}
                        onClick={() => handleTogglePeer(colleague.id)}
                        style={{
                          padding: '12px 14px',
                          borderRadius: '10px',
                          cursor: 'pointer',
                          border: isSelected ? '2px solid #34d399' : '1px solid var(--border-subtle)',
                          backgroundColor: isSelected ? 'rgba(52, 211, 153, 0.12)' : 'rgba(255,255,255,0.02)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          style={{ width: '17px', height: '17px', accentColor: '#34d399', cursor: 'pointer' }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {colleague.name}
                          </div>
                          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                            ID: <span style={{ fontFamily: 'var(--font-mono)' }}>{colleague.staffId}</span>
                          </div>
                          <div style={{ fontSize: '11px', color: '#818cf8', marginTop: '2px' }}>
                            {shiftName}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SECTION 3: REASON & SUBMIT */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '20px' }}>
              <div style={{ marginBottom: '20px' }}>
                <label className="form-label" style={{ fontSize: '13px', color: '#ffffff', fontWeight: 700, marginBottom: '6px' }}>
                  Reason for Shift Swap Request (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Personal commitment / Exam schedule. Can anyone cover my Thursday Kozhikode branch shift?"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="form-input"
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              {/* Broadcast Summary Pill */}
              <div
                style={{
                  padding: '14px 18px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(99, 102, 241, 0.1)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <ShieldCheck size={22} color="#818cf8" style={{ flexShrink: 0 }} />
                <div>
                  <strong style={{ fontSize: '14px', color: '#ffffff' }}>
                    {selectedPeerIds.length} {selectedPeerIds.length === 1 ? 'Colleague' : 'Colleagues'} Selected
                  </strong>
                  <div style={{ fontSize: '12px', color: '#c7d2fe', marginTop: '2px' }}>
                    Once 1 colleague accepts, the request locks and notifies Org Admin for final 1-click approval.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <Link href={`/${organizationCode}/staff/swaps`} className="btn btn-secondary btn-md">
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={isSubmitting || selectedPeerIds.length === 0}
                  className="btn btn-primary btn-md"
                  style={{ fontWeight: 800, padding: '10px 24px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Sending Request...</span>
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      <span>Submit Shift Swap Request</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
