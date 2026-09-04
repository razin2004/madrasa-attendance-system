'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Users,
  Plus,
  Search,
  MapPin,
  Smartphone,
  ShieldAlert,
  ShieldCheck,
  Power,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Building,
  Phone,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Mail,
  X,
  Loader2,
  Upload,
  Download,
  FileSpreadsheet,
  Share2,
  Key,
} from 'lucide-react';
import { OrgAdminSidebar } from '@/components/layout/org-admin-sidebar';
import { OrgAdminMobileNav } from '@/components/layout/org-admin-mobile-nav';
import { useToast } from '@/components/feedback/toast-provider';
import { ConfirmationModal } from '@/components/feedback/confirmation-modal';
import { UpdatePasswordModal } from '@/components/staff/update-password-modal';
import { openWhatsAppInvite } from '@/lib/whatsapp';
import styles from './StaffDirectory.module.css';

interface BranchAssignment {
  branch: {
    id: string;
    name: string;
    status: string;
  };
}

interface StaffItem {
  id: string;
  staffId: string;
  name: string;
  phone: string;
  address: string;
  idDocType: string;
  idDocLast4: string | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
    status: 'ACTIVE' | 'INACTIVE' | 'PENDING';
    role: string;
    lastLoginAt: string | null;
  };
  branchAssignments: BranchAssignment[];
  devices: any[];
}

interface OrgBranding {
  id: string;
  name: string;
  logoUrl: string | null;
  organizationCode: string;
}

