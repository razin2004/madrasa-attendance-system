'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Users,
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Building,
  Mail,
  Phone,
  Check,
  Loader2,
  X,
  Share2,
  Copy,
} from 'lucide-react';
import { OrgAdminSidebar } from '@/components/layout/org-admin-sidebar';
import { OrgAdminMobileNav } from '@/components/layout/org-admin-mobile-nav';
import { useToast } from '@/components/feedback/toast-provider';
import { openWhatsAppInvite } from '@/lib/whatsapp';
import styles from './StaffCreate.module.css';

interface BranchItem {
  id: string;
  name: string;
  address: string;
  status: string;
}

interface OrgBranding {
  id: string;
  name: string;
  logoUrl: string | null;
  organizationCode: string;
}

export default function OnboardStaffPage() {
  const params = useParams();
  const organizationCode = (params.organizationCode as string)?.toUpperCase() || '';
  const router = useRouter();
  const toast = useToast();

  const [branding, setBranding] = useState<OrgBranding | null>(null);
  const [branches, setBranches] = useState<BranchItem[]>([]);

  // Step Tracker: 1 = Basic Info, 2 = Branch Assignment, 3 = ID Upload, 4 = Review & Confirm
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form Fields
  // Step 1: Basic Info
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  // Step 2: Branch Assignment
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);

  // Step 3: ID Document Collection
  const [idDocType, setIdDocType] = useState('COLLEGE_ID');
  const [idFile, setIdFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [createdStaff, setCreatedStaff] = useState<{
    staffId: string;
    name: string;
    email: string;
    phone?: string | null;
    activationUrl?: string;
  } | null>(null);

  useEffect(() => {
    if (organizationCode) {
      fetchInitialData();
    }
  }, [organizationCode]);

  const fetchInitialData = async () => {
    try {
      const brandRes = await fetch(`/api/org/${organizationCode}/branding`);
      const brandData = await brandRes.json();
      if (brandData.success) {
        setBranding(brandData.organization);
      }

      const branchRes = await fetch(`/api/org/${organizationCode}/branches`);
      const branchData = await branchRes.json();
      if (branchData.success) {
        const activeBranches = branchData.branches.filter((b: BranchItem) => b.status === 'ACTIVE');
        setBranches(activeBranches);
        if (activeBranches.length === 1) {
          setSelectedBranchIds([activeBranches[0].id]);
        }
      }
    } catch {}
  };

  const toggleBranchSelection = (bId: string) => {
    if (selectedBranchIds.includes(bId)) {
      setSelectedBranchIds(selectedBranchIds.filter((id) => id !== bId));
    } else {
      setSelectedBranchIds([...selectedBranchIds, bId]);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('ID document file size must be less than 5MB.');
        return;
      }
      setIdFile(file);
      toast.success(`Attached document: ${file.name}`);
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();

    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    if (!firstName.trim()) {
      toast.error('First name is required.');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      toast.error('A valid email address is required.');
      return;
    }

    if (selectedBranchIds.length === 0) {
      toast.error('Please assign at least one workplace branch.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`/api/org/${organizationCode}/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fullName,
          email: email.trim(),
          phone: phone.trim() || null,
          address: address.trim() || '',
          idDocType,
          branchIds: selectedBranchIds,
        }),
      });

      const data = await res.json();

      if (data.success && data.staff) {
        toast.success('Staff member onboarded successfully!');
        setCreatedStaff({
          staffId: data.staff.staffId,
          name: data.staff.name,
          email: data.staff.email,
          phone: data.staff.phone,
          activationUrl: data.staff.activationUrl,
        });
      } else {
        toast.error(data.error || 'Failed to onboard staff member.');
      }
    } catch {
      toast.error('Network error submitting staff onboarding.');
    } finally {
      setSubmitting(false);
    }
  };

  const idDocTypeLabels: Record<string, string> = {
    COLLEGE_ID: 'College ID Card',
    GOVERNMENT_ID: 'Government ID Card',
    AADHAAR: 'Aadhaar Card',
    DRIVING_LICENSE: 'Driving Licence',
    VOTER_ID: 'Voter ID',
    OTHER: 'Other ID Card',
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
        {/* Header */}
        <header className={styles.headerBar}>
          <Link href={`/${organizationCode}/admin/staff`} className="btn btn-secondary btn-sm" style={{ padding: '8px' }}>
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className={styles.title}>Add New Staff Member</h1>
            <p className={styles.subtitle}>
              Create staff account, assign workplace branches, collect ID document, and issue email setup link.
            </p>
          </div>
        </header>

        {/* Content Body */}
        <main className="pageMainContent" style={{ maxWidth: '880px' }}>
          {!createdStaff ? (
            <>
              {/* Stepper Progress Bar */}
              <div className={styles.stepperContainer}>
                {[
                  { num: 1, label: 'Basic Info' },
                  { num: 2, label: 'Workplace' },
                  { num: 3, label: 'ID Upload' },
                  { num: 4, label: 'Review' },
                ].map((s, idx) => (
                  <React.Fragment key={s.num}>
                    <div className={styles.stepNode}>
                      <div className={`${styles.stepCircle} ${step >= s.num ? styles.stepCircleActive : ''}`}>
                        {step > s.num ? <Check size={14} /> : s.num}
                      </div>
                      <span
                        style={{
                          fontSize: '13px',
                          fontWeight: step === s.num ? 700 : 500,
                          color: step === s.num ? '#ffffff' : 'var(--text-muted)',
                        }}
                      >
                        {s.label}
                      </span>
                    </div>
                    {idx < 3 && <div className={`${styles.stepLine} ${step > idx + 1 ? styles.stepLineActive : ''}`} />}
                  </React.Fragment>
                ))}
              </div>

              {/* STEP 1: Basic & Account Information */}
              {step === 1 && (
                <div className="glass-card" style={{ padding: '32px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                    <div style={{ width: '34px', height: '34px', borderRadius: '8px', backgroundColor: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
                      <Users size={18} />
                    </div>
                    <div>
                      <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>
                        Step 1: Personal &amp; Account Information
                      </h2>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Staff email is required for login authentication and password creation. Phone number is optional.
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div>
                      <label className="form-label" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
                        First Name <span style={{ color: 'var(--danger-text)' }}>*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Rahul"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="form-input"
                        style={{ width: '100%' }}
                      />
                    </div>

                    <div>
                      <label className="form-label" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
                        Last Name / Second Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Kumar"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="form-input"
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>

                  {/* Mandatory Email Field */}
                  <div style={{ marginBottom: '16px' }}>
                    <label className="form-label" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
                      Account Email Address <span style={{ color: 'var(--danger-text)' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="email"
                        required
                        placeholder="e.g. rahul.kumar@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="form-input"
                        style={{ width: '100%', paddingLeft: '40px' }}
                      />
                      <Mail size={17} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '12px' }} />
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      This email will be used for account setup, login-related communication, and important notifications.
                    </p>
                  </div>

                  {/* Optional Phone Number */}
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label className="form-label" style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
                        Phone Number
                      </label>
                      <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
                        (Optional)
                      </span>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="tel"
                        placeholder="e.g. +91 9876543210 (Leave blank if none)"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="form-input"
                        style={{ width: '100%', paddingLeft: '40px' }}
                      />
                      <Phone size={17} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '12px' }} />
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Phone number is not required to create a staff account.
                    </p>
                  </div>

                  {/* Residential Address */}
                  <div style={{ marginBottom: '24px' }}>
                    <label className="form-label" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
                      Residential Address <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>(Optional)</span>
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Flat 402, Green Park Apartments, Calicut"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="form-input"
                      style={{ width: '100%', resize: 'vertical' }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <Link href={`/${organizationCode}/admin/staff`} className="btn btn-secondary btn-sm">
                      Cancel
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        if (!firstName.trim()) return toast.error('First name is required.');
                        if (!email.trim() || !email.includes('@')) return toast.error('A valid email address is required.');
                        setStep(2);
                      }}
                      className="btn btn-primary btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <span>Next: Workplace Assignment</span>
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: Workplace Branch Assignment */}
              {step === 2 && (
                <div className="glass-card" style={{ padding: '32px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                    <div style={{ width: '34px', height: '34px', borderRadius: '8px', backgroundColor: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
                      <Building size={18} />
                    </div>
                    <div>
                      <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>
                        Step 2: Assign Workplace Branches
                      </h2>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Select the branches where this staff member is authorized to record attendance.
                      </p>
                    </div>
                  </div>

                  {branches.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', backgroundColor: 'rgba(245, 158, 11, 0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245, 158, 11, 0.2)', marginBottom: '24px' }}>
                      <AlertTriangle size={20} color="#fbbf24" style={{ margin: '0 auto 8px auto' }} />
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>No active branches found for this organization.</p>
                      <Link href={`/${organizationCode}/admin/branches/new`} className="btn btn-secondary btn-sm" style={{ marginTop: '10px' }}>
                        Register a Branch First
                      </Link>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                      {branches.map((b) => {
                        const isSelected = selectedBranchIds.includes(b.id);
                        return (
                          <div
                            key={b.id}
                            onClick={() => toggleBranchSelection(b.id)}
                            style={{
                              padding: '14px 16px',
                              borderRadius: 'var(--radius-md)',
                              backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'rgba(13, 18, 31, 0.8)',
                              border: `1px solid ${isSelected ? 'rgba(99, 102, 241, 0.5)' : 'var(--border-subtle)'}`,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <div
                              style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '4px',
                                backgroundColor: isSelected ? '#4f46e5' : 'rgba(255, 255, 255, 0.06)',
                                border: `1px solid ${isSelected ? '#4f46e5' : 'var(--border-medium)'}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#ffffff',
                                flexShrink: 0,
                              }}
                            >
                              {isSelected && <Check size={14} />}
                            </div>

                            <div>
                              <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#ffffff' }}>{b.name}</div>
                              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{b.address}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                    <button type="button" onClick={() => setStep(1)} className="btn btn-secondary btn-sm">
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedBranchIds.length === 0) return toast.error('Please select at least one branch.');
                        setStep(3);
                      }}
                      className="btn btn-primary btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <span>Next: ID Document Upload</span>
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: Identity Document Upload (Placed near end of onboarding) */}
              {step === 3 && (
                <div className="glass-card" style={{ padding: '32px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                    <div style={{ width: '34px', height: '34px', borderRadius: '8px', backgroundColor: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
                      <Upload size={18} />
                    </div>
                    <div>
                      <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>
                        Step 3: Upload Identity Document
                      </h2>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Select the ID type and upload a clear image or PDF.
                      </p>
                    </div>
                  </div>

                  <div style={{ marginBottom: '20px' }}>
                    <label className="form-label" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
                      ID Type <span style={{ color: 'var(--danger-text)' }}>*</span>
                    </label>
                    <select
                      value={idDocType}
                      onChange={(e) => setIdDocType(e.target.value)}
                      className="form-input"
                      style={{ width: '100%' }}
                    >
                      <option value="COLLEGE_ID">College ID Card</option>
                      <option value="GOVERNMENT_ID">Government ID Card</option>
                      <option value="AADHAAR">Aadhaar Card</option>
                      <option value="DRIVING_LICENSE">Driving Licence</option>
                      <option value="VOTER_ID">Voter ID</option>
                      <option value="OTHER">Other ID Card</option>
                    </select>
                  </div>

                  {/* Dropzone */}
                  <div style={{ marginBottom: '24px' }}>
                    <label className="form-label" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
                      Upload ID Document
                    </label>
                    <div className={styles.dropzone}>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        onChange={handleFileUpload}
                        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
                      />

                      {idFile ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                          <CheckCircle2 size={32} color="#34d399" />
                          <p style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff' }}>{idFile.name}</p>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Click or drop file to replace</span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                          <FileText size={32} color="var(--text-muted)" />
                          <p style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc' }}>
                            Select the ID type and upload a clear image or PDF
                          </p>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            Supports JPEG, PNG, WEBP, or PDF (Up to 5MB)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                    <button type="button" onClick={() => setStep(2)} className="btn btn-secondary btn-sm">
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(4)}
                      className="btn btn-primary btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <span>Proceed to Review</span>
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 4: Review & Confirmation */}
              {step === 4 && (
                <form onSubmit={handleCreateStaff}>
                  <div className="glass-card" style={{ padding: '32px', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                      <div style={{ width: '34px', height: '34px', borderRadius: '8px', backgroundColor: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
                        <CheckCircle2 size={18} />
                      </div>
                      <div>
                        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>
                          Step 4: Review Staff Profile &amp; Confirm
                        </h2>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          Review information before creating the staff account.
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                      {/* Personal Info */}
                      <div style={{ padding: '16px 20px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(13, 18, 31, 0.8)', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <h3 style={{ fontSize: '12.5px', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase' }}>Personal &amp; Account Info</h3>
                          <button type="button" onClick={() => setStep(1)} className="btn btn-ghost btn-sm" style={{ fontSize: '11.5px' }}>Edit</button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px' }}>
                          <div><span style={{ color: 'var(--text-muted)' }}>Name: </span><strong style={{ color: '#ffffff' }}>{`${firstName} ${lastName}`.trim()}</strong></div>
                          <div><span style={{ color: 'var(--text-muted)' }}>Email: </span><strong style={{ color: '#ffffff' }}>{email}</strong></div>
                          <div><span style={{ color: 'var(--text-muted)' }}>Phone: </span><strong style={{ color: '#ffffff' }}>{phone.trim() || 'None (Optional)'}</strong></div>
                          <div><span style={{ color: 'var(--text-muted)' }}>Address: </span><strong style={{ color: '#ffffff' }}>{address.trim() || 'Not specified'}</strong></div>
                        </div>
                      </div>

                      {/* Workplace & ID Info */}
                      <div style={{ padding: '16px 20px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(13, 18, 31, 0.8)', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <h3 style={{ fontSize: '12.5px', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase' }}>Workplace &amp; Identity Document</h3>
                          <button type="button" onClick={() => setStep(2)} className="btn btn-ghost btn-sm" style={{ fontSize: '11.5px' }}>Edit</button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px' }}>
                          <div><span style={{ color: 'var(--text-muted)' }}>Branches: </span><strong style={{ color: '#ffffff' }}>{branches.filter((b) => selectedBranchIds.includes(b.id)).map((b) => b.name).join(', ') || 'None'}</strong></div>
                          <div><span style={{ color: 'var(--text-muted)' }}>ID Type: </span><strong style={{ color: '#ffffff' }}>{idDocTypeLabels[idDocType] || idDocType}</strong></div>
                          <div><span style={{ color: 'var(--text-muted)' }}>File Attached: </span><strong style={{ color: idFile ? '#34d399' : 'var(--text-muted)' }}>{idFile ? idFile.name : 'No file attached'}</strong></div>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                      <button type="button" onClick={() => setStep(3)} className="btn btn-secondary btn-sm">
                        Back
                      </button>
                      <button type="submit" disabled={submitting} className="btn btn-primary btn-sm">
                        {submitting ? 'Creating Staff Account...' : 'Create Staff Account'}
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </>
          ) : (
            /* SUCCESS CONFIRMATION STATE */
            <div className="glass-card" style={{ padding: '40px 32px', textAlign: 'center' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'rgba(52, 211, 153, 0.15)', border: '1px solid rgba(52, 211, 153, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: '#34d399' }}>
                <CheckCircle2 size={32} />
              </div>

              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff', marginBottom: '8px' }}>
                Staff Account Created Successfully
              </h2>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '24px' }}>
                <strong>{createdStaff.name}</strong> (Staff ID: <span style={{ fontFamily: 'var(--font-mono)', color: '#818cf8' }}>{createdStaff.staffId}</span>) has been added to your organization.
              </p>

              <div style={{ padding: '16px 20px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(13, 18, 31, 0.95)', border: '1px solid var(--border-medium)', textAlign: 'left', fontSize: '13px', lineHeight: '1.6', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                <p style={{ color: '#f8fafc', fontWeight: 600, marginBottom: '6px' }}>
                  📧 Account Activation Email Sent:
                </p>
                <p style={{ marginBottom: '10px' }}>
                  An account setup email has been sent to the staff member&apos;s email address (<strong>{createdStaff.email}</strong>).
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  The staff member can click the setup link in their email to create their password and sign in at <code>/login</code>.
                </p>
              </div>

              {/* Instant WhatsApp Share & Copy Setup Link */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
                <button
                  type="button"
                  onClick={() => {
                    openWhatsAppInvite({
                      phone: createdStaff.phone,
                      staffName: createdStaff.name,
                      orgName: branding?.name || 'Organization',
                      organizationCode,
                      staffId: createdStaff.staffId,
                      email: createdStaff.email,
                      activationUrl: createdStaff.activationUrl,
                    });
                    toast.success(createdStaff.phone ? 'Opening WhatsApp chat...' : 'Opening WhatsApp contact selector...');
                  }}
                  style={{
                    backgroundColor: '#25D366',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    fontWeight: 700,
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                  }}
                >
                  <Share2 size={18} />
                  <span>
                    {createdStaff.phone
                      ? `Share Invitation via WhatsApp (${createdStaff.phone})`
                      : 'Share Invitation via WhatsApp'}
                  </span>
                </button>

                {createdStaff.activationUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(createdStaff.activationUrl!);
                      toast.success('Password setup link copied to clipboard!');
                    }}
                    className="btn btn-secondary"
                    style={{
                      width: '100%',
                      padding: '11px 16px',
                      fontWeight: 600,
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                    }}
                  >
                    <Copy size={16} />
                    <span>Copy Setup Link to Clipboard</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => router.push(`/${organizationCode}/admin/staff`)}
                className="btn btn-primary"
                style={{ width: '100%', padding: '12px' }}
              >
                Done &amp; View Staff Directory
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Mobile Nav */}
      <OrgAdminMobileNav organizationCode={organizationCode} />
    </div>
  );
}
