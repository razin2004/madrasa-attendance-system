'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Users,
  MapPin,
  Smartphone,
  ShieldCheck,
  ShieldAlert,
  Edit2,
  Key,
  RefreshCw,
  Power,
  CheckCircle2,
  AlertTriangle,
  Clock,
  User as UserIcon,
  Building,
  Phone,
  Calendar,
  Check,
  Mail,
  Loader2,
  X,
  FileText,
  Share2,
  Trash2,
  Upload,
  Activity,
  Settings,
  ChevronRight,
  Shield,
  Layers,
} from 'lucide-react';
import { formatDateIST, formatDateTimeIST } from '@/lib/timezone';
import { OrgAdminSidebar } from '@/components/layout/org-admin-sidebar';
import { OrgAdminMobileNav } from '@/components/layout/org-admin-mobile-nav';
import { OrgAdminHeader } from '@/components/layout/org-admin-header';
import { useToast } from '@/components/feedback/toast-provider';
import { ConfirmationModal } from '@/components/feedback/confirmation-modal';
import { UpdatePasswordModal } from '@/components/staff/update-password-modal';
import { openWhatsAppInvite } from '@/lib/whatsapp';
import styles from './StaffProfile.module.css';

interface BranchItem {
  id: string;
  name: string;
  address: string;
  status: string;
}

interface BranchAssignment {
  id: string;
  branchId: string;
  assignedAt: string;
  branch: BranchItem;
}