export default function StaffDirectoryPage() {
  const params = useParams();
  const organizationCode = (params.organizationCode as string)?.toUpperCase() || '';
  const router = useRouter();
  const toast = useToast();

  const [branding, setBranding] = useState<OrgBranding | null>(null);
  const [staffList, setStaffList] = useState<StaffItem[]>([]);
  const [counts, setCounts] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    deviceRegistered: 0,
    deviceResetRequired: 0,
  });
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE' | 'DEVICE_REGISTERED' | 'RESET_REQUIRED'>('ALL');
  const [search, setSearch] = useState('');
  const [toggleStaff, setToggleStaff] = useState<StaffItem | null>(null);
  const [resendingStaffId, setResendingStaffId] = useState<string | null>(null);
  const [whatsappLoadingId, setWhatsappLoadingId] = useState<string | null>(null);
  const [passwordModalStaff, setPasswordModalStaff] = useState<StaffItem | null>(null);

  const handleResendInvite = async (staffId: string, email: string) => {
    try {
      setResendingStaffId(staffId);
      const res = await fetch(`/api/org/${organizationCode}/staff/${staffId}/resend-invite`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || `Login email resent to ${email}`);
      } else {
        toast.error(data.error || 'Failed to resend login invitation email.');
      }
    } catch {
      toast.error('Network error resending login email.');
    } finally {
      setResendingStaffId(null);
    }
  };

  const handleWhatsAppInvite = async (staff: StaffItem) => {
    try {
      setWhatsappLoadingId(staff.id);
      const res = await fetch(`/api/org/${organizationCode}/staff/${staff.id}/resend-invite`, {
        method: 'POST',
      });
      const data = await res.json();
      const activationUrl = data.success ? data.activationUrl : undefined;
      
      openWhatsAppInvite({
        phone: staff.phone,
        staffName: staff.name,
        orgName: branding?.name || 'Organization',
        organizationCode,
        staffId: staff.staffId,
        email: staff.user.email,
        activationUrl,
      });

      if (data.success && activationUrl) {
        try {
          await navigator.clipboard.writeText(activationUrl);
          toast.success(`WhatsApp invite opened & setup link copied for ${staff.name}!`);
        } catch {
          toast.success(`WhatsApp invite opened for ${staff.name}`);
        }
      } else {
        toast.info(`WhatsApp invite opened for ${staff.name}`);
      }
    } catch {
      toast.error('Failed to prepare WhatsApp invite link.');
    } finally {
      setWhatsappLoadingId(null);
    }
  };
  const [toggleLoading, setToggleLoading] = useState(false);

  // Bulk CSV Import Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<Array<any>>([]);
  const [importingCsv, setImportingCsv] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<any | null>(null);

  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    setImportError(null);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r\n|\n/);
      if (lines.length <= 1) {
        setImportError('CSV file appears to be empty or missing headers.');
        setParsedRows([]);
        return;
      }

      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
      const rows: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = line.split(',').map((v) => v.trim());
        const rowObj: any = {};

        headers.forEach((h, idx) => {
          const val = values[idx] || '';
          if (h.includes('name') && !h.includes('branch')) rowObj.name = val;
          else if (h.includes('email')) rowObj.email = val;
          else if (h.includes('staffid') || h.includes('staff_id') || (h.includes('id') && !h.includes('doc'))) rowObj.staffId = val;
          else if (h.includes('phone') || h.includes('mobile')) rowObj.phone = val;
          else if (h.includes('address')) rowObj.address = val;
          else if (h.includes('doctype') || h.includes('idtype') || h.includes('doc_type')) rowObj.idDocType = val;
          else if (h.includes('last4') || h.includes('last_4') || h.includes('idlast4')) rowObj.idDocLast4 = val;
          else if (h.includes('branch')) rowObj.branchName = val;
          else if (h.includes('role')) rowObj.role = val;
        });

        if (rowObj.name || rowObj.email) {
          rows.push(rowObj);
        }
      }

      setParsedRows(rows);
    };
    reader.readAsText(file);
  };

  const downloadSampleCSV = () => {
    const csvContent =
      'Name,Email,StaffID,Phone,Address,IDDocType,IDDocLast4,BranchName,Role\n' +
      'John Doe,john.doe@organization.com,STF-1001,+919876543210,"123 Main Street",AADHAAR,5482,Main Branch,STAFF\n' +
      'Sarah Smith,sarah.smith@organization.com,,,,,VOTER_ID,1234,,STAFF\n' +
      'Alex Johnson,alex.j@organization.com,,,,,,,,STAFF\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'staff_bulk_import_sample.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBulkImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedRows.length === 0) {
      setImportError('Please select a valid CSV file with staff data.');
      return;
    }

    setImportingCsv(true);
    setImportError(null);

    try {
      const res = await fetch(`/api/org/${organizationCode}/staff/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: parsedRows }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || 'Staff import completed successfully!');
        setImportResult(data);
        fetchInitialData();
      } else {
        setImportError(data.error || 'Failed to complete CSV import.');
      }
    } catch {
      setImportError('Network error uploading CSV data.');
    } finally {
      setImportingCsv(false);
    }
  };

  useEffect(() => {
    if (organizationCode) {
      fetchInitialData();
    }
  }, [organizationCode]);

  const fetchInitialData = async (quiet = false) => {
    try {
      if (!quiet) setLoading(true);
      setHasError(false);

      const brandRes = await fetch(`/api/org/${organizationCode}/branding`);
      const brandData = await brandRes.json();
      if (brandData.success) {
        setBranding(brandData.organization);
      }

      const staffRes = await fetch(`/api/org/${organizationCode}/staff`);
      const staffData = await staffRes.json();
      if (staffData.success) {
        setStaffList(staffData.staff);
        setCounts(staffData.counts);
      } else {
        setHasError(true);
        toast.error(staffData.error || 'Failed to load staff list.');
      }
    } catch {
      setHasError(true);
      toast.error('Network error loading staff directory.');
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!toggleStaff) return;
    try {
      setToggleLoading(true);
      const res = await fetch(
        `/api/org/${organizationCode}/staff/${toggleStaff.id}/toggle-status`,
        { method: 'POST' }
      );
      const data = await res.json();
      if (data.success) {
        toast.success(
          toggleStaff.user.status === 'ACTIVE'
            ? 'Staff account deactivated.'
            : 'Staff account activated.'
        );
        setToggleStaff(null);
        fetchInitialData();
      } else {
        toast.error(data.error || 'Failed to update status.');
      }
    } catch {
      toast.error('Network error updating status.');
    } finally {
      setToggleLoading(false);
    }
  };

  const filteredStaff = staffList.filter((s) => {
    if (filter === 'ACTIVE' && s.user.status !== 'ACTIVE') return false;
    if (filter === 'INACTIVE' && s.user.status !== 'INACTIVE') return false;
    if (filter === 'DEVICE_REGISTERED' && !s.devices?.some((d: any) => d.status === 'REGISTERED')) return false;
    if (filter === 'RESET_REQUIRED' && !s.devices?.some((d: any) => d.status === 'RESET_REQUIRED')) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchBranch = s.branchAssignments.some((b) => b.branch.name.toLowerCase().includes(q));
      return (
        s.staffId.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.user.email.toLowerCase().includes(q) ||
        s.phone.toLowerCase().includes(q) ||
        matchBranch
      );
    }
    return true;
  });

  const getInitials = (nameStr: string) => {
    const parts = nameStr.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return nameStr.slice(0, 2).toUpperCase();
  };

  return (
    <div className={styles.container}>
      {/* Desktop Sidebar */}
      <OrgAdminSidebar
        organizationCode={organizationCode}
        organizationName={branding?.name || 'Organization'}
        logoUrl={branding?.logoUrl}
        staffCount={counts.total}
      />

      {/* Main Content Area */}
      <div className={styles.mainContent}>
        {/* Top Header */}
        <header className={styles.headerBar}>
          <div>
            <h1 className={styles.title}>Staff</h1>
            <p className={styles.subtitle}>
              Manage staff accounts, branch assignments, schedules, and registered devices.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={fetchInitialData}
              disabled={loading}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>

            <button
              onClick={() => {
                setCsvFile(null);
                setParsedRows([]);
                setImportError(null);
                setImportResult(null);
                setShowImportModal(true);
              }}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Upload size={14} />
              <span>Import via CSV</span>
            </button>

            <Link
              href={`/${organizationCode}/admin/staff/new`}
              className="btn btn-primary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={16} />
              <span>Add Staff Member</span>
            </Link>
          </div>
        </header>

        {/* Content Body */}
        <main className="pageMainContent" style={{ maxWidth: '1280px' }}>
          {/* Filters & Search */}
          <div className={styles.filterSearchRow}>
            {/* Filter Tabs */}
            <div className={styles.tabsGroup}>
              {[
                { id: 'ALL', label: `All Staff (${counts.total})` },
                { id: 'ACTIVE', label: `Active (${counts.active})` },
                { id: 'DEVICE_REGISTERED', label: `Device Bound (${counts.deviceRegistered})` },
                { id: 'RESET_REQUIRED', label: `Reset Req (${counts.deviceResetRequired})` },
                { id: 'INACTIVE', label: `Inactive (${counts.inactive})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id as any)}
                  className={`${styles.tabButton} ${filter === tab.id ? styles.tabButtonActive : ''}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className={styles.searchInputWrapper}>
              <Search size={15} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search staff by name, ID, or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={styles.searchInput}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '9px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* ERROR STATE */}
          {hasError && !loading && (
            <div className="glass-card" style={{ padding: '40px', textAlign: 'center', margin: '20px 0' }}>
              <AlertCircle size={36} color="var(--danger-text)" style={{ margin: '0 auto 12px auto' }} />
              <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#ffffff' }}>
                Unable to load staff members
              </h3>
              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginTop: '4px', marginBottom: '20px' }}>
                There was an error communicating with the staff management server.
              </p>
              <button onClick={fetchInitialData} className="btn btn-primary btn-sm">
                Try Again
              </button>
            </div>
          )}

          {/* LOADING STATE SKELETON */}
          {loading && (
            <div className="glass-card" style={{ padding: '48px 24px', textAlign: 'center' }}>
              <Loader2 size={32} className="animate-spin" style={{ color: '#818cf8', margin: '0 auto 12px auto' }} />
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                Loading workforce directory...
              </div>
            </div>
          )}

          {/* EMPTY STATE - NO STAFF MEMBER */}
          {!loading && !hasError && staffList.length === 0 && (
            <div className="glass-card" style={{ padding: '48px 24px', textAlign: 'center' }}>
              <Users size={40} color="#818cf8" style={{ margin: '0 auto 16px auto', opacity: 0.8 }} />
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff' }}>
                No staff members yet
              </h3>
              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', maxWidth: '440px', margin: '8px auto 24px auto', lineHeight: '1.5' }}>
                Add your first staff member to begin assigning workplace branches, shift schedules, and verifying attendance.
              </p>
              <Link href={`/${organizationCode}/admin/staff/new`} className="btn btn-primary">
                Add Staff Member
              </Link>
            </div>
          )}

          {/* EMPTY STATE - NO SEARCH MATCHES */}
          {!loading && !hasError && staffList.length > 0 && filteredStaff.length === 0 && (
            <div className="glass-card" style={{ padding: '40px 24px', textAlign: 'center' }}>
              <Search size={32} color="var(--text-muted)" style={{ margin: '0 auto 12px auto' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>
                No staff members match your search
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', marginBottom: '16px' }}>
                Try searching for a different staff member name, ID, or email address.
              </p>
              <button onClick={() => { setSearch(''); setFilter('ALL'); }} className="btn btn-secondary btn-sm">
                Clear Filters
              </button>
            </div>
          )}

          {/* DESKTOP DATA TABLE */}
          {!loading && !hasError && filteredStaff.length > 0 && (
            <>
              <div className={`${styles.tableDesktop} glass-card`}>
                <table style={{ width: '100%', minWidth: '950px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                      <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '11.5px', textTransform: 'uppercase' }}>
                        Staff Member
                      </th>
                      <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '11.5px', textTransform: 'uppercase' }}>
                        Account Email
                      </th>
                      <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '11.5px', textTransform: 'uppercase' }}>
                        Assigned Branches
                      </th>
                      <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '11.5px', textTransform: 'uppercase' }}>
                        Status
                      </th>
                      <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '11.5px', textTransform: 'uppercase' }}>
                        Layer 3 Device
                      </th>
                      <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '11.5px', textTransform: 'uppercase', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStaff.map((staff) => {
                      const isPending = staff.user.status === 'PENDING';
                      const isActive = staff.user.status === 'ACTIVE';

                      return (
                        <tr
                          key={staff.id}
                          style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.15s ease' }}
                        >
                          {/* Staff Name & ID */}
                          <td style={{ padding: '16px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div className={styles.avatarBadge}>
                                {getInitials(staff.name)}
                              </div>
                              <div>
                                <div style={{ fontWeight: 700, color: '#ffffff' }}>{staff.name}</div>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#818cf8', marginTop: '1px' }}>
                                  ID: {staff.staffId}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Email */}
                          <td style={{ padding: '16px 20px', color: 'var(--text-secondary)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px' }}>
                              <Mail size={13} color="var(--text-muted)" />
                              <span>{staff.user.email}</span>
                            </div>
                            {staff.phone && (
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                Phone: {staff.phone}
                              </div>
                            )}
                          </td>

                          {/* Assigned Branches */}
                          <td style={{ padding: '16px 20px' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {staff.branchAssignments.length > 0 ? (
                                staff.branchAssignments.map((b) => (
                                  <span
                                    key={b.branch.id}
                                    style={{
                                      fontSize: '11px',
                                      padding: '2px 8px',
                                      borderRadius: '4px',
                                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                      border: '1px solid var(--border-subtle)',
                                      color: '#f8fafc',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                    }}
                                  >
                                    <MapPin size={10} color="#818cf8" />
                                    <span>{b.branch.name}</span>
                                  </span>
                                ))
                              ) : (
                                <span style={{ fontSize: '11.5px', color: 'var(--warning-text)' }}>
                                  No branch assigned
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Status */}
                          <td style={{ padding: '16px 20px' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '3px 10px',
                                borderRadius: '9999px',
                                fontSize: '11.5px',
                                fontWeight: 700,
                                backgroundColor: isPending ? 'rgba(245, 158, 11, 0.15)' : isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                color: isPending ? '#fbbf24' : isActive ? '#34d399' : '#f87171',
                                border: `1px solid ${isPending ? 'rgba(245, 158, 11, 0.3)' : isActive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                              }}
                            >
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isPending ? '#fbbf24' : isActive ? '#34d399' : '#f87171' }} />
                              {isPending ? 'SETUP PENDING' : isActive ? 'ACTIVE' : 'INACTIVE'}
                            </span>
                          </td>

                          {/* Device Status */}
                          <td style={{ padding: '16px 20px' }}>
                            {staff.devices?.some((d: any) => d.status === 'REGISTERED') ? (
                              <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#34d399', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <CheckCircle2 size={13} />
                                <span>1 Device Bound</span>
                              </span>
                            ) : staff.devices?.some((d: any) => d.status === 'RESET_REQUIRED') ? (
                              <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#fbbf24', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <AlertTriangle size={13} />
                                <span>Reset Required</span>
                              </span>
                            ) : (
                              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                — Not Registered
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td style={{ padding: '16px 20px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                              {isPending ? (
                                <>
                                  <button
                                    onClick={() => handleResendInvite(staff.id, staff.user.email)}
                                    disabled={resendingStaffId === staff.id}
                                    className="btn btn-secondary btn-sm"
                                    style={{ padding: '8px', borderRadius: '8px', color: '#38bdf8' }}
                                    title="Resend Activation & Login Email"
                                  >
                                    {resendingStaffId === staff.id ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}
                                  </button>
                                  <button
                                    onClick={() => handleWhatsAppInvite(staff)}
                                    disabled={whatsappLoadingId === staff.id}
                                    className="btn btn-secondary btn-sm"
                                    style={{ padding: '8px', borderRadius: '8px', color: '#25D366', borderColor: 'rgba(37, 211, 102, 0.3)' }}
                                    title="Share Password Setup Invite via WhatsApp"
                                  >
                                    {whatsappLoadingId === staff.id ? <Loader2 size={15} className="animate-spin" /> : <Share2 size={15} />}
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => setPasswordModalStaff(staff)}
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: '8px', borderRadius: '8px', color: '#c084fc', borderColor: 'rgba(192, 132, 252, 0.3)' }}
                                  title="Update Staff Password"
                                >
                                  <Key size={15} />
                                </button>
                              )}
                              <Link
                                href={`/${organizationCode}/admin/staff/${staff.id}`}
                                className="btn btn-primary btn-sm"
                                style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '12.5px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                title="View Staff Profile & Security Controls"
                              >
                                <span>Profile</span>
                                <ChevronRight size={14} />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* MOBILE RESPONSIVE CARDS */}
              <div className={styles.cardsMobile}>
                {filteredStaff.map((staff) => {
                  const isPending = staff.user.status === 'PENDING';
                  const isActive = staff.user.status === 'ACTIVE';

                  return (
                    <div key={staff.id} className={styles.mobileCard}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div className={styles.avatarBadge}>{getInitials(staff.name)}</div>
                          <div>
                            <div style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff' }}>{staff.name}</div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#818cf8' }}>ID: {staff.staffId}</div>
                          </div>
                        </div>

                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: isPending ? 'rgba(245, 158, 11, 0.15)' : isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: isPending ? '#fbbf24' : isActive ? '#34d399' : '#f87171',
                            border: `1px solid ${isPending ? 'rgba(245, 158, 11, 0.3)' : isActive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                          }}
                        >
                          {isPending ? 'SETUP PENDING' : isActive ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </div>

                      <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Mail size={13} color="var(--text-muted)" />
                          <span>{staff.user.email}</span>
                        </div>
                        {staff.branchAssignments.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                            <MapPin size={13} color="#818cf8" />
                            <span>{staff.branchAssignments.map((b) => b.branch.name).join(', ')}</span>
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)', marginTop: '12px' }}>
                        <div>
                          {staff.devices?.some((d: any) => d.status === 'REGISTERED') ? (
                            <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#34d399', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <CheckCircle2 size={13} />
                              <span>1 Device Bound</span>
                            </span>
                          ) : staff.devices?.some((d: any) => d.status === 'RESET_REQUIRED') ? (
                            <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#fbbf24', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <AlertTriangle size={13} />
                              <span>Reset Required</span>
                            </span>
                          ) : (
                            <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                              — Not Registered
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {isPending ? (
                            <>
                              <button
                                onClick={() => handleResendInvite(staff.id, staff.user.email)}
                                disabled={resendingStaffId === staff.id}
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '8px', borderRadius: '8px', color: '#38bdf8' }}
                                title="Resend Activation Email"
                              >
                                {resendingStaffId === staff.id ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                              </button>
                              <button
                                onClick={() => handleWhatsAppInvite(staff)}
                                disabled={whatsappLoadingId === staff.id}
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '8px', borderRadius: '8px', color: '#25D366', borderColor: 'rgba(37, 211, 102, 0.3)' }}
                                title="Share WhatsApp Invite"
                              >
                                {whatsappLoadingId === staff.id ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setPasswordModalStaff(staff)}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '8px', borderRadius: '8px', color: '#c084fc', borderColor: 'rgba(192, 132, 252, 0.3)' }}
                              title="Update Password"
                            >
                              <Key size={14} />
                            </button>
                          )}
                          <Link
                            href={`/${organizationCode}/admin/staff/${staff.id}`}
                            className="btn btn-primary btn-sm"
                            style={{ padding: '6px 12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px', borderRadius: '8px' }}
                          >
                            <span>Profile</span>
                            <ChevronRight size={13} />
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </main>
      </div>

      {/* Status Confirmation Modal */}
      <ConfirmationModal
        isOpen={Boolean(toggleStaff)}
        onClose={() => setToggleStaff(null)}
        onConfirm={handleToggleStatus}
        title={toggleStaff?.user.status === 'ACTIVE' ? 'Deactivate staff account?' : 'Activate staff account?'}
        message={
          toggleStaff?.user.status === 'ACTIVE'
            ? `Deactivating ${toggleStaff?.name} (${toggleStaff?.staffId}) will prevent login and attendance recording. Historical records remain preserved.`
            : `Re-activate ${toggleStaff?.name} (${toggleStaff?.staffId}) to restore login and attendance eligibility.`
        }
        confirmText={toggleStaff?.user.status === 'ACTIVE' ? 'Deactivate Account' : 'Activate Account'}
        variant={toggleStaff?.user.status === 'ACTIVE' ? 'danger' : 'primary'}
      />

      {/* BULK CSV STAFF IMPORT MODAL */}
      {showImportModal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 999999, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '640px', padding: '28px', backgroundColor: '#0d121f', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileSpreadsheet size={22} color="#818cf8" />
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                  Bulk Staff CSV Import
                </h3>
              </div>
              <button onClick={() => setShowImportModal(false)} className="btn btn-ghost btn-sm" style={{ padding: '4px' }}>
                <X size={18} />
              </button>
            </div>

            {importError && (
              <div style={{ backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger-text)', padding: '10px 14px', borderRadius: '8px', fontSize: '12.5px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={16} />
                <span>{importError}</span>
              </div>
            )}

            {importResult ? (
              <div style={{ padding: '16px 0' }}>
                <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '16px', borderRadius: '10px', marginBottom: '20px' }}>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#34d399', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle2 size={18} />
                    <span>Import Completed Successfully!</span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#f8fafc', marginTop: '6px' }}>
                    <strong>{importResult.importedCount}</strong> staff members successfully created.
                    {importResult.skippedCount > 0 && <span> ({importResult.skippedCount} rows skipped)</span>}
                  </div>
                </div>

                {importResult.errors && importResult.errors.length > 0 && (
                  <div style={{ marginBottom: '20px' }}>
                    <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#f87171', marginBottom: '8px' }}>Skipped Rows &amp; Errors:</h4>
                    <div style={{ maxHeight: '160px', overflowY: 'auto', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '8px 12px', border: '1px solid var(--border-subtle)' }}>
                      {importResult.errors.map((err: any, i: number) => (
                        <div key={i} style={{ fontSize: '12px', color: 'var(--text-secondary)', padding: '4px 0', borderBottom: i < importResult.errors.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                          Row {err.row}: {err.email ? <strong>{err.email}</strong> : ''} — <span style={{ color: '#f87171' }}>{err.reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowImportModal(false)} className="btn btn-primary btn-sm">
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleBulkImportSubmit}>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 12px 0', lineHeight: 1.5 }}>
                  Upload a CSV file containing staff profiles. All supported columns: <strong>Name, Email, StaffID, Phone, Address, IDDocType, IDDocLast4, BranchName, Role</strong>.
                </p>

                <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.25)', fontSize: '12px', color: '#c7d2fe', marginBottom: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div>📌 <strong>Mandatory Columns:</strong> <code>Name</code> &amp; <code>Email</code></div>
                  <div>💡 <strong>Optional Columns:</strong> <code>StaffID</code>, <code>Phone</code>, <code>Address</code>, <code>IDDocType</code>, <code>IDDocLast4</code>, <code>BranchName</code>, <code>Role</code> (Leaving any optional cell empty is completely fine!).</div>
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px' }}>
                  <button
                    type="button"
                    onClick={downloadSampleCSV}
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
                  >
                    <Download size={14} />
                    <span>Download Sample Template CSV</span>
                  </button>
                </div>

                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label className="form-label">Select CSV File *</label>
                  <input
                    type="file"
                    accept=".csv, text/csv"
                    onChange={handleCsvFileChange}
                    className="form-input"
                    required
                  />
                </div>

                {parsedRows.length > 0 && (
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#38bdf8', marginBottom: '8px' }}>
                      Parsed Preview ({parsedRows.length} Rows Detected):
                    </div>
                    <div style={{ maxHeight: '160px', overflowY: 'auto', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                      <table style={{ width: '100%', fontSize: '11.5px', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                            <th style={{ padding: '8px' }}>#</th>
                            <th style={{ padding: '8px' }}>Name</th>
                            <th style={{ padding: '8px' }}>Email</th>
                            <th style={{ padding: '8px' }}>Branch</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parsedRows.slice(0, 10).map((r, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              <td style={{ padding: '6px 8px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                              <td style={{ padding: '6px 8px', fontWeight: 700, color: '#ffffff' }}>{r.name || '—'}</td>
                              <td style={{ padding: '6px 8px', color: 'var(--text-secondary)' }}>{r.email || '—'}</td>
                              <td style={{ padding: '6px 8px', color: '#818cf8' }}>{r.branchName || 'Default'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button type="button" onClick={() => setShowImportModal(false)} className="btn btn-secondary btn-sm">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={importingCsv || parsedRows.length === 0}
                    className="btn btn-primary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    {importingCsv ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Importing {parsedRows.length} Staff...</span>
                      </>
                    ) : (
                      <>
                        <Upload size={14} />
                        <span>Upload &amp; Import ({parsedRows.length} Staff)</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Update Password Modal */}
      <UpdatePasswordModal
        isOpen={Boolean(passwordModalStaff)}
        onClose={() => setPasswordModalStaff(null)}
        organizationCode={organizationCode}
        orgName={branding?.name}
        staff={
          passwordModalStaff
            ? {
                id: passwordModalStaff.id,
                staffId: passwordModalStaff.staffId,
                name: passwordModalStaff.name,
                email: passwordModalStaff.user.email,
                phone: passwordModalStaff.phone,
              }
            : null
        }
        onSuccess={() => fetchInitialData(true)}
      />

      {/* Mobile Navigation */}
      <OrgAdminMobileNav organizationCode={organizationCode} />
    </div>
  );
}
