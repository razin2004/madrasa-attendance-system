'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Users,
  MapPin,
  Smartphone,
  ShieldCheck,
  ShieldAlert,
  ArrowLeft,
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
  Plus,
  Share2,
  Trash2,
  Upload,
  Menu,
} from 'lucide-react';
import { OrgAdminSidebar } from '@/components/layout/org-admin-sidebar';
import { OrgAdminMobileNav } from '@/components/layout/org-admin-mobile-nav';
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

  // Top-Right Hamburger Menu State
  const [menuOpen, setMenuOpen] = useState(false);

  // Edit Metadata State
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [idDocType, setIdDocType] = useState('AADHAAR');
  const [idDocLast4, setIdDocLast4] = useState('');
  const [selectedDocFile, setSelectedDocFile] = useState<File | null>(null);
  const [savingMetadata, setSavingMetadata] = useState(false);

  // Delete Staff Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingStaff, setDeletingStaff] = useState(false);

  // Branch Assignment Modal
  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [savingBranches, setSavingBranches] = useState(false);

  // Device Reset & Removal Confirmation Modal
  const [deviceResetModalOpen, setDeviceResetModalOpen] = useState(false);
  const [resettingDevice, setResettingDevice] = useState(false);
  const [deviceToRemove, setDeviceToRemove] = useState<any>(null);
  const [removingDevice, setRemovingDevice] = useState(false);
  // Status Toggle Confirmation Modal
  const [statusModalOpen, setStatusModalOpen] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'SHIFT' | 'DEVICE'>('PROFILE');
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
        setPhone(staffData.staff.phone || '');
        setAddress(staffData.staff.address || '');
        setIdDocType(staffData.staff.idDocType || 'AADHAAR');
        setIdDocLast4(staffData.staff.idDocLast4 || '');
        setSelectedBranchIds(staffData.staff.branchAssignments.map((a: BranchAssignment) => a.branchId));
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

  // 1. Update Profile Metadata & Documents
  const handleSaveMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Full name is required.');
    try {
      setSavingMetadata(true);
      const res = await fetch(`/api/org/${organizationCode}/staff/${staffId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || null,
          address: address.trim() || '',
          idDocType,
          idDocLast4: idDocLast4.trim() || null,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(selectedDocFile ? 'Staff details & document saved successfully.' : 'Staff information updated successfully.');
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

  // 1b. Delete Staff Account
  const handleDeleteStaff = async () => {
    try {
      setDeletingStaff(true);
      const res = await fetch(`/api/org/${organizationCode}/staff/${staffId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'Staff account removed from database.');
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

  // 2. Save Branch Assignments
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
        toast.success('Branch assignment updated.');
        await fetchData();
        setBranchModalOpen(false);
      } else {
        toast.error(data.error || 'Failed to update branch assignment.');
      }
    } catch {
      toast.error('Network error updating branch assignment.');
    } finally {
      setSavingBranches(false);
    }
  };

  // 3. Reset Device
  const handleResetDevice = async () => {
    try {
      setResettingDevice(true);
      const res = await fetch(`/api/org/${organizationCode}/staff/${staffId}/reset-device`, {
        method: 'POST',
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Staff device bindings reset successfully.');
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

  // 3c. Remove Individual Device / Slot
  const handleRemoveDevice = async () => {
    if (!deviceToRemove) return;
    try {
      setRemovingDevice(true);
      const res = await fetch(`/api/org/${organizationCode}/staff/${staffId}/devices/${deviceToRemove.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Device / Slot removed successfully.');
        await fetchData();
        setDeviceToRemove(null);
      } else {
        toast.error(data.error || 'Failed to remove device.');
      }
    } catch {
      toast.error('Network error removing device.');
    } finally {
      setRemovingDevice(false);
    }
  };

  // 4. Toggle Account Status
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

  // 5. Save Shift Assignment
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
        toast.success('Shift assignment saved successfully.');
        fetchData();
      } else {
        toast.error(data.error || 'Failed to assign shift pattern.');
      }
    } catch {
      toast.error('Network error assigning shift.');
    } finally {
      setSavingShift(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <OrgAdminSidebar organizationCode={organizationCode} organizationName={branding?.name || 'Organization'} />
        <div className={styles.mainContent} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Loader2 size={32} className="animate-spin" style={{ color: '#818cf8' }} />
        </div>
      </div>
    );
  }

  if (!staff) {
    return (
      <div className={styles.container}>
        <OrgAdminSidebar organizationCode={organizationCode} organizationName={branding?.name || 'Organization'} />
        <div className={styles.mainContent} style={{ padding: '32px', textAlign: 'center' }}>
          <AlertTriangle size={36} color="var(--danger-text)" style={{ margin: '0 auto 12px auto' }} />
          <h2>Staff member not found</h2>
          <Link href={`/${organizationCode}/admin/staff`} className="btn btn-primary" style={{ marginTop: '16px' }}>
            Back to Staff Directory
          </Link>
        </div>
      </div>
    );
  }

  const isPending = staff.user.status === 'PENDING';
  const isActive = staff.user.status === 'ACTIVE';
  const allDevices = staff.devices || [];
  const registeredCount = allDevices.filter((d: any) => d.status === 'REGISTERED').length;
  const hasPendingSlot = allDevices.some((d: any) => d.status === 'NOT_REGISTERED');
  const canAuthorizeMore = !hasPendingSlot && registeredCount < 2;

  const handleResendInvite = async () => {
    try {
      setResendingInvite(true);
      const res = await fetch(`/api/org/${organizationCode}/staff/${staffId}/resend-invite`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || `Login email resent to ${staff?.user.email}`);
      } else {
        toast.error(data.error || 'Failed to resend login invitation email.');
      }
    } catch {
      toast.error('Network error resending login email.');
    } finally {
      setResendingInvite(false);
    }
  };

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

  return (
    <div className={styles.container}>
      <OrgAdminSidebar
        organizationCode={organizationCode}
        organizationName={branding?.name || 'Organization'}
        logoUrl={branding?.logoUrl}
      />

      <div className={styles.mainContent}>
        {/* Header Bar */}
        <header className={styles.headerBar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <Link href={`/${organizationCode}/admin/staff`} className="btn btn-secondary btn-sm" style={{ padding: '8px' }}>
              <ArrowLeft size={16} />
            </Link>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 className={styles.title}>{staff.name}</h1>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(99, 102, 241, 0.15)',
                    color: '#818cf8',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                  }}
                >
                  {staff.staffId}
                </span>
                <span
                  style={{
                    padding: '3px 10px',
                    borderRadius: '9999px',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    backgroundColor: isPending ? 'rgba(245, 158, 11, 0.15)' : isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: isPending ? '#fbbf24' : isActive ? '#34d399' : '#f87171',
                    border: `1px solid ${isPending ? 'rgba(245, 158, 11, 0.3)' : isActive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  }}
                >
                  {isPending ? 'SETUP PENDING' : isActive ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {staff.user.email}
              </p>
            </div>
          </div>

          {/* Top Right Three Horizontal Lines Action Menu */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className={styles.menuTriggerBtn}
              title="Staff Options & Actions"
            >
              <Menu size={20} />
            </button>

            {menuOpen && (
              <>
                {/* Invisible backdrop to dismiss menu when clicking outside */}
                <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setMenuOpen(false)} />
                
                <div className={styles.actionDropdownMenu}>
                  <button
                    onClick={() => { setMenuOpen(false); setIsEditing(!isEditing); }}
                    className={styles.dropdownItem}
                  >
                    <Edit2 size={15} />
                    <span>{isEditing ? 'Cancel Edit' : 'Edit Profile'}</span>
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
                        <span>Resend Email</span>
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
                    <span>Delete Staff</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Content Body */}
        <main className="pageMainContent" style={{ maxWidth: '1280px' }}>
          {/* Navigation Tabs */}
          <div className={styles.tabsBar}>
            <button
              onClick={() => setActiveTab('PROFILE')}
              className={`${styles.tabItem} ${activeTab === 'PROFILE' ? styles.tabItemActive : ''}`}
            >
              <UserIcon size={16} />
              <span>Profile &amp; Account</span>
            </button>
            <button
              onClick={() => setActiveTab('SHIFT')}
              className={`${styles.tabItem} ${activeTab === 'SHIFT' ? styles.tabItemActive : ''}`}
            >
              <Clock size={16} />
              <span>Shift Schedule</span>
            </button>
            <button
              onClick={() => setActiveTab('DEVICE')}
              className={`${styles.tabItem} ${activeTab === 'DEVICE' ? styles.tabItemActive : ''}`}
            >
              <Smartphone size={16} />
              <span>Layer 3 Security Devices ({allDevices.length})</span>
            </button>
          </div>

          {/* EDIT METADATA & DOCUMENT FORM */}
          {isEditing && (
            <div className="glass-card" style={{ padding: '24px', marginBottom: '28px', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff' }}>Edit Staff Information &amp; Documents</h3>
                <button type="button" onClick={() => setIsEditing(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={18} /></button>
              </div>

              <form onSubmit={handleSaveMetadata} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '12.5px', color: '#ffffff', fontWeight: 600 }}>Full Name *</label>
                  <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="form-input" style={{ width: '100%', marginTop: '4px' }} />
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
                    <option value="VOTER_ID">Voter ID</option>
                    <option value="PASSPORT">Passport</option>
                    <option value="DRIVING_LICENSE">Driving License</option>
                    <option value="OTHER">Other Identification</option>
                  </select>
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '12.5px', color: '#ffffff', fontWeight: 600 }}>ID Last 4 Digits (Optional)</label>
                  <input type="text" maxLength={4} value={idDocLast4} onChange={(e) => setIdDocLast4(e.target.value.replace(/\D/g, ''))} placeholder="e.g. 5482" className="form-input" style={{ width: '100%', marginTop: '4px' }} />
                </div>

                {/* Document Upload Field */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label" style={{ fontSize: '12.5px', color: '#ffffff', fontWeight: 600 }}>Upload Staff Document (ID Proof / Contract / Certificate)</label>
                  <div style={{ marginTop: '6px', border: '2px dashed rgba(99, 102, 241, 0.35)', borderRadius: '12px', padding: '16px', backgroundColor: 'rgba(99, 102, 241, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
                        <FileText size={22} />
                      </div>
                      <div>
                        <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#ffffff' }}>
                          {selectedDocFile ? selectedDocFile.name : 'Upload Staff Identity Document / Attachment'}
                        </div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                          {selectedDocFile ? `${(selectedDocFile.size / 1024).toFixed(1)} KB • Ready to attach` : 'Supported formats: PDF, PNG, JPG (Max 10MB)'}
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
                  <button type="submit" disabled={savingMetadata} className="btn btn-primary btn-sm">{savingMetadata ? 'Saving...' : 'Save Profile & Documents'}</button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 1: PROFILE & ACCOUNT */}
          {activeTab === 'PROFILE' && (
            <div className={styles.gridTwoCol}>
              {/* Panel 1: Personal Info */}
              <div className={styles.panelCard}>
                <div className={styles.panelHeader}>
                  <h3 className={styles.panelTitle}>
                    <UserIcon size={18} color="#818cf8" />
                    Personal &amp; Account Information
                  </h3>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13.5px' }}>
                  <div><span style={{ color: 'var(--text-muted)' }}>Staff Name: </span><strong style={{ color: '#ffffff' }}>{staff.name}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Staff ID: </span><strong style={{ color: '#818cf8', fontFamily: 'var(--font-mono)' }}>{staff.staffId}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Account Email: </span><strong style={{ color: '#ffffff' }}>{staff.user.email}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Phone Number: </span><strong style={{ color: '#ffffff' }}>{staff.phone || 'None (Optional)'}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Residential Address: </span><strong style={{ color: '#ffffff' }}>{staff.address || 'Not specified'}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>ID Document Type: </span><strong style={{ color: '#ffffff' }}>{staff.idDocType}</strong></div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>ID Document Number: </span>
                    <strong style={{ color: '#ffffff' }}>{staff.idDocLast4 ? `Ending in ****${staff.idDocLast4}` : 'Not specified'}</strong>
                  </div>
                  {selectedDocFile && (
                    <div style={{ marginTop: '4px', padding: '8px 12px', borderRadius: '8px', backgroundColor: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.3)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#818cf8' }}>
                      <FileText size={14} />
                      <span>Document Attached: {selectedDocFile.name}</span>
                    </div>
                  )}

                  {/* Joined Date at very bottom of card */}
                  <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Calendar size={14} color="#818cf8" />
                      <span>Joined Organization:</span>
                    </div>
                    <strong style={{ color: '#ffffff', fontWeight: 600 }}>
                      {new Date(staff.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Panel 2: Branch Assignments */}
              <div className={styles.panelCard}>
                <div className={styles.panelHeader}>
                  <h3 className={styles.panelTitle}>
                    <Building size={18} color="#38bdf8" />
                    Assigned Workplace Branches
                  </h3>
                  <button onClick={() => setBranchModalOpen(true)} className="btn btn-secondary btn-sm">Edit Assignments</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {staff.branchAssignments.length > 0 ? (
                    staff.branchAssignments.map((a) => (
                      <div key={a.id} style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <MapPin size={16} color="#38bdf8" />
                          <span style={{ fontWeight: 600, color: '#ffffff', fontSize: '13.5px' }}>{a.branch.name}</span>
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{a.branch.address}</span>
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: '13px', color: 'var(--warning-text)' }}>No branch assigned to this staff member yet.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SHIFT SCHEDULE */}
          {activeTab === 'SHIFT' && (
            <div className="glass-card" style={{ padding: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <Clock size={20} color="#c084fc" />
                <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#ffffff' }}>Shift Pattern Assignment</h3>
              </div>

              {activeShiftAssignment ? (
                <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(168, 85, 247, 0.08)', border: '1px solid rgba(168, 85, 247, 0.25)', marginBottom: '24px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#c084fc', textTransform: 'uppercase' }}>Active Assigned Shift</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', marginTop: '2px' }}>{activeShiftAssignment.shiftPattern?.name || 'Shift Pattern'}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Hours: {activeShiftAssignment.shiftPattern?.startTime} – {activeShiftAssignment.shiftPattern?.endTime} &bull; Effective from {new Date(activeShiftAssignment.effectiveFrom).toLocaleDateString()}
                  </div>
                </div>
              ) : (
                <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', marginBottom: '24px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  No active shift pattern assigned.
                </div>
              )}

              {/* Assign Shift Form */}
              <form onSubmit={handleSaveShiftAssignment} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '16px', alignItems: 'end' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '12.5px', color: '#ffffff', fontWeight: 600 }}>Select Shift Pattern</label>
                  <select value={selectedShiftPatternId} onChange={(e) => setSelectedShiftPatternId(e.target.value)} className="form-input" style={{ width: '100%', marginTop: '4px' }}>
                    <option value="">-- Choose Shift Pattern --</option>
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
                  <label className="form-label" style={{ fontSize: '12.5px', color: '#ffffff', fontWeight: 600 }}>Effective Date</label>
                  <input type="date" value={shiftEffectiveFrom} onChange={(e) => setShiftEffectiveFrom(e.target.value)} className="form-input" style={{ width: '100%', marginTop: '4px' }} />
                </div>
                <button type="submit" disabled={savingShift} className="btn btn-primary btn-sm">{savingShift ? 'Saving...' : 'Assign Shift'}</button>
              </form>
            </div>
          )}

          {/* TAB 3: LAYER 3 SECURITY DEVICE */}
          {activeTab === 'DEVICE' && (
            <div className="glass-card" style={{ padding: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Smartphone size={20} color="#34d399" />
                  <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#ffffff' }}>Registered Security Device</h3>
                </div>

                <button
                  onClick={() => setDeviceResetModalOpen(true)}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <RefreshCw size={14} />
                  <span>Reset Registered Device</span>
                </button>
              </div>

              {allDevices.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {allDevices.slice(0, 1).map((d: any) => {
                    const isRegistered = d.status === 'REGISTERED';
                    return (
                      <div
                        key={d.id}
                        style={{
                          padding: '18px 20px',
                          borderRadius: '14px',
                          backgroundColor: isRegistered ? 'rgba(255, 255, 255, 0.03)' : 'rgba(251, 191, 36, 0.04)',
                          border: `1px solid ${isRegistered ? 'rgba(255, 255, 255, 0.08)' : 'rgba(251, 191, 36, 0.25)'}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span
                              style={{
                                fontSize: '10.5px',
                                fontWeight: 800,
                                padding: '2px 7px',
                                borderRadius: '5px',
                                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                                color: '#38bdf8',
                                border: '1px solid rgba(56, 189, 248, 0.3)',
                                textTransform: 'uppercase',
                              }}
                            >
                              Authorized Device
                            </span>
                            <span style={{ fontSize: '14.5px', fontWeight: 700, color: '#ffffff' }}>
                              {isRegistered ? d.label || 'Staff Primary Registered Device' : 'Device Slot (Awaiting Login)'}
                            </span>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: '12px',
                                backgroundColor: isRegistered ? 'rgba(52, 211, 153, 0.15)' : 'rgba(251, 191, 36, 0.15)',
                                color: isRegistered ? '#34d399' : '#fbbf24',
                                border: `1px solid ${isRegistered ? 'rgba(52, 211, 153, 0.3)' : 'rgba(251, 191, 36, 0.3)'}`,
                              }}
                            >
                              {isRegistered ? '✓ Active' : 'Awaiting Login'}
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px' }}>
                            {isRegistered ? (
                              <>
                                Registered: {d.registeredAt ? new Date(d.registeredAt).toLocaleString() : 'N/A'}
                                {d.lastUsedAt && ` • Last Used: ${new Date(d.lastUsedAt).toLocaleString()}`}
                              </>
                            ) : (
                              <>Pending device authorization on next staff login.</>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => setDeviceToRemove(d)}
                          className="btn btn-danger btn-sm"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', borderRadius: '8px' }}
                        >
                          <X size={14} />
                          <span>Remove</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ padding: '24px', borderRadius: '14px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', fontSize: '13px', color: '#94a3b8', textAlign: 'center' }}>
                  No registered device found for this staff member. When {staff.name} logs in on their phone or computer and approves device registration, their device will be registered here.
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* CONFIRMATION MODALS */}
      {/* 1. Device Reset Confirmation */}
      <ConfirmationModal
        isOpen={deviceResetModalOpen}
        onClose={() => setDeviceResetModalOpen(false)}
        onConfirm={handleResetDevice}
        title="Reset all registered devices?"
        message={`All registered device bindings for ${staff.name} will be removed. Staff will automatically register their current device upon their next login.`}
        confirmText="Reset Devices"
        variant="warning"
      />

      {/* 2. Individual Device Removal Confirmation */}
      <ConfirmationModal
        isOpen={!!deviceToRemove}
        onClose={() => setDeviceToRemove(null)}
        onConfirm={handleRemoveDevice}
        title="Remove this registered device?"
        message={`This device slot (${deviceToRemove?.label || 'Selected Device'}) will be deleted. ${deviceToRemove?.status === 'NOT_REGISTERED' ? 'The pending secondary device slot will be revoked.' : 'The device will no longer be allowed for attendance verification.'}`}
        confirmText="Remove Device"
        variant="danger"
      />


      {/* 4. Account Status Toggle Confirmation */}
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

      {/* 4b. Permanent Staff Account Deletion Confirmation */}
      <ConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteStaff}
        title={`Delete ${staff.name} permanently?`}
        message={`Are you sure you want to remove ${staff.name} (${staff.staffId}) from the organization database? All account credentials, registered devices, attendance logs, and leave records will be deleted. This action cannot be undone.`}
        confirmText={deletingStaff ? 'Deleting Account...' : 'Delete Staff Account'}
        variant="danger"
      />

      {/* 5. Branch Assignment Modal */}
      {branchModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999999, backgroundColor: 'rgba(3, 7, 18, 0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '480px', padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#ffffff' }}>Assign Workplace Branches</h3>
              <button onClick={() => setBranchModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
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
                    style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', backgroundColor: isSel ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.03)', border: `1px solid ${isSel ? 'rgba(99, 102, 241, 0.5)' : 'var(--border-subtle)'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
                  >
                    <div style={{ width: '18px', height: '18px', borderRadius: '4px', backgroundColor: isSel ? '#4f46e5' : 'transparent', border: `1px solid ${isSel ? '#4f46e5' : 'var(--border-medium)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff' }}>
                      {isSel && <Check size={12} />}
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>{b.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{b.address}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setBranchModalOpen(false)} className="btn btn-secondary btn-sm">Cancel</button>
              <button type="button" onClick={handleSaveBranchAssignments} disabled={savingBranches} className="btn btn-primary btn-sm">{savingBranches ? 'Saving...' : 'Save Assignments'}</button>
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

      {/* Mobile Nav */}
      <OrgAdminMobileNav organizationCode={organizationCode} />
    </div>
  );
}
