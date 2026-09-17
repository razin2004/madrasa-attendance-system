'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Loader2,
  Lock,
  Layers,
} from 'lucide-react';
import { OrgAdminSidebar } from '@/components/layout/org-admin-sidebar';
import { OrgAdminHeader } from '@/components/layout/org-admin-header';
import { OrgAdminMobileNav } from '@/components/layout/org-admin-mobile-nav';
import { useToast } from '@/components/feedback/toast-provider';
import { ConfirmationModal } from '@/components/feedback/confirmation-modal';
import styles from './LeaveRules.module.css';

export default function AdminLeaveRulesPage() {
  const params = useParams();
  const organizationCode = (params.organizationCode as string)?.toUpperCase() || '';
  const toast = useToast();

  const [branding, setBranding] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<any[]>([]);
  const [deleteRuleId, setDeleteRuleId] = useState<string | null>(null);

  // New Rule Form State
  const [title, setTitle] = useState('');
  const [ruleType, setRuleType] = useState<'ALLOWED_WINDOW' | 'BLACKOUT_PERIOD'>('ALLOWED_WINDOW');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [leaveType, setLeaveType] = useState('ALL');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [brandRes, rulesRes] = await Promise.all([
        fetch(`/api/org/${organizationCode}/branding`),
        fetch(`/api/org/${organizationCode}/leave/restrictions`),
      ]);

      const brandData = await brandRes.json();
      if (brandData.success) {
        setBranding(brandData.organization);
      }

      const rulesData = await rulesRes.json();
      if (rulesRes.ok && rulesData.success) {
        setRules(rulesData.rules || []);
      } else {
        toast.error(rulesData.error || 'Failed to load leave restriction rules.');
      }
    } catch {
      toast.error('Network error loading rules.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, [organizationCode]);

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startDate || !endDate) {
      toast.error('Please enter a title, start date, and end date.');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      toast.error('Start date cannot be after end date.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/org/${organizationCode}/admin/leave/restrictions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          ruleType,
          startDate,
          endDate,
          leaveType,
          description: description.trim() || null,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || 'Rule created successfully!');
        setTitle('');
        setStartDate('');
        setEndDate('');
        setDescription('');
        fetchInitialData();
      } else {
        toast.error(data.error || 'Failed to create rule.');
      }
    } catch {
      toast.error('Network error creating rule.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRule = async () => {
    if (!deleteRuleId) return;
    try {
      const res = await fetch(`/api/org/${organizationCode}/admin/leave/restrictions/${deleteRuleId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Rule removed successfully.');
        setDeleteRuleId(null);
        fetchInitialData();
      } else {
        toast.error(data.error || 'Failed to remove rule.');
      }
    } catch {
      toast.error('Network error removing rule.');
    }
  };

  return (
    <div className={styles.container}>
      {/* Sidebar */}
      <OrgAdminSidebar
        organizationCode={organizationCode}
        organizationName={branding?.name || 'Organization'}
        logoUrl={branding?.logoUrl}
      />

      {/* Main Container */}
      <div className={styles.mainContent}>
        {/* Sticky Header */}
        <OrgAdminHeader
          organizationCode={organizationCode}
          logoUrl={branding?.logoUrl}
          panelTitle="Leave Date Restriction & Blackout Rules"
          panelSubtitle="Configure allowed application windows and blackout periods for employee leave"
          backHref={`/${organizationCode}/admin/leave`}
        />

        {/* Content Body */}
        <main className={styles.contentBody}>
          <div className={styles.pageSubHeader}>
            <h1 className={styles.pageTitle}>
              Leave Application Date Windows &amp; Blackouts
            </h1>
            <p className={styles.pageDescription}>
              Set specific dates or date ranges when leave applications are accepted or restricted.
            </p>
          </div>

          <div className={styles.grid}>
            {/* Create Rule Form Card */}
            <div className={styles.card}>
              <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={18} color="#818cf8" />
                <span>Configure New Date Rule</span>
              </h2>

              <form onSubmit={handleCreateRule}>
                {/* Rule Type Selector */}
                <div style={{ marginBottom: '16px' }}>
                  <label className="form-label">Rule Type *</label>
                  <div className={styles.ruleTypeGrid}>
                    <div
                      onClick={() => setRuleType('ALLOWED_WINDOW')}
                      style={{
                        padding: '12px',
                        borderRadius: '10px',
                        border: `1px solid ${ruleType === 'ALLOWED_WINDOW' ? '#10b981' : 'rgba(255,255,255,0.1)'}`,
                        backgroundColor: ruleType === 'ALLOWED_WINDOW' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255,255,255,0.02)',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ fontSize: '13px', fontWeight: 800, color: ruleType === 'ALLOWED_WINDOW' ? '#34d399' : '#94a3b8' }}>
                        🟢 Allowed Window
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                        Leave accepted only within this range
                      </div>
                    </div>

                    <div
                      onClick={() => setRuleType('BLACKOUT_PERIOD')}
                      style={{
                        padding: '12px',
                        borderRadius: '10px',
                        border: `1px solid ${ruleType === 'BLACKOUT_PERIOD' ? '#ef4444' : 'rgba(255,255,255,0.1)'}`,
                        backgroundColor: ruleType === 'BLACKOUT_PERIOD' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(255,255,255,0.02)',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ fontSize: '13px', fontWeight: 800, color: ruleType === 'BLACKOUT_PERIOD' ? '#f87171' : '#94a3b8' }}>
                        🔴 Blackout Period
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                        Leave prohibited during this range
                      </div>
                    </div>
                  </div>
                </div>

                {/* Title */}
                <div style={{ marginBottom: '14px' }}>
                  <label className="form-label">Rule Title *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Summer Leave Window or Q4 Blackout"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    style={{ width: '100%' }}
                    required
                  />
                </div>

                {/* Leave Category Selector */}
                <div style={{ marginBottom: '14px' }}>
                  <label className="form-label">Applicable Leave Type</label>
                  <select
                    className="form-input"
                    value={leaveType}
                    onChange={(e) => setLeaveType(e.target.value)}
                    style={{ width: '100%', backgroundColor: '#0f172a', color: '#ffffff' }}
                  >
                    <option value="ALL">All Leave Types</option>
                    <option value="ANNUAL">Annual Leave Only</option>
                    <option value="SICK">Sick Leave Only</option>
                    <option value="DUTY">Duty Leave Only</option>
                    <option value="OTHER">Casual / Other Leave Only</option>
                  </select>
                </div>

                {/* Start & End Dates */}
                <div className={styles.dateGrid} style={{ marginBottom: '14px' }}>
                  <div>
                    <label className="form-label">Start Date *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      style={{ width: '100%', colorScheme: 'dark', backgroundColor: '#0f172a' }}
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">End Date *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      style={{ width: '100%', colorScheme: 'dark', backgroundColor: '#0f172a' }}
                      required
                    />
                  </div>
                </div>

                {/* Description */}
                <div style={{ marginBottom: '20px' }}>
                  <label className="form-label">Internal Notes / Context</label>
                  <textarea
                    className="form-input"
                    style={{ height: '70px', width: '100%' }}
                    placeholder="Optional guidance or explanation for staff..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '12px', fontSize: '13.5px', fontWeight: 700 }}
                >
                  {submitting ? 'Saving Rule...' : 'Save & Activate Rule'}
                </button>
              </form>
            </div>

            {/* Active Rules List Card */}
            <div className={styles.card}>
              <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={18} color="#34d399" />
                <span>Active Leave Date Rules ({rules.length})</span>
              </h2>

              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <Loader2 size={30} className="animate-spin" style={{ color: '#818cf8', margin: '0 auto 8px auto' }} />
                  <p style={{ fontSize: '13px', color: '#94a3b8' }}>Loading rules...</p>
                </div>
              ) : rules.length === 0 ? (
                <div style={{ padding: '30px 16px', textAlign: 'center', color: '#94a3b8', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '12px' }}>
                  <Calendar size={32} style={{ margin: '0 auto 8px auto', color: '#64748b' }} />
                  <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '14px' }}>No Active Date Restrictions</div>
                  <p style={{ fontSize: '12.5px', margin: '4px 0 0 0' }}>
                    Employees can apply for leave on any date. Create a rule on the left to set specific allowed windows or blackout periods.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {rules.map((rule) => {
                    const isBlackout = rule.ruleType === 'BLACKOUT_PERIOD';
                    return (
                      <div
                        key={rule.id}
                        style={{
                          padding: '16px',
                          borderRadius: '12px',
                          backgroundColor: isBlackout ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                          border: `1px solid ${isBlackout ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <div style={{ fontWeight: 800, fontSize: '14.5px', color: '#ffffff' }}>
                            {rule.title}
                          </div>
                          <span className={`badge ${isBlackout ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: '11px', flexShrink: 0 }}>
                            {isBlackout ? '🔴 Blackout Period' : '🟢 Allowed Window'}
                          </span>
                        </div>

                        <div style={{ fontSize: '12.5px', color: '#cbd5e1', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Calendar size={13} color="#818cf8" />
                          <span>
                            {new Date(rule.startDate).toLocaleDateString(undefined, { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })} – {new Date(rule.endDate).toLocaleDateString(undefined, { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>

                        <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                          Applies to: <strong style={{ color: '#ffffff' }}>{rule.leaveType}</strong> leave
                        </div>

                        {rule.description && (
                          <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', background: 'rgba(0,0,0,0.3)', padding: '6px 10px', borderRadius: '6px' }}>
                            &ldquo;{rule.description}&rdquo;
                          </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                          <button
                            onClick={() => setDeleteRuleId(rule.id)}
                            className="btn btn-ghost btn-xs"
                            style={{ color: '#f87171', fontSize: '11.5px', padding: '4px 8px' }}
                          >
                            <Trash2 size={13} style={{ marginRight: '4px' }} /> Delete Rule
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Confirmation Modal for Rule Deletion */}
      <ConfirmationModal
        isOpen={Boolean(deleteRuleId)}
        onClose={() => setDeleteRuleId(null)}
        onConfirm={handleDeleteRule}
        title="Remove Restriction Rule?"
        message="Are you sure you want to delete this leave restriction rule? Staff members will no longer be restricted by this date window."
        confirmText="Delete Rule"
        variant="danger"
      />

      {/* Mobile Navigation Drawer */}
      <OrgAdminMobileNav organizationCode={organizationCode} />
    </div>
  );
}
