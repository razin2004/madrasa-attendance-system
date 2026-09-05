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
  AlertCircle,
  Loader2,
  ShieldCheck,
  Check,
  RefreshCw,
  Send,
  HelpCircle,
  FileText,
  User,
} from 'lucide-react';
import { StaffSidebar } from '@/components/layout/staff-sidebar';
import { StaffMobileNav } from '@/components/layout/staff-mobile-nav';
import { StaffHeader } from '@/components/layout/staff-header';
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentStaff, setCurrentStaff] = useState<any>(null);

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
  const [selectedPeerIds, setSelectedPeerIds] = useState<string[]>([]);
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/org/${organizationCode}/staff/swaps`);
      const data = await res.json();

      if (res.ok && data.success) {
        setCurrentStaff(data.currentStaff);
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

  // Filter colleagues by selected shift pattern
  const filteredColleagues = colleagues.filter((colleague) => {
    if (selectedShiftPatternId === 'ALL') return true;
    return colleague.shiftAssignments?.some(
      (sa) => sa.shiftPattern?.id === selectedShiftPatternId
    );
  });

  const handleTogglePeer = (peerId: string) => {
    setSelectedPeerIds((prev) =>
      prev.includes(peerId) ? prev.filter((id) => id !== peerId) : [...prev, peerId]
    );
  };

  const handleSelectAllFiltered = () => {
    const filteredIds = filteredColleagues.map((c) => c.id);
    const allSelected = filteredIds.every((id) => selectedPeerIds.includes(id));

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

  const handleSignOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    router.push(`/${organizationCode}/login`);
  };

  const isAllFilteredSelected =
    filteredColleagues.length > 0 &&
    filteredColleagues.every((c) => selectedPeerIds.includes(c.id));

  return (
    <div className={styles.container}>
      <StaffSidebar
        organizationCode={organizationCode}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        staffName={currentStaff?.name}
        staffEmail={currentStaff?.staffId}
        onSignOut={handleSignOut}
      />

      <div className={styles.mainContent}>
        <StaffHeader
          organizationCode={organizationCode}
          staffName={currentStaff?.name}
          onSignOut={handleSignOut}
        />

        <main className="pageMainContent" style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
          {/* Top Bar Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Link href={`/${organizationCode}/staff/swaps`} className="btn btn-secondary btn-sm" style={{ padding: '8px' }}>
                <ArrowLeft size={16} />
              </Link>
              <div>
                <h1 className={styles.title} style={{ fontSize: '22px', fontWeight: 800 }}>
                  New Shift Swap Request
                </h1>
                <p className={styles.subtitle} style={{ fontSize: '13px' }}>
                  Select a date, filter by shift, and choose colleagues for shift coverage.
                </p>
              </div>
            </div>

            <Link href={`/${organizationCode}/staff/swaps`} className="btn btn-secondary btn-sm">
              Cancel &amp; Return
            </Link>
          </div>

          {loading ? (
            <div className="glass-card" style={{ padding: '60px', textAlign: 'center' }}>
              <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 12px auto', color: '#818cf8' }} />
              <p style={{ color: 'var(--text-secondary)' }}>Loading shift patterns and colleagues...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* STEP 1: TARGET DATE SELECTION */}
              <div className="glass-card" style={{ padding: '24px', borderRadius: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '14px' }}>
                    1
                  </div>
                  <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                      Select Target Shift Date
                    </h2>
                    <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0 }}>
                      Choose the day you need shift coverage or a substitute colleague.
                    </p>
                  </div>
                </div>

                <div style={{ maxWidth: '320px' }}>
                  <label className="form-label" style={{ fontSize: '12.5px', color: '#ffffff', fontWeight: 600 }}>
                    Target Shift Date
                  </label>
                  <input
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    required
                    className="form-input"
                    style={{ width: '100%', marginTop: '6px', fontSize: '14px', padding: '10px 14px' }}
                  />
                </div>
              </div>

              {/* STEP 2: SHIFT PATTERN SELECTION & FILTERING */}
              <div className="glass-card" style={{ padding: '24px', borderRadius: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '14px' }}>
                    2
                  </div>
                  <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                      Select Target Shift Pattern
                    </h2>
                    <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0 }}>
                      Filter available colleagues by their assigned shift pattern.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
                  {/* Option All Shifts */}
                  <div
                    onClick={() => setSelectedShiftPatternId('ALL')}
                    style={{
                      padding: '14px 16px',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      border: selectedShiftPatternId === 'ALL' ? '2px solid #818cf8' : '1px solid var(--border-subtle)',
                      backgroundColor: selectedShiftPatternId === 'ALL' ? 'rgba(99, 102, 241, 0.14)' : 'rgba(255,255,255,0.02)',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>All Branch Shifts</span>
                      {selectedShiftPatternId === 'ALL' && <CheckCircle2 size={16} color="#818cf8" />}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Show all active organization staff ({colleagues.length} members)
                    </div>
                  </div>

                  {/* Specific Shifts */}
                  {shiftPatterns.map((shift) => {
                    const isSelected = selectedShiftPatternId === shift.id;
                    const shiftStaffCount = colleagues.filter((c) =>
                      c.shiftAssignments?.some((sa) => sa.shiftPattern?.id === shift.id)
                    ).length;

                    return (
                      <div
                        key={shift.id}
                        onClick={() => setSelectedShiftPatternId(shift.id)}
                        style={{
                          padding: '14px 16px',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          border: isSelected ? '2px solid #38bdf8' : '1px solid var(--border-subtle)',
                          backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.14)' : 'rgba(255,255,255,0.02)',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>{shift.name}</span>
                          {isSelected && <CheckCircle2 size={16} color="#38bdf8" />}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {shiftStaffCount} staff members assigned
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* STEP 3: COLLEAGUES MULTI-SELECTION */}
              <div className="glass-card" style={{ padding: '24px', borderRadius: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(52, 211, 153, 0.2)', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '14px' }}>
                      3
                    </div>
                    <div>
                      <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                        Select Colleagues to Request
                      </h2>
                      <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0 }}>
                        Select 1 or multiple colleagues. First colleague to accept gets the shift.
                      </p>
                    </div>
                  </div>

                  {filteredColleagues.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSelectAllFiltered}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '12px', padding: '6px 12px' }}
                    >
                      {isAllFilteredSelected ? 'Deselect All Shift Members' : 'Select All Shift Members'}
                    </button>
                  )}
                </div>

                {filteredColleagues.length === 0 ? (
                  <div style={{ padding: '32px', textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
                    <Users size={28} color="var(--text-muted)" style={{ margin: '0 auto 8px auto' }} />
                    <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}>
                      No active colleagues found assigned to this specific shift pattern.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
                    {filteredColleagues.map((colleague) => {
                      const isSelected = selectedPeerIds.includes(colleague.id);
                      const shiftName = colleague.shiftAssignments?.[0]?.shiftPattern?.name || 'General Shift';

                      return (
                        <div
                          key={colleague.id}
                          onClick={() => handleTogglePeer(colleague.id)}
                          style={{
                            padding: '14px 16px',
                            borderRadius: '12px',
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
                            onChange={() => {}} // handled by parent div click
                            style={{ width: '18px', height: '18px', accentColor: '#34d399', cursor: 'pointer' }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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

              {/* STEP 4: REASON & SUBMIT */}
              <div className="glass-card" style={{ padding: '24px', borderRadius: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(251, 191, 36, 0.2)', color: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '14px' }}>
                    4
                  </div>
                  <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                      Swap Reason &amp; Broadcast Confirmation
                    </h2>
                    <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0 }}>
                      Provide an optional message for your colleagues.
                    </p>
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label className="form-label" style={{ fontSize: '12.5px', color: '#ffffff', fontWeight: 600 }}>
                    Reason for Swap Request (Optional)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Can someone cover my Thursday shift at Kozhikode branch? Urgent personal commitment."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="form-input"
                    style={{ width: '100%', marginTop: '6px', resize: 'vertical' }}
                  />
                </div>

                {/* Selected Summary Pill */}
                <div
                  style={{
                    padding: '14px 18px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    marginBottom: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <ShieldCheck size={20} color="#818cf8" />
                    <div>
                      <strong style={{ fontSize: '14px', color: '#ffffff' }}>
                        {selectedPeerIds.length} {selectedPeerIds.length === 1 ? 'Colleague' : 'Colleagues'} Selected for Broadcast
                      </strong>
                      <div style={{ fontSize: '12px', color: '#c7d2fe', marginTop: '2px' }}>
                        Once 1 colleague accepts, the request locks and forwards to Org Admin for final 1-click approval.
                      </div>
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
                        <span>Send Shift Swap Request</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}
        </main>
      </div>

      <StaffMobileNav organizationCode={organizationCode} />
    </div>
  );
}
