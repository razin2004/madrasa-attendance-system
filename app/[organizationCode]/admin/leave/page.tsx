'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
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
  Menu,
  X,
  CalendarDays,
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

import { OrgAdminHeader } from '@/components/layout/org-admin-header';

export default function AdminLeavePage() {
  const params = useParams();
  const organizationCode = (params.organizationCode as string)?.toUpperCase() || '';
  const router = useRouter();
  const toast = useToast();

  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<LeaveRequestItem[]>([]);
  const [orgData, setOrgData] = useState<any>(null);
  const [showMobileFilters, setShowMobileFilters] = useState<boolean>(false);

  // Header Menu Dropdown & Backdrop Listener
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const headerMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node)) {
        setHeaderMenuOpen(false);
      }
    };
    if (headerMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [headerMenuOpen]);

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
        {/* Mobile Header */}
        <OrgAdminHeader
          organizationCode={organizationCode}
          logoUrl={orgData?.logoUrl}
          panelTitle="Leave Management"
          panelSubtitle="Review requests, staffing coverage & employee leave"
          headerMenuOpen={headerMenuOpen}
          onToggleHeaderMenu={() => setHeaderMenuOpen(!headerMenuOpen)}
        >
          {headerMenuOpen && (
            <div
              className={styles.headerMenuDropdown}
              style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 8px)',
                width: '220px',
                backgroundColor: '#0f172a',
                border: '1px solid var(--border-medium, rgba(255,255,255,0.15))',
                borderRadius: '12px',
                padding: '8px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <Link
                href={`/${organizationCode}/admin/leave/manual`}
                className="btn btn-ghost btn-sm"
                style={{ justifyContent: 'flex-start', gap: '8px', width: '100%', textDecoration: 'none', color: '#f8fafc', fontSize: '12.5px' }}
                onClick={() => setHeaderMenuOpen(false)}
              >
                <Plus size={15} color="#818cf8" />
                <span>Record Manual Leave</span>
              </Link>

              <button
                onClick={() => {
                  setHeaderMenuOpen(false);
                  fetchLeaveRequests();
                }}
                className="btn btn-ghost btn-sm"
                style={{ justifyContent: 'flex-start', gap: '8px', width: '100%', color: '#f8fafc', fontSize: '12.5px' }}
              >
                <RefreshCw size={15} color="#10b981" className={loading ? 'animate-spin' : ''} />
                <span>Refresh Requests</span>
              </button>

              <Link
                href={`/${organizationCode}/admin/roster`}
                className="btn btn-ghost btn-sm"
                style={{ justifyContent: 'flex-start', gap: '8px', width: '100%', textDecoration: 'none', color: '#f8fafc', fontSize: '12.5px' }}
                onClick={() => setHeaderMenuOpen(false)}
              >
                <CalendarDays size={15} color="#38bdf8" />
                <span>Roster Calendar</span>
              </Link>
            </div>
          )}
        </OrgAdminHeader>

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

        {/* Filter Bar (Staff Panel Style) */}
        <div className={styles.filterBar}>
          {/* Search Input with Pinned Filter Icon */}
          <div style={{ position: 'relative', width: '300px', maxWidth: '100%' }}>
            <input
              type="text"
              className="form-input"
              style={{
                width: '100%',
                height: '38px',
                fontSize: '13px',
                paddingLeft: '36px',
                paddingRight: search ? '70px' : '42px',
                backgroundColor: 'rgba(15, 23, 42, 0.85)',
                border: '1px solid var(--border-medium)',
                borderRadius: '8px',
                color: '#ffffff',
                boxSizing: 'border-box',
              }}
              placeholder="Search staff name or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  fetchLeaveRequests();
                }
              }}
            />
            <Search
              size={15}
              style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  fetchLeaveRequests();
                }}
                style={{
                  position: 'absolute',
                  right: '40px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '2px',
                }}
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              style={{
                position: 'absolute',
                right: '5px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '30px',
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '6px',
                background: statusFilter !== 'PENDING' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                border: statusFilter !== 'PENDING' ? '1px solid rgba(99, 102, 241, 0.5)' : '1px solid var(--border-medium, rgba(255, 255, 255, 0.12))',
                color: statusFilter !== 'PENDING' ? '#818cf8' : '#ffffff',
                cursor: 'pointer',
              }}
              title="Toggle Filters"
            >
              <Filter size={15} color={statusFilter !== 'PENDING' ? '#818cf8' : 'currentColor'} />
            </button>
          </div>

          {/* Status Chip Tabs (Collapsible on Mobile or toggled via Filter button) */}
          <div className={`${styles.chipTabsContainer} ${showMobileFilters ? styles.chipTabsContainerOpen : ''}`}>
            {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map((st) => (
              <button
                key={st}
                onClick={() => {
                  setStatusFilter(st === 'ALL' ? '' : st);
                  setShowMobileFilters(false);
                }}
                className={`btn btn-sm ${
                  (st === 'ALL' && !statusFilter) || statusFilter === st ? 'btn-primary' : 'btn-secondary'
                }`}
                style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Request Queue Container */}
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
            <>
              {/* Desktop Table View */}
              <div className={styles.desktopTableView}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.th}>Staff Member</th>
                      <th className={styles.th}>Leave Type</th>
                      <th className={styles.th}>Date Range</th>
                      <th className={styles.th}>Duration</th>
                      <th className={styles.th}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((item) => (
                      <tr
                        key={item.id}
                        onClick={() => router.push(`/${organizationCode}/admin/leave/${item.id}`)}
                        style={{ cursor: 'pointer', transition: 'background 0.15s ease' }}
                      >
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card Feed View */}
              <div className={styles.mobileCardFeed}>
                {requests.map((item) => (
                  <div
                    key={item.id}
                    className={styles.leaveCard}
                    onClick={() => router.push(`/${organizationCode}/admin/leave/${item.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className={styles.cardHeader}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <strong style={{ color: '#ffffff', fontSize: '14px' }}>{item.staff.name}</strong>
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '10.5px',
                              fontWeight: 800,
                              padding: '1px 6px',
                              borderRadius: '4px',
                              backgroundColor: 'rgba(99, 102, 241, 0.15)',
                              color: '#818cf8',
                              border: '1px solid rgba(99, 102, 241, 0.25)',
                            }}
                          >
                            {item.staff.staffId}
                          </span>
                        </div>
                      </div>
                      <span className={`${styles.statusPill} ${styles[item.status.toLowerCase()]}`}>
                        {item.status}
                      </span>
                    </div>

                    <div className={styles.stackedInfo}>
                      <div className={styles.stackedCol}>
                        <span className={styles.colLabel}>Leave Type</span>
                        <span className={styles.colVal} style={{ color: '#fbbf24' }}>{item.leaveType}</span>
                      </div>
                      <div className={styles.stackedCol}>
                        <span className={styles.colLabel}>Duration</span>
                        <span className={styles.colVal} style={{ color: '#38bdf8' }}>{item.daysCount} days</span>
                      </div>
                    </div>

                    {item.reason && (
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        &ldquo;{item.reason}&rdquo;
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                        {new Date(item.startDate).toLocaleDateString()} – {new Date(item.endDate).toLocaleDateString()}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#818cf8', fontWeight: 600 }}>
                        <span>Review</span>
                        <ChevronRight size={14} color="#818cf8" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      <OrgAdminMobileNav organizationCode={organizationCode} />
    </div>
  );
}