interface StaffDetails {
  id: string;
  staffId: string;
  name: string;
  phone: string;
  address: string;
  idDocType: string;
  idDocLast4: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    status: 'ACTIVE' | 'INACTIVE' | 'PENDING';
    role: string;
    lastLoginAt: string | null;
    createdAt: string;
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

export default function StaffProfilePage() {
  const params = useParams();
  const organizationCode = (params.organizationCode as string)?.toUpperCase() || '';
  const staffId = params.staffId as string;
  const router = useRouter();
  const toast = useToast();

  const [branding, setBranding] = useState<OrgBranding | null>(null);
  const [staff, setStaff] = useState<StaffDetails | null>(null);
  const [allOrgBranches, setAllOrgBranches] = useState<BranchItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Header Dropdown Menu State
  const [menuOpen, setMenuOpen] = useState(false);

  // Edit Metadata State
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [idDocType, setIdDocType] = useState('AADHAAR');
  const [idDocLast4, setIdDocLast4] = useState('');
  const [selectedDocFile, setSelectedDocFile] = useState<File | null>(null);
  const [savingMetadata, setSavingMetadata] = useState(false);

  const idDocTypeLabels: Record<string, string> = {
    AADHAAR: 'Aadhaar Card',
    VOTER_ID: 'Voter ID Card',
    PASSPORT: 'Passport',
    DRIVING_LICENSE: 'Driving Licence',
    COLLEGE_ID: 'College / Institutional ID Card',
    GOVERNMENT_ID: 'Government ID Card',
    OTHER: 'Other Identification Card',
  };

  // Delete Staff Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingStaff, setDeletingStaff] = useState(false);

  // Branch Assignment Modal State
  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [savingBranches, setSavingBranches] = useState(false);

  // Device Reset & Removal Confirmation Modal State
  const [deviceResetModalOpen, setDeviceResetModalOpen] = useState(false);
  const [resettingDevice, setResettingDevice] = useState(false);
  const [deviceToRemove, setDeviceToRemove] = useState<any>(null);
  const [removingDevice, setRemovingDevice] = useState(false);

  // Status Toggle Confirmation Modal State
  const [statusModalOpen, setStatusModalOpen] = useState(false);

  // Tabs State
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'SHIFT' | 'DEVICE' | 'SETTINGS'>('OVERVIEW');
  const [shiftPatterns, setShiftPatterns] = useState<any[]>([]);
  const [activeShiftAssignment, setActiveShiftAssignment] = useState<any>(null);
  const [selectedShiftPatternId, setSelectedShiftPatternId] = useState('');
  const [shiftEffectiveFrom, setShiftEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [savingShift, setSavingShift] = useState(false);

  // Invite & Password Modal States
  const [resendingInvite, setResendingInvite] = useState(false);
  const [whatsappLoading, setWhatsappLoading] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

  useEffect(() => {
    if (organizationCode && staffId) {
      fetchData();
    }
  }, [organizationCode, staffId]);

  const fetchData = async (quiet = false) => {
    try {
      if (!quiet) setLoading(true);
      const brandRes = await fetch(`/api/org/${organizationCode}/branding`);
      const brandData = await brandRes.json();
      if (brandData.success) {
        setBranding(brandData.organization);
      }

      const branchRes = await fetch(`/api/org/${organizationCode}/branches`);
      const branchData = await branchRes.json();
      if (branchData.success && Array.isArray(branchData.branches)) {
        setAllOrgBranches(branchData.branches.filter((b: BranchItem) => b.status === 'ACTIVE'));
      }

      const staffRes = await fetch(`/api/org/${organizationCode}/staff/${staffId}`);
      const staffData = await staffRes.json();

      if (staffData.success && staffData.staff) {
        setStaff(staffData.staff);
        setName(staffData.staff.name);
        setEmail(staffData.staff.user?.email || '');
        setPhone(staffData.staff.phone || '');
        setAddress(staffData.staff.address || '');
        setIdDocType(staffData.staff.idDocType || 'AADHAAR');
        setIdDocLast4(staffData.staff.idDocLast4 || '');
        setSelectedBranchIds(staffData.staff.branchAssignments?.map((a: BranchAssignment) => a.branchId) || []);
      } else {
        toast.error(staffData.error || 'Failed to load staff details.');
      }

      // Fetch Shift Patterns
      const shiftPatternsRes = await fetch(`/api/org/${organizationCode}/shift-patterns`);
      const shiftPatternsData = await shiftPatternsRes.json();
      if (shiftPatternsData.success) {
        setShiftPatterns(shiftPatternsData.shiftPatterns || shiftPatternsData.patterns || []);
      }

      // Fetch Staff Shift Assignment
      const shiftHistoryRes = await fetch(`/api/org/${organizationCode}/staff/${staffId}/shift`);
      const shiftHistoryData = await shiftHistoryRes.json();
      if (shiftHistoryData.success) {
        setActiveShiftAssignment(shiftHistoryData.activeAssignment || null);
        if (shiftHistoryData.activeAssignment) {
          setSelectedShiftPatternId(shiftHistoryData.activeAssignment.shiftPatternId);
        }
      }
    } catch {
      toast.error('Network error loading staff profile.');
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  // Smart Back Navigation Handler
  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(`/${organizationCode}/admin/staff`);
    }
  };

  // Save Profile Metadata Form
  const handleSaveMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Full name is required.');
    if (!email.trim() || !email.includes('@')) return toast.error('A valid email address is required.');
    try {
      setSavingMetadata(true);
      const res = await fetch(`/api/org/${organizationCode}/staff/${staffId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          address: address.trim() || '',
          idDocType,
          idDocLast4: idDocLast4.trim() || null,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(selectedDocFile ? 'Staff profile & attachment saved successfully.' : 'Staff information updated successfully.');
        await fetchData();
        setIsEditing(false);
      } else {
        toast.error(data.error || 'Failed to update staff metadata.');
      }
    } catch {
      toast.error('Network error updating metadata.');
    } finally {
      setSavingMetadata(false);
    }
  };

  // Delete Staff Account
  const handleDeleteStaff = async () => {
    try {
      setDeletingStaff(true);
      const res = await fetch(`/api/org/${organizationCode}/staff/${staffId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'Staff account removed from organization.');
        router.push(`/${organizationCode}/admin/staff`);
      } else {
        toast.error(data.error || 'Failed to delete staff account.');
      }
    } catch {
      toast.error('Network error deleting staff account.');
    } finally {
      setDeletingStaff(false);
      setDeleteModalOpen(false);
    }
  };

  // Save Branch Assignments
  const handleSaveBranchAssignments = async () => {
    try {
      setSavingBranches(true);
      const res = await fetch(`/api/org/${organizationCode}/staff/${staffId}/branches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchIds: selectedBranchIds }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Workplace branch assignments updated.');
        await fetchData();
        setBranchModalOpen(false);
      } else {
        toast.error(data.error || 'Failed to update branch assignments.');
      }
    } catch {
      toast.error('Network error updating branch assignments.');
    } finally {
      setSavingBranches(false);
    }
  };

  // Reset Devices
  const handleResetDevice = async () => {
    try {
      setResettingDevice(true);
      const res = await fetch(`/api/org/${organizationCode}/staff/${staffId}/reset-device`, {
        method: 'POST',
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Staff device hardware bindings reset successfully.');
        await fetchData();
        setDeviceResetModalOpen(false);
      } else {
        toast.error(data.error || 'Failed to reset device.');
      }
    } catch {
      toast.error('Network error resetting device.');
    } finally {
      setResettingDevice(false);
    }
  };

  // Unbind Single Device
  const handleRemoveDevice = async () => {
    if (!deviceToRemove) return;
    try {
      setRemovingDevice(true);
      const res = await fetch(`/api/org/${organizationCode}/staff/${staffId}/devices/${deviceToRemove.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Device hardware binding removed.');
        await fetchData();
        setDeviceToRemove(null);
      } else {
        toast.error(data.error || 'Failed to remove device binding.');
      }
    } catch {
      toast.error('Network error removing device binding.');
    } finally {
      setRemovingDevice(false);
    }
  };

  // Toggle Account Active / Inactive Status
  const handleToggleStatus = async () => {
    try {
      const res = await fetch(`/api/org/${organizationCode}/staff/${staffId}/toggle-status`, {
        method: 'POST',
      });

      const data = await res.json();
      if (data.success) {
        toast.success(
          staff?.user.status === 'ACTIVE'
            ? 'Staff account deactivated.'
            : 'Staff account activated.'
        );
        await fetchData();
        setStatusModalOpen(false);
      } else {
        toast.error(data.error || 'Failed to toggle account status.');
      }
    } catch {
      toast.error('Network error toggling status.');
    }
  };

  // Assign Shift Pattern
  const handleSaveShiftAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShiftPatternId) {
      toast.error('Please select a shift pattern.');
      return;
    }
    try {
      setSavingShift(true);
      const res = await fetch(`/api/org/${organizationCode}/staff/${staffId}/shift`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftPatternId: selectedShiftPatternId,
          effectiveFrom: shiftEffectiveFrom,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Shift pattern assigned successfully.');
        fetchData();
      } else {
        toast.error(data.error || 'Failed to assign shift pattern.');
      }
    } catch {
      toast.error('Network error assigning shift pattern.');
    } finally {
      setSavingShift(false);
    }
  };

