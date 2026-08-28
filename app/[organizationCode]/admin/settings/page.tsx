'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  Settings,
  Building2,
  Phone,
  User,
  Mail,
  Image as ImageIcon,
  Save,
  Loader2,
  Calendar,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { OrgAdminSidebar } from '@/components/layout/org-admin-sidebar';
import { OrgAdminMobileNav } from '@/components/layout/org-admin-mobile-nav';
import { useToast } from '@/components/feedback/toast-provider';
import { OrgLogo } from '@/components/branding/org-logo';

export default function AdminSettingsPage() {
  const params = useParams();
  const organizationCode = (params.organizationCode as string)?.toUpperCase() || '';
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orgData, setOrgData] = useState<any>(null);

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [contactPersonName, setContactPersonName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [attendanceCorrectionWindowDays, setAttendanceCorrectionWindowDays] = useState(5);

  useEffect(() => {
    fetchSettings();
  }, [organizationCode]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/org/${organizationCode}/settings`);
      const data = await res.json();
      if (res.ok && data.success) {
        setOrgData(data.settings);
        setName(data.settings.name || '');
        setPhone(data.settings.phone || '');
        setContactPersonName(data.settings.contactPersonName || '');
        setContactEmail(data.settings.contactEmail || '');
        setLogoUrl(data.settings.logoUrl || '');
        setAttendanceCorrectionWindowDays(data.settings.attendanceCorrectionWindowDays || 5);
      } else {
        toast.error(data.error || 'Failed to load organization settings.');
      }
    } catch {
      toast.error('Network error loading settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Organization name cannot be empty.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/org/${organizationCode}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          contactPersonName,
          contactEmail,
          logoUrl,
          attendanceCorrectionWindowDays: Number(attendanceCorrectionWindowDays),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Organization settings updated successfully.');
        setOrgData(data.settings);
      } else {
        toast.error(data.error || 'Failed to save settings.');
      }
    } catch {
      toast.error('Network error saving settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0b0f19' }}>
      <OrgAdminSidebar
        organizationCode={organizationCode}
        organizationName={orgData?.name || name || 'ShiftGuard'}
        logoUrl={logoUrl || orgData?.logoUrl}
      />

      <div style={{ flex: 1, padding: '24px 32px 80px 32px', maxWidth: '1000px' }}>
        {/* Header */}
        <div style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <Settings size={24} color="#818cf8" />
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
              Organization Settings
            </h1>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
            Manage workspace identity, branding logo, contact profiles, and attendance rules.
          </p>
        </div>

        {loading ? (
          <div className="glass-card" style={{ padding: '60px 24px', textAlign: 'center' }}>
            <Loader2 size={32} className="animate-spin" style={{ color: '#818cf8', margin: '0 auto 12px auto' }} />
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Loading settings...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Branding Preview & Identity */}
            <div className="glass-card" style={{ padding: '28px', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building2 size={18} color="#38bdf8" />
                <span>Organization Identity &amp; Branding</span>
              </h2>

              <div style={{ display: 'flex', gap: '24px', alignItems: 'center', marginBottom: '24px', padding: '16px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '14px', backgroundColor: '#0d121f', border: '1px solid var(--border-medium)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                  <OrgLogo logoUrl={logoUrl} name={name || 'Logo'} size={28} />
                </div>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff' }}>{name || 'Organization Name'}</div>
                  <div style={{ fontSize: '12px', color: '#38bdf8', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                    Code: {organizationCode}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="form-group">
                  <label className="form-label">Organization Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter organization name..."
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Logo Image URL</label>
                  <input
                    type="text"
                    className="form-input"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://example.com/logo.png or /uploads/logos/..."
                  />
                </div>
              </div>
            </div>

            {/* Contact Profiles */}
            <div className="glass-card" style={{ padding: '28px', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <User size={18} color="#34d399" />
                <span>Contact &amp; Administrative Details</span>
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
                <div className="form-group">
                  <label className="form-label">Contact Person Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={contactPersonName}
                    onChange={(e) => setContactPersonName(e.target.value)}
                    placeholder="Administrator full name"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Contact Email</label>
                  <input
                    type="email"
                    className="form-input"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="admin@organization.com"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Contact Phone</label>
                  <input
                    type="text"
                    className="form-input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 555-0199"
                  />
                </div>
              </div>
            </div>

            {/* Attendance & Correction Policy */}
            <div className="glass-card" style={{ padding: '28px', marginBottom: '28px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={18} color="#fbbf24" />
                <span>Attendance Governance Rules</span>
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="form-group">
                  <label className="form-label">Attendance Correction Request Window (Days)</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    className="form-input"
                    value={attendanceCorrectionWindowDays}
                    onChange={(e) => setAttendanceCorrectionWindowDays(Number(e.target.value))}
                  />
                  <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Staff can request attendance corrections up to this many days after the date.
                  </p>
                </div>
              </div>
            </div>

            {/* Submit Action */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                disabled={saving}
                className="btn btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 24px' }}
              >
                {saving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Saving Settings...</span>
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    <span>Save Settings</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      <OrgAdminMobileNav organizationCode={organizationCode} />
    </div>
  );
}
