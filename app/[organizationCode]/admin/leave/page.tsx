'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Calendar,
  Filter,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  UserCheck,
  AlertTriangle,
  FileText,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import { OrgAdminSidebar } from '@/components/layout/org-admin-sidebar';
import { OrgAdminMobileNav } from '@/components/layout/org-admin-mobile-nav';
import { useToast } from '@/components/feedback/toast-provider';
import styles from './AdminLeave.module.css';

interface LeaveRequestItem {
  id: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  createdAt: string;
  staff: {
    id: string;
    name: string;
    staffId: string;
  };
}

export default function AdminLeavePage() {
  const params = useParams();
  const organizationCode = (params.organizationCode as string)?.toUpperCase() || '';
  const toast = useToast();

  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<LeaveRequestItem[]>([]);
  const [orgData, setOrgData] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/org/${organizationCode}/branding`)
      .then((r) => r.json())
      .then((data) => {
        if (data.organization) setOrgData(data.organization);
      })
      .catch(() => {});
  }, [organizationCode]);

  const fetchLeaveRequests = async () => {
    setLoading(true);
    try {
      let url = `/api/org/${organizationCode}/leave/admin?status=${statusFilter}`;
      if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok && data.success) {
        setRequests(data.requests || []);
      } else {
        toast.error(data.error || 'Failed to load leave requests.');
      }
    } catch {
      toast.error('Network error loading leave requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaveRequests();
  }, [organizationCode, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLeaveRequests();
  };

  const pendingCount = requests.filter((r) => r.status === 'PENDING').length;
  const approvedCount = requests.filter((r) => r.status === 'APPROVED').length;
  const rejectedCount = requests.filter((r) => r.status === 'REJECTED').length;

  return (
    <div className={styles.pageContainer}>
      <OrgAdminSidebar
        organizationCode={organizationCode}
        organizationName={orgData?.name || 'ShiftGuard'}
        logoUrl={orgData?.logoUrl}
      />

      <div className={styles.mainContent}>
        {/* Header */}
        <header className={styles.header}>
          <div>
            <h1 className="text-xl font-bold text-white m-0">Leave Management</h1>
            <p className="text-xs text-slate-400 m-0 mt-1">
              Review leave requests, monitor staffing coverage, and manage employee leave.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <Link
              href={`/${organizationCode}/admin/leave/manual`}
              className="btn btn-primary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={16} />
              <span>Record Manual Leave</span>
            </Link>
          </div>
        </header>

        {/* Metrics Overview */}
        <div className={styles.metricsGrid}>
          <div className={styles.metricCard} style={{ borderLeft: '3px solid #fbbf24' }}>
            <div className={styles.metricLabel}>Pending Approval</div>
            <div className={styles.metricValue} style={{ color: '#fbbf24' }}>{pendingCount}</div>
          </div>
          <div className={styles.metricCard} style={{ borderLeft: '3px solid #34d399' }}>
            <div className={styles.metricLabel}>Approved Leave</div>
            <div className={styles.metricValue} style={{ color: '#34d399' }}>{approvedCount}</div>
          </div>
          <div className={styles.metricCard} style={{ borderLeft: '3px solid #f87171' }}>
            <div className={styles.metricLabel}>Rejected Requests</div>
            <div className={styles.metricValue} style={{ color: '#f87171' }}>{rejectedCount}</div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className={styles.filterBar}>
          <div style={{ display: 'flex', gap: '6px' }}>
            {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st === 'ALL' ? '' : st)}
                className={`btn btn-sm ${
                  (st === 'ALL' && !statusFilter) || statusFilter === st ? 'btn-primary' : 'btn-secondary'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px', flex: 1, minWidth: '220px' }}>
            <input
              type="text"
              className="form-input"
              style={{ flex: 1, height: '36px', fontSize: '13px' }}
              placeholder="Search staff name or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button type="submit" className="btn btn-secondary btn-sm" style={{ padding: '8px 12px' }}>
              <Search size={14} />
            </button>
          </form>

          <button onClick={fetchLeaveRequests} className="btn btn-secondary btn-sm" style={{ padding: '8px 12px' }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Request Queue Table */}
        <div className={styles.tableCard}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <Loader2 size={32} className="animate-spin" style={{ color: '#818cf8', margin: '0 auto 12px auto' }} />
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading leave requests...</p>
            </div>
          ) : requests.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <Calendar size={36} color="var(--text-muted)" style={{ margin: '0 auto 12px auto' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', margin: '0 0 4px 0' }}>
                No leave requests found
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                No requests matching the selected filter.
              </p>
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Staff Member</th>
                  <th className={styles.th}>Leave Type</th>
                  <th className={styles.th}>Date Range</th>
                  <th className={styles.th}>Duration</th>
                  <th className={styles.th}>Status</th>
                  <th className={styles.th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((item) => (
                  <tr key={item.id}>
                    <td className={styles.td}>
                      <div style={{ fontWeight: 700, color: '#ffffff' }}>{item.staff.name}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#818cf8' }}>
                        ID: {item.staff.staffId}
                      </div>
                    </td>
                    <td className={styles.td}>
                      <span style={{ fontWeight: 600, color: '#f8fafc' }}>{item.leaveType}</span>
                    </td>
                    <td className={styles.td} style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {new Date(item.startDate).toLocaleDateString()} – {new Date(item.endDate).toLocaleDateString()}
                    </td>
                    <td className={styles.td}>
                      <strong style={{ color: '#818cf8' }}>{item.daysCount} days</strong>
                    </td>
                    <td className={styles.td}>
                      <span className={`${styles.statusPill} ${styles[item.status.toLowerCase()]}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className={styles.td}>
                      <Link
                        href={`/${organizationCode}/admin/leave/${item.id}`}
                        className="btn btn-secondary btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <span>Review</span>
                        <ChevronRight size={14} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <OrgAdminMobileNav organizationCode={organizationCode} />
    </div>
  );
}
