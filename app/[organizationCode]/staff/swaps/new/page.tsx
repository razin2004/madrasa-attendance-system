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
  Check,
  Sparkles,
} from 'lucide-react';
import { useToast } from '@/components/feedback/toast-provider';
import { StaffAvatar } from '@/components/ui/staff-avatar';
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
  avatarUrl?: string | null;
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
    <div className={styles.pageContainer} style={{ maxWidth: '980px' }}>
      {/* Top Header Bar */}
      <div className={styles.headerSection}>
        <div className={styles.headerTitleGroup}>
          <Link
            href={`/${organizationCode}/staff/swaps`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '13px', textDecoration: 'none', marginBottom: '8px', fontWeight: 600 }}
          >
            <ArrowLeft size={16} />
            <span>Back to Shift Swaps</span>
          </Link>
          <h1 className={styles.pageTitle}>
            <Sparkles size={22} color="#818cf8" />
            <span>Apply for Shift Swap</span>
          </h1>
          <p className={styles.pageSubtitle}>
            Select target date, filter by shift schedule, and select colleagues for coverage.
          </p>
        </div>

        <div className={styles.headerActionGroup}>
          <Link
            href={`/${organizationCode}/staff/swaps`}
            className="btn btn-secondary btn-sm"
            style={{ borderRadius: '10px', padding: '9px 16px', fontSize: '13px' }}
          >
            Cancel
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="glass-card" style={{ padding: '60px 24px', textAlign: 'center', borderRadius: '16px' }}>
          <Loader2 size={36} className="animate-spin" style={{ margin: '0 auto 14px auto', color: '#818cf8' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading shift patterns and colleagues...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div
            className="glass-card"
            style={{
              padding: '28px 24px',
              borderRadius: '16px',
              backgroundColor: 'rgba(13, 18, 31, 0.85)',
              border: '1px solid var(--border-subtle)',
              backdropFilter: 'blur(12px)',
            }}
          >
            {/* SECTION 1: TARGET DATE & SHIFT SCHEDULE FILTER */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '28px' }}>
              {/* Target Shift Date */}
              <div>
                <label className="form-label" style={{ fontSize: '13px', color: '#ffffff', fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={16} color="#38bdf8" />
                  <span>Target Shift Date <span style={{ color: 'var(--danger-text)' }}>*</span></span>
                </label>
                <input
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  required
                  className="form-input"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    fontSize: '14px',
                    height: '44px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#ffffff',
                    colorScheme: 'dark',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Shift Pattern Selection Dropdown */}
              <div>
                <label className="form-label" style={{ fontSize: '13px', color: '#ffffff', fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={16} color="#818cf8" />
                  <span>Filter Colleagues by Shift Schedule</span>
                </label>
                <select
                  value={selectedShiftPatternId}
                  onChange={(e) => setSelectedShiftPatternId(e.target.value)}
                  className="form-input"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    fontSize: '14px',
                    height: '44px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#ffffff',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
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

            {/* SECTION 2: COLLEAGUE SELECTION & SEARCH */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '24px', marginBottom: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', marginBottom: '18px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Users size={18} color="#34d399" />
                    <span>Select Colleagues ({selectedPeerIds.length} Selected)</span>
                  </h3>
                  <p style={{ fontSize: '12.5px', color: '#94a3b8', margin: '3px 0 0 0' }}>
                    First colleague to accept will secure the shift swap request.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* Search Bar */}
                  <div style={{ position: 'relative', width: '240px' }}>
                    <input
                      type="text"
                      placeholder="Search colleague name/ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="form-input"
                      style={{
                        width: '100%',
                        padding: '8px 12px 8px 34px',
                        fontSize: '13px',
                        borderRadius: '10px',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        color: '#ffffff',
                        boxSizing: 'border-box',
                      }}
                    />
                    <Search size={15} color="#64748b" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                  </div>

                  {filteredColleagues.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSelectAllFiltered}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '12.5px', padding: '8px 14px', borderRadius: '8px', fontWeight: 600 }}
                    >
                      {isAllFilteredSelected ? 'Deselect All' : 'Select All Filtered'}
                    </button>
                  )}
                </div>
              </div>

              {filteredColleagues.length === 0 ? (
                <div style={{ padding: '40px 24px', textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <Users size={32} color="var(--text-muted)" style={{ margin: '0 auto 10px auto' }} />
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
                    No active colleagues found matching the selected shift pattern or search query.
                  </p>
                </div>
              ) : (
                <div className={styles.colleagueGrid}>
                  {filteredColleagues.map((colleague) => {
                    const isSelected = selectedPeerIds.includes(colleague.id);
                    const shiftName = colleague.shiftAssignments?.[0]?.shiftPattern?.name || 'General Shift';

                    return (
                      <div
                        key={colleague.id}
                        onClick={() => handleTogglePeer(colleague.id)}
                        className={`${styles.colleagueCard} ${isSelected ? styles.colleagueCardSelected : ''}`}
                      >
                        <div
                          style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '6px',
                            border: isSelected ? 'none' : '2px solid rgba(255,255,255,0.25)',
                            backgroundColor: isSelected ? '#34d399' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {isSelected && <Check size={14} color="#0f172a" strokeWidth={3} />}
                        </div>

                        <StaffAvatar name={colleague.name} avatarUrl={colleague.avatarUrl} size="md" />

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {colleague.name}
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                            ID: <span style={{ fontFamily: 'var(--font-mono)' }}>{colleague.staffId}</span>
                          </div>
                          <div style={{ fontSize: '11px', color: '#818cf8', marginTop: '2px', fontWeight: 600 }}>
                            {shiftName}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SECTION 3: REASON & SUBMIT ACTION */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '24px' }}>
              <div style={{ marginBottom: '20px' }}>
                <label className="form-label" style={{ fontSize: '13px', color: '#ffffff', fontWeight: 700, marginBottom: '8px', display: 'block' }}>
                  Reason for Shift Swap Request (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Personal commitment / Exam schedule. Can anyone cover my Thursday Kozhikode branch shift?"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="form-input"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    minHeight: '90px',
                    padding: '12px 14px',
                    fontSize: '13.5px',
                    lineHeight: '1.5',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#ffffff',
                    resize: 'vertical',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Broadcast Summary Pill */}
              <div
                style={{
                  padding: '16px 20px',
                  borderRadius: '14px',
                  backgroundColor: 'rgba(99, 102, 241, 0.12)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  marginBottom: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                }}
              >
                <ShieldCheck size={24} color="#818cf8" style={{ flexShrink: 0 }} />
                <div>
                  <strong style={{ fontSize: '14.5px', color: '#ffffff' }}>
                    {selectedPeerIds.length} {selectedPeerIds.length === 1 ? 'Colleague' : 'Colleagues'} Selected
                  </strong>
                  <div style={{ fontSize: '12.5px', color: '#c7d2fe', marginTop: '2px' }}>
                    Once 1 colleague accepts, the request locks and notifies Org Admin for final 1-click approval.
                  </div>
                </div>
              </div>

              {/* Form Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', alignItems: 'center' }}>
                <Link
                  href={`/${organizationCode}/staff/swaps`}
                  className="btn btn-secondary btn-md"
                  style={{ borderRadius: '10px', padding: '12px 20px', fontSize: '13.5px' }}
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={isSubmitting || selectedPeerIds.length === 0}
                  className="btn btn-primary btn-md"
                  style={{
                    fontWeight: 800,
                    padding: '12px 28px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    borderRadius: '10px',
                    fontSize: '14px',
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Sending Request...</span>
                    </>
                  ) : (
                    <>
                      <Send size={18} />
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