  // Resend Email Invitation
  const handleResendInvite = async () => {
    try {
      setResendingInvite(true);
      const res = await fetch(`/api/org/${organizationCode}/staff/${staffId}/resend-invite`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || `Invitation email resent to ${staff?.user.email}`);
      } else {
        toast.error(data.error || 'Failed to resend invitation email.');
      }
    } catch {
      toast.error('Network error resending email.');
    } finally {
      setResendingInvite(false);
    }
  };

  // Open WhatsApp Invitation
  const handleWhatsAppInvite = async () => {
    if (!staff) return;
    try {
      setWhatsappLoading(true);
      const res = await fetch(`/api/org/${organizationCode}/staff/${staffId}/resend-invite`, {
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
      setWhatsappLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <OrgAdminSidebar organizationCode={organizationCode} organizationName={branding?.name || 'Organization'} />
        <div className={styles.mainContent} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Loader2 size={38} className="animate-spin" style={{ color: '#818cf8' }} />
        </div>
      </div>
    );
  }

  if (!staff) {
    return (
      <div className={styles.container}>
        <OrgAdminSidebar organizationCode={organizationCode} organizationName={branding?.name || 'Organization'} />
        <div className={styles.mainContent} style={{ padding: '40px', textAlign: 'center' }}>
          <AlertTriangle size={42} color="#f87171" style={{ margin: '0 auto 16px auto' }} />
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff' }}>Staff Member Not Found</h2>
          <p style={{ color: '#94a3b8', marginTop: '8px', fontSize: '14px' }}>The requested staff profile does not exist or was deleted.</p>
          <button onClick={handleBack} className="btn btn-primary" style={{ marginTop: '20px' }}>
            Back to Last Page
          </button>
        </div>
      </div>
    );
  }

  const isPending = staff.user.status === 'PENDING';
  const isActive = staff.user.status === 'ACTIVE';
  const allDevices = staff.devices || [];
  const registeredCount = allDevices.filter((d: any) => d.status === 'REGISTERED').length;
  const branchAssignments = staff.branchAssignments || [];

  const initials = staff.name
    ? staff.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : 'ST';

  const activeShiftWorkDay = activeShiftAssignment?.shiftPattern?.weeklyDays?.find(
    (w: any) => !w.isHoliday && w.startTime && w.endTime
  );
  const shiftTimesLabel = activeShiftWorkDay
    ? `${activeShiftWorkDay.startTime} – ${activeShiftWorkDay.endTime}`
    : activeShiftAssignment?.shiftPattern
    ? 'Standard Workday Schedule'
    : 'Assign shift pattern below';

  const deviceStatusLabel = registeredCount === 0 ? 'No Device Bound' : '1 Device Bound';
  const deviceSubtext = registeredCount === 0 ? 'Awaiting First Login' : 'Layer 3 Hardware Bound';

  return (
    <div className={styles.container}>
      <OrgAdminSidebar
        organizationCode={organizationCode}
        organizationName={branding?.name || 'Organization'}
        logoUrl={branding?.logoUrl}
      />

      <div className={styles.mainContent}>
        {/* Modern Header Bar */}
        <OrgAdminHeader
          organizationCode={organizationCode}
          logoUrl={branding?.logoUrl}
          panelTitle={staff.name}
          panelSubtitle={`Staff ID: ${staff.staffId} • ${staff.user.email}`}
          onBack={handleBack}
          headerMenuOpen={menuOpen}
          onToggleHeaderMenu={() => setMenuOpen(!menuOpen)}
        >
          <div className={styles.actionDropdownMenu}>
            <button
              onClick={() => { setMenuOpen(false); setIsEditing(!isEditing); }}
              className={styles.dropdownItem}
            >
              <Edit2 size={15} />
              <span>{isEditing ? 'Close Profile Editor' : 'Edit Staff Profile'}</span>
            </button>

            {isPending ? (
              <>
                <button
                  onClick={() => { setMenuOpen(false); handleResendInvite(); }}
                  disabled={resendingInvite}
                  className={styles.dropdownItem}
                  style={{ color: '#38bdf8' }}
                >
                  {resendingInvite ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}
                  <span>Resend Email Invite</span>
                </button>
                <button
                  onClick={() => { setMenuOpen(false); handleWhatsAppInvite(); }}
                  disabled={whatsappLoading}
                  className={styles.dropdownItem}
                  style={{ color: '#25D366' }}
                >
                  {whatsappLoading ? <Loader2 size={15} className="animate-spin" /> : <Share2 size={15} />}
                  <span>WhatsApp Invite</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => { setMenuOpen(false); setPasswordModalOpen(true); }}
                className={styles.dropdownItem}
                style={{ color: '#c084fc' }}
              >
                <Key size={15} />
                <span>Update Password</span>
              </button>
            )}

            <button
              onClick={() => { setMenuOpen(false); setDeviceResetModalOpen(true); }}
              className={styles.dropdownItem}
            >
              <RefreshCw size={15} />
              <span>Reset Devices</span>
            </button>

            <button
              onClick={() => { setMenuOpen(false); setStatusModalOpen(true); }}
              className={styles.dropdownItem}
              style={{ color: isActive ? '#f87171' : '#34d399' }}
            >
              <Power size={15} />
              <span>{isActive ? 'Deactivate Account' : 'Activate Account'}</span>
            </button>

            <div className={styles.dropdownDivider} />

            <button
              onClick={() => { setMenuOpen(false); setDeleteModalOpen(true); }}
              className={`${styles.dropdownItem} ${styles.dropdownItemDanger}`}
            >
              <Trash2 size={15} />
              <span>Delete Staff Account</span>
            </button>
          </div>
        </OrgAdminHeader>

        <main className={styles.pageContainer}>
          {/* Hero Profile Banner Header */}
          <div className={styles.heroCard}>
            <div className={styles.heroCoverGlow} />
            <div className={styles.heroMain}>
              <div className={styles.heroAvatarSection}>
                <div className={styles.avatarBox}>
                  <span className={styles.avatarInitials}>{initials}</span>
                  <span
                    className={`${styles.statusPulse} ${
                      isActive
                        ? styles.statusPulseActive
                        : isPending
                        ? styles.statusPulsePending
                        : styles.statusPulseInactive
                    }`}
                  />
                </div>

                <div className={styles.heroTextGroup}>
                  <h1 className={styles.heroTitle}>{staff.name}</h1>
                  <div className={styles.heroMetaRow}>
                    <span className={`${styles.heroTag} ${styles.heroTagPrimary}`}>
                      ID: {staff.staffId}
                    </span>
                    {isActive && (
                      <span className={`${styles.heroTag} ${styles.heroTagSuccess}`}>
                        <CheckCircle2 size={13} /> Active Account
                      </span>
                    )}
                    {isPending && (
                      <span className={`${styles.heroTag} ${styles.heroTagWarning}`}>
                        <Clock size={13} /> Pending Invite Setup
                      </span>
                    )}
                    {!isActive && !isPending && (
                      <span className={`${styles.heroTag} ${styles.heroTagDanger}`}>
                        <AlertTriangle size={13} /> Account Deactivated
                      </span>
                    )}
                    <span className={`${styles.heroTag} ${styles.heroTagMuted}`}>
                      {staff.user.role === 'ORG_ADMIN' ? 'Org Administrator' : 'Staff Member'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className={styles.heroActionsRow}>
                {isPending && (
                  <button
                    type="button"
                    onClick={handleWhatsAppInvite}
                    disabled={whatsappLoading}
                    className={`${styles.actionBtn} ${styles.actionBtnWhatsapp}`}
                  >
                    {whatsappLoading ? <Loader2 size={15} className="animate-spin" /> : <Share2 size={15} />}
                    <span>WhatsApp Invite</span>
                  </button>
                )}
                {isPending && (
                  <button
                    type="button"
                    onClick={handleResendInvite}
                    disabled={resendingInvite}
                    className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                  >
                    {resendingInvite ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}
                    <span>Resend Email</span>
                  </button>
                )}
                {isActive && (
                  <button
                    type="button"
                    onClick={() => setPasswordModalOpen(true)}
                    className={`${styles.actionBtn} ${styles.actionBtnPurple}`}
                  >
                    <Key size={15} />
                    <span>Update Password</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsEditing(!isEditing)}
                  className={`${styles.actionBtn} ${styles.actionBtnSecondary}`}
                >
                  <Edit2 size={15} />
                  <span>{isEditing ? 'Cancel Edit' : 'Edit Profile'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* KPI Metrics Bar */}
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statIconBox} style={{ backgroundColor: 'rgba(52, 211, 153, 0.15)', color: '#34d399' }}>
                <Activity size={24} />
              </div>
              <div className={styles.statContent}>
                <span className={styles.statLabel}>Account Status</span>
                <span className={styles.statVal} style={{ color: isActive ? '#34d399' : isPending ? '#fbbf24' : '#f87171' }}>
                  {isActive ? 'Active Eligible' : isPending ? 'Pending Setup' : 'Deactivated'}
                </span>
                <span className={styles.statSubtext}>
                  {staff.user.lastLoginAt ? `Active ${formatDateIST(staff.user.lastLoginAt)}` : 'No login recorded yet'}
                </span>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statIconBox} style={{ backgroundColor: 'rgba(192, 132, 252, 0.15)', color: '#c084fc' }}>
                <Clock size={24} />
              </div>
              <div className={styles.statContent}>
                <span className={styles.statLabel}>Shift Schedule</span>
                <span className={styles.statVal}>
                  {activeShiftAssignment?.shiftPattern?.name || 'No Shift Assigned'}
                </span>
                <span className={styles.statSubtext}>{shiftTimesLabel}</span>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statIconBox} style={{ backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                <Building size={24} />
              </div>
              <div className={styles.statContent}>
                <span className={styles.statLabel}>Workplace Branches</span>
                <span className={styles.statVal}>
                  {branchAssignments.length} {branchAssignments.length === 1 ? 'Branch' : 'Branches'}
                </span>
                <span className={styles.statSubtext}>
                  {branchAssignments.length > 0 && branchAssignments[0]?.branch ? branchAssignments[0].branch.name : 'Unassigned'}
                </span>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statIconBox} style={{ backgroundColor: 'rgba(129, 140, 248, 0.15)', color: '#818cf8' }}>
                <ShieldCheck size={24} />
              </div>
              <div className={styles.statContent}>
                <span className={styles.statLabel}>Security Devices</span>
                <span className={styles.statVal}>{deviceStatusLabel}</span>
                <span className={styles.statSubtext}>{deviceSubtext}</span>
              </div>
            </div>
          </div>

          {/* EDIT PROFILE DRAWER / CARD */}
          {isEditing && (
            <div className={styles.cardSection} style={{ border: '1px solid rgba(99, 102, 241, 0.45)' }}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>
                  <Edit2 size={18} color="#818cf8" />
                  Edit Staff Profile &amp; Documents
                </h3>
                <button type="button" onClick={() => setIsEditing(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveMetadata} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '18px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '12.5px', color: '#ffffff', fontWeight: 600 }}>Full Name *</label>
                  <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="form-input" style={{ width: '100%', marginTop: '4px' }} />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '12.5px', color: '#ffffff', fontWeight: 600 }}>Email Address (Account Login) *</label>
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="staff@organization.com" className="form-input" style={{ width: '100%', marginTop: '4px' }} />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '12.5px', color: '#ffffff', fontWeight: 600 }}>Phone Number (Optional)</label>
                  <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" className="form-input" style={{ width: '100%', marginTop: '4px' }} />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '12.5px', color: '#ffffff', fontWeight: 600 }}>Residential Address (Optional)</label>
                  <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Full street address" className="form-input" style={{ width: '100%', marginTop: '4px' }} />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '12.5px', color: '#ffffff', fontWeight: 600 }}>ID Document Type</label>
                  <select value={idDocType} onChange={(e) => setIdDocType(e.target.value)} className="form-input" style={{ width: '100%', marginTop: '4px' }}>
                    <option value="AADHAAR">Aadhaar Card</option>
                    <option value="VOTER_ID">Voter ID Card</option>
                    <option value="PASSPORT">Passport</option>
                    <option value="DRIVING_LICENSE">Driving Licence</option>
                    <option value="COLLEGE_ID">College / Institutional ID Card</option>
                    <option value="GOVERNMENT_ID">Government ID Card</option>
                    <option value="OTHER">Other Identification Card</option>
                  </select>
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '12.5px', color: '#ffffff', fontWeight: 600 }}>ID Last 4 Digits (Optional)</label>
                  <input type="text" maxLength={4} value={idDocLast4} onChange={(e) => setIdDocLast4(e.target.value.replace(/\D/g, ''))} placeholder="e.g. 5482" className="form-input" style={{ width: '100%', marginTop: '4px' }} />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label" style={{ fontSize: '12.5px', color: '#ffffff', fontWeight: 600 }}>Upload Identity Document / Attachment (Optional)</label>
                  <div className={styles.fileDropzone} style={{ marginTop: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
                        <FileText size={22} />
                      </div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>
                          {selectedDocFile ? selectedDocFile.name : 'Attach Identity Card / Contract File'}
                        </div>
                        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                          {selectedDocFile ? `${(selectedDocFile.size / 1024).toFixed(1)} KB • File attached` : 'Supported formats: PDF, PNG, JPG (Max 10MB)'}
                        </div>
                      </div>
                    </div>
                    <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <Upload size={14} />
                      <span>{selectedDocFile ? 'Change File' : 'Browse File'}</span>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setSelectedDocFile(e.target.files[0]);
                            toast.success(`Attached: ${e.target.files[0].name}`);
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>

                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
                  <button type="button" onClick={() => setIsEditing(false)} className="btn btn-secondary btn-sm">Cancel</button>
                  <button type="submit" disabled={savingMetadata} className="btn btn-primary btn-sm">
                    {savingMetadata ? 'Saving Changes...' : 'Save Profile & Documents'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Navigation Tabs Bar */}
          <div className={styles.tabsBar}>
            <button
              onClick={() => setActiveTab('OVERVIEW')}
              className={`${styles.tabButton} ${activeTab === 'OVERVIEW' ? styles.tabButtonActive : ''}`}
            >
              <UserIcon size={16} />
              <span>Profile Overview</span>
            </button>
            <button
              onClick={() => setActiveTab('SHIFT')}
              className={`${styles.tabButton} ${activeTab === 'SHIFT' ? styles.tabButtonActive : ''}`}
            >
              <Clock size={16} />
              <span>Shift Schedule</span>
            </button>
            <button
              onClick={() => setActiveTab('DEVICE')}
              className={`${styles.tabButton} ${activeTab === 'DEVICE' ? styles.tabButtonActive : ''}`}
            >
              <Smartphone size={16} />
              <span>Hardware &amp; Security ({allDevices.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('SETTINGS')}
              className={`${styles.tabButton} ${activeTab === 'SETTINGS' ? styles.tabButtonActive : ''}`}
            >
              <Settings size={16} />
              <span>Account Administration</span>
            </button>
          </div>

          {/* TAB 1: PROFILE OVERVIEW */}
          {activeTab === 'OVERVIEW' && (
            <div className={styles.gridTwoCol}>
              {/* Personal Details Card */}
              <div className={styles.cardSection}>
                <div className={styles.cardHeader}>
                  <h3 className={styles.cardTitle}>
                    <UserIcon size={18} color="#818cf8" />
                    Personal &amp; Contact Details
                  </h3>
                </div>

                <div className={styles.infoGrid}>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Full Name</span>
                    <span className={styles.infoValue}>{staff.name}</span>
                  </div>

                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Staff Identifier</span>
                    <span className={styles.techBadge}>{staff.staffId}</span>
                  </div>

                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Account Email</span>
                    <span className={styles.techBadge}>{staff.user.email}</span>
                  </div>

                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Phone Contact</span>
                    {staff.phone ? (
                      <a href={`tel:${staff.phone}`} style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: 700, fontSize: '14.5px' }}>
                        {staff.phone}
                      </a>
                    ) : (
                      <span className={styles.infoValue} style={{ color: '#64748b' }}>Not specified</span>
                    )}
                  </div>

                  <div className={styles.infoItem} style={{ gridColumn: '1 / -1' }}>
                    <span className={styles.infoLabel}>Residential Address</span>
                    <span className={styles.infoValue}>{staff.address || 'Not specified'}</span>
                  </div>
                </div>

                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#818cf8', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={15} />
                    <span>Government Identity Verification</span>
                  </div>
                  <div className={styles.infoGrid}>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Document Type</span>
                      <span className={styles.infoValue}>{idDocTypeLabels[staff.idDocType] || staff.idDocType}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Last 4 Digits</span>
                      <span className={styles.techBadge}>
                        {staff.idDocLast4 ? `****${staff.idDocLast4}` : 'Not provided'}
                      </span>
                    </div>
                  </div>

                  {selectedDocFile && (
                    <div style={{ marginTop: '14px', padding: '10px 14px', borderRadius: '12px', backgroundColor: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.3)', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#818cf8' }}>
                      <FileText size={16} />
                      <span>Document Attached: <strong>{selectedDocFile.name}</strong></span>
                    </div>
                  )}
                </div>

                <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12.5px', color: '#94a3b8' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={14} color="#818cf8" />
                    <span>Member Since:</span>
                  </div>
                  <strong style={{ color: '#ffffff' }}>
                    {formatDateIST(staff.createdAt, { year: 'numeric', month: 'long', day: 'numeric' })}
                  </strong>
                </div>
              </div>

              {/* Assigned Workplace Branches Card */}
              <div className={styles.cardSection}>
                <div className={styles.cardHeader}>
                  <h3 className={styles.cardTitle}>
                    <Building size={18} color="#38bdf8" />
                    Workplace Branch Assignments
                  </h3>
                  <button onClick={() => setBranchModalOpen(true)} className="btn btn-secondary btn-sm" style={{ padding: '5px 14px', fontSize: '12px' }}>
                    Manage Branches
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {branchAssignments.length > 0 ? (
                    branchAssignments.map((a) => (
                      <div key={a.id} className={styles.branchCard}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                          <div className={styles.branchIcon}>
                            <MapPin size={20} />
                          </div>
                          <div className={styles.branchInfo}>
                            <div className={styles.branchName}>{a.branch?.name || 'Workplace Branch'}</div>
                            <div className={styles.branchAddress}>{a.branch?.address || 'Branch location address'}</div>
                          </div>
                        </div>
                        <span className={styles.branchBadge}>Geofenced</span>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '24px', borderRadius: '14px', backgroundColor: 'rgba(251, 191, 36, 0.05)', border: '1px solid rgba(251, 191, 36, 0.2)', fontSize: '13.5px', color: '#fbbf24', textAlign: 'center' }}>
                      No workplace branch assigned yet. Click &quot;Manage Branches&quot; above to assign branches.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SHIFT SCHEDULE */}
          {activeTab === 'SHIFT' && (
            <div className={styles.cardSection}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>
                  <Clock size={18} color="#c084fc" />
                  Staff Shift Schedule Pattern
                </h3>
              </div>

              {activeShiftAssignment ? (
                <div className={styles.shiftBanner}>
                  <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Active Assigned Shift Pattern</div>
                  <div className={styles.shiftTitle}>
                    {activeShiftAssignment.shiftPattern?.name || 'Assigned Shift'}
                  </div>
                  <div className={styles.shiftDetailsRow}>
                    <span>Working Hours: <strong style={{ color: '#ffffff' }}>{shiftTimesLabel}</strong></span>
                    <span>&bull;</span>
                    <span>Effective From: <strong style={{ color: '#ffffff' }}>{formatDateIST(activeShiftAssignment.effectiveFrom)}</strong></span>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '24px', borderRadius: '16px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', fontSize: '13.5px', color: '#94a3b8', textAlign: 'center' }}>
                  No active shift schedule assigned yet. Choose a shift pattern below to assign working hours.
                </div>
              )}

              <form onSubmit={handleSaveShiftAssignment} className={styles.shiftForm}>
                <div className={styles.shiftInputsRow}>
                  <div>
                    <label className="form-label" style={{ fontSize: '12.5px', color: '#ffffff', fontWeight: 600 }}>Select Shift Pattern *</label>
                    <select
                      value={selectedShiftPatternId}
                      onChange={(e) => setSelectedShiftPatternId(e.target.value)}
                      className="form-input"
                      style={{
                        width: '100%',
                        marginTop: '4px',
                        height: '44px',
                        fontSize: '13.5px',
                        backgroundColor: '#0d121f',
                        color: '#ffffff',
                        boxSizing: 'border-box',
                      }}
                    >
                      <option value="">-- Select Shift Pattern --</option>
                      {shiftPatterns.map((p) => {
                        const workDay = p.weeklyDays?.find((w: any) => !w.isHoliday);
                        const hoursLabel = workDay && workDay.startTime && workDay.endTime ? ` (${workDay.startTime} – ${workDay.endTime})` : '';
                        return (
                          <option key={p.id} value={p.id}>{p.name}{hoursLabel}</option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="form-label" style={{ fontSize: '12.5px', color: '#ffffff', fontWeight: 600 }}>Effective Date *</label>
                    <input
                      type="date"
                      value={shiftEffectiveFrom}
                      onChange={(e) => setShiftEffectiveFrom(e.target.value)}
                      className="form-input"
                      style={{ width: '100%', marginTop: '4px', height: '44px', fontSize: '13.5px', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                  <button type="submit" disabled={savingShift} className="btn btn-primary" style={{ height: '44px', padding: '0 28px', fontWeight: 700 }}>
                    {savingShift ? 'Saving Shift Pattern...' : 'Assign Shift Pattern'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: SECURITY DEVICES */}
          {activeTab === 'DEVICE' && (
            <div className={styles.cardSection}>
              <div className={styles.cardHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Smartphone size={20} color="#34d399" />
                  <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#ffffff' }}>Layer 3 Authorized Security Devices</h3>
                </div>
                {allDevices.length > 0 && (
                  <button
                    onClick={() => setDeviceResetModalOpen(true)}
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <RefreshCw size={14} />
                    <span>Reset All Devices</span>
                  </button>
                )}
              </div>

              {allDevices.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {allDevices.map((d: any) => {
                    const isRegistered = d.status === 'REGISTERED';
                    return (
                      <div key={d.id} className={styles.deviceCard}>
                        <div className={styles.deviceHeader}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            <span
                              style={{
                                fontSize: '10.5px',
                                fontWeight: 800,
                                padding: '3px 8px',
                                borderRadius: '6px',
                                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                                color: '#38bdf8',
                                border: '1px solid rgba(56, 189, 248, 0.3)',
                                textTransform: 'uppercase',
                              }}
                            >
                              Hardware Binding
                            </span>
                            <span style={{ fontSize: '15.5px', fontWeight: 800, color: '#ffffff' }}>
                              {isRegistered ? d.label || 'Staff Primary Registered Device' : 'Device Slot (Awaiting Registration)'}
                            </span>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 800,
                                padding: '3px 10px',
                                borderRadius: '12px',
                                backgroundColor: isRegistered ? 'rgba(52, 211, 153, 0.15)' : 'rgba(251, 191, 36, 0.15)',
                                color: isRegistered ? '#34d399' : '#fbbf24',
                                border: `1px solid ${isRegistered ? 'rgba(52, 211, 153, 0.3)' : 'rgba(251, 191, 36, 0.3)'}`,
                              }}
                            >
                              {isRegistered ? '✓ Active & Bound' : 'Awaiting First Login'}
                            </span>
                          </div>
                        </div>

                        {isRegistered ? (
                          <div className={styles.deviceMeta}>
                            <div>
                              <span className={styles.infoLabel}>Registered Timestamp</span>
                              <div className={styles.infoValue} style={{ fontSize: '13px' }}>
                                {d.registeredAt ? formatDateTimeIST(d.registeredAt) : 'N/A'}
                              </div>
                            </div>
                            {d.lastUsedAt && (
                              <div>
                                <span className={styles.infoLabel}>Last Attendance Check-in</span>
                                <div className={styles.infoValue} style={{ fontSize: '13px' }}>
                                  {formatDateTimeIST(d.lastUsedAt)}
                                </div>
                              </div>
                            )}
                            {d.hardwareId && (
                              <div>
                                <span className={styles.infoLabel}>Hardware Identifier</span>
                                <div className={styles.techBadge}>{d.hardwareId}</div>
                              </div>
                            )}
                            {d.deviceFingerprint && (
                              <div>
                                <span className={styles.infoLabel}>Device Fingerprint</span>
                                <div className={styles.techBadge}>{d.deviceFingerprint}</div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div style={{ fontSize: '13px', color: '#94a3b8' }}>
                            Pending hardware authorization on staff login.
                          </div>
                        )}

                        <div className={styles.deviceActionRow}>
                          <button
                            onClick={() => setDeviceToRemove(d)}
                            className="btn btn-danger btn-sm"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          >
                            <X size={14} />
                            <span>Unbind Device</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ padding: '28px', borderRadius: '16px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', fontSize: '13.5px', color: '#94a3b8', textAlign: 'center' }}>
                  No registered device found for {staff.name}. When staff logs in from their smartphone or browser, their device hardware signature will automatically bind here.
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ACCOUNT ADMINISTRATION */}
          {activeTab === 'SETTINGS' && (
            <div className={styles.cardSection}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>
                  <Settings size={18} color="#f472b6" />
                  Staff Account Administration &amp; Security Controls
                </h3>
              </div>

              <div className={styles.gridTwoCol}>
                {/* Account Security Card */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {isPending ? (
                    <>
                      <div
                        onClick={handleResendInvite}
                        style={{ padding: '16px', borderRadius: '14px', backgroundColor: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <Mail size={20} color="#38bdf8" />
                          <div>
                            <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '14px' }}>Resend Login Invitation Email</div>
                            <div style={{ fontSize: '12px', color: '#94a3b8' }}>Send setup link to {staff.user.email}</div>
                          </div>
                        </div>
                        <ChevronRight size={18} color="#38bdf8" />
                      </div>

                      <div
                        onClick={handleWhatsAppInvite}
                        style={{ padding: '16px', borderRadius: '14px', backgroundColor: 'rgba(37, 211, 102, 0.08)', border: '1px solid rgba(37, 211, 102, 0.25)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <Share2 size={20} color="#25D366" />
                          <div>
                            <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '14px' }}>WhatsApp Invite Link</div>
                            <div style={{ fontSize: '12px', color: '#94a3b8' }}>Open WhatsApp invitation to {staff.phone || 'staff'}</div>
                          </div>
                        </div>
                        <ChevronRight size={18} color="#25D366" />
                      </div>
                    </>
                  ) : (
                    <div
                      onClick={() => setPasswordModalOpen(true)}
                      style={{ padding: '16px', borderRadius: '14px', backgroundColor: 'rgba(192, 132, 252, 0.08)', border: '1px solid rgba(192, 132, 252, 0.25)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Key size={20} color="#c084fc" />
                        <div>
                          <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '14px' }}>Update Account Password</div>
                          <div style={{ fontSize: '12px', color: '#94a3b8' }}>Change account login password for {staff.name}</div>
                        </div>
                      </div>
                      <ChevronRight size={18} color="#c084fc" />
                    </div>
                  )}

                  <div
                    onClick={() => setDeviceResetModalOpen(true)}
                    style={{ padding: '16px', borderRadius: '14px', backgroundColor: 'rgba(129, 140, 248, 0.08)', border: '1px solid rgba(129, 140, 248, 0.25)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <RefreshCw size={20} color="#818cf8" />
                      <div>
                        <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '14px' }}>Reset Device Bindings</div>
                        <div style={{ fontSize: '12px', color: '#94a3b8' }}>Unbind hardware signatures to allow new login device</div>
                      </div>
                    </div>
                    <ChevronRight size={18} color="#818cf8" />
                  </div>
                </div>

                {/* Account Lifecycle Card */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div
                    onClick={() => setStatusModalOpen(true)}
                    style={{ padding: '16px', borderRadius: '14px', backgroundColor: isActive ? 'rgba(248, 113, 113, 0.08)' : 'rgba(52, 211, 153, 0.08)', border: `1px solid ${isActive ? 'rgba(248, 113, 113, 0.25)' : 'rgba(52, 211, 153, 0.25)'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Power size={20} color={isActive ? '#f87171' : '#34d399'} />
                      <div>
                        <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '14px' }}>
                          {isActive ? 'Deactivate Staff Account' : 'Activate Staff Account'}
                        </div>
                        <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                          {isActive ? 'Revoke login and attendance privileges' : 'Restore active eligibility'}
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={18} color={isActive ? '#f87171' : '#34d399'} />
                  </div>

                  <div
                    onClick={() => setDeleteModalOpen(true)}
                    style={{ padding: '16px', borderRadius: '14px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Trash2 size={20} color="#ef4444" />
                      <div>
                        <div style={{ fontWeight: 700, color: '#ef4444', fontSize: '14px' }}>Delete Staff Permanently</div>
                        <div style={{ fontSize: '12px', color: '#fca5a5' }}>Remove staff record, device keys, and credentials</div>
                      </div>
                    </div>
                    <ChevronRight size={18} color="#ef4444" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* CONFIRMATION MODALS */}
      <ConfirmationModal
        isOpen={deviceResetModalOpen}
        onClose={() => setDeviceResetModalOpen(false)}
        onConfirm={handleResetDevice}
        title="Reset all registered devices?"
        message={`All registered device bindings for ${staff.name} will be removed. Staff will automatically register their current device upon next login.`}
        confirmText="Reset Devices"
        variant="warning"
      />

      <ConfirmationModal
        isOpen={!!deviceToRemove}
        onClose={() => setDeviceToRemove(null)}
        onConfirm={handleRemoveDevice}
        title="Remove this registered device?"
        message={`This device slot (${deviceToRemove?.label || 'Selected Device'}) will be deleted. ${deviceToRemove?.status === 'NOT_REGISTERED' ? 'The pending secondary device slot will be revoked.' : 'The device will no longer be allowed for attendance verification.'}`}
        confirmText="Remove Device"
        variant="danger"
      />

      <ConfirmationModal
        isOpen={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        onConfirm={handleToggleStatus}
        title={isActive ? 'Deactivate staff account?' : 'Activate staff account?'}
        message={
          isActive
            ? `Deactivating ${staff.name} will prevent login and attendance recording. Historical records remain preserved.`
            : `Re-activate ${staff.name} to restore login and attendance eligibility.`
        }
        confirmText={isActive ? 'Deactivate Account' : 'Activate Account'}
        variant={isActive ? 'danger' : 'primary'}
      />

      <ConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteStaff}
        title={`Delete ${staff.name} permanently?`}
        message={`Are you sure you want to remove ${staff.name} (${staff.staffId}) from the organization database? All account credentials, registered devices, attendance logs, and leave records will be deleted. This action cannot be undone.`}
        confirmText={deletingStaff ? 'Deleting Account...' : 'Delete Staff Account'}
        variant="danger"
      />

      {/* Branch Assignment Modal */}
      {branchModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999999, backgroundColor: 'rgba(3, 7, 18, 0.82)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '480px', padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff' }}>Assign Workplace Branches</h3>
              <button onClick={() => setBranchModalOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '280px', overflowY: 'auto', marginBottom: '20px' }}>
              {allOrgBranches.map((b) => {
                const isSel = selectedBranchIds.includes(b.id);
                return (
                  <div
                    key={b.id}
                    onClick={() => {
                      if (isSel) setSelectedBranchIds(selectedBranchIds.filter((id) => id !== b.id));
                      else setSelectedBranchIds([...selectedBranchIds, b.id]);
                    }}
                    style={{ padding: '12px 14px', borderRadius: '12px', backgroundColor: isSel ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.03)', border: `1px solid ${isSel ? 'rgba(99, 102, 241, 0.5)' : 'rgba(255, 255, 255, 0.1)'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}
                  >
                    <div style={{ width: '20px', height: '20px', borderRadius: '6px', backgroundColor: isSel ? '#4f46e5' : 'transparent', border: `1px solid ${isSel ? '#4f46e5' : 'rgba(255, 255, 255, 0.25)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff' }}>
                      {isSel && <Check size={13} />}
                    </div>
                    <div>
                      <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#ffffff' }}>{b.name}</div>
                      <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>{b.address}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setBranchModalOpen(false)} className="btn btn-secondary btn-sm">Cancel</button>
              <button type="button" onClick={handleSaveBranchAssignments} disabled={savingBranches} className="btn btn-primary btn-sm">
                {savingBranches ? 'Saving...' : 'Save Branch Assignments'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update Password Modal */}
      <UpdatePasswordModal
        isOpen={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
        organizationCode={organizationCode}
        orgName={branding?.name}
        staff={
          staff
            ? {
                id: staff.id,
                staffId: staff.staffId,
                name: staff.name,
                email: staff.user.email,
                phone: staff.phone,
              }
            : null
        }
        onSuccess={() => fetchData(true)}
      />

      {/* Mobile Navigation Bar */}
      <OrgAdminMobileNav organizationCode={organizationCode} />
    </div>
  );
}
