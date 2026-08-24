'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { useToast } from '@/components/feedback/toast-provider';
import {
  Building2,
  User,
  Mail,
  Phone,
  Upload,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  X,
  FileImage,
  Globe,
  ShieldCheck,
} from 'lucide-react';

export default function RegisterOrganizationPage() {
  const router = useRouter();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active Step: 1 = Basic Info, 2 = Contact Admin, 3 = Logo & Submission
  const [currentStep, setCurrentStep] = useState<number>(1);

  const [formData, setFormData] = useState({
    name: '',
    organizationCode: '',
    contactPersonName: '',
    contactEmail: '',
    phone: '',
    agreedToTerms: false,
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    const finalValue = type === 'checkbox' ? checked : value;
    
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'organizationCode' ? (value as string).toUpperCase().replace(/[^A-Z0-9]/g, '') : finalValue,
    }));

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
    setServerError(null);
  };

  const handleFileSelect = (file: File) => {
    const validExtensions = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
    if (!validExtensions.includes(file.type)) {
      setErrors((prev) => ({
        ...prev,
        logo: 'Please upload a valid image file (PNG, JPG, WEBP, or SVG).',
      }));
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setErrors((prev) => ({
        ...prev,
        logo: 'Logo file size exceeds 2MB limit.',
      }));
      return;
    }

    setLogoFile(file);
    setErrors((prev) => ({ ...prev, logo: '' }));

    const reader = new FileReader();
    reader.onload = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Step 1 Validation
  const validateStep1 = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim() || formData.name.trim().length < 2) {
      newErrors.name = 'Organization name is required (minimum 2 characters).';
    }

    const code = formData.organizationCode.trim();
    if (!code) {
      newErrors.organizationCode = 'Organization Code is required.';
    } else if (!/^[A-Z0-9]{3,12}$/.test(code)) {
      newErrors.organizationCode = 'Code must be 3–12 uppercase letters or numbers (e.g. ABCENG).';
    }

    const phoneRegex = /^\+?[0-9\s\-()]{7,20}$/;
    if (!formData.phone.trim() || !phoneRegex.test(formData.phone.trim())) {
      newErrors.phone = 'Please enter a valid phone number with country code.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Step 2 Validation
  const validateStep2 = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.contactPersonName.trim() || formData.contactPersonName.trim().length < 2) {
      newErrors.contactPersonName = 'Contact person full name is required.';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.contactEmail.trim() || !emailRegex.test(formData.contactEmail.trim())) {
      newErrors.contactEmail = 'Please enter a valid email address.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Step 3 Validation
  const validateStep3 = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!logoFile) {
      newErrors.logo = 'Organization logo is required.';
    }

    if (!formData.agreedToTerms) {
      newErrors.agreedToTerms = 'You must confirm that all details supplied are accurate.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextStep = () => {
    setServerError(null);
    if (currentStep === 1) {
      if (validateStep1()) setCurrentStep(2);
    } else if (currentStep === 2) {
      if (validateStep2()) setCurrentStep(3);
    }
  };

  const handlePrevStep = () => {
    setServerError(null);
    if (currentStep > 1) setCurrentStep((prev) => prev - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validateStep1() || !validateStep2() || !validateStep3()) {
      toast.error('Please resolve all highlighted form errors.');
      return;
    }

    setIsSubmitting(true);

    try {
      const data = new FormData();
      data.append('name', formData.name.trim());
      data.append('organizationCode', formData.organizationCode.trim().toUpperCase());
      data.append('contactPersonName', formData.contactPersonName.trim());
      data.append('contactEmail', formData.contactEmail.trim().toLowerCase());
      data.append('phone', formData.phone.trim());
      if (logoFile) {
        data.append('logo', logoFile);
      }

      const res = await fetch('/api/organizations/register', {
        method: 'POST',
        body: data,
      });

      const result = await res.json();

      if (res.ok && result.success) {
        toast.success('Organization registration submitted successfully!');
        router.push(`/register/success?name=${encodeURIComponent(result.name || formData.name)}`);
      } else {
        setServerError(result.error || 'Unable to submit registration. Please check your details.');
        toast.error(result.error || 'Registration failed.');
      }
    } catch (err: any) {
      setServerError('A network error occurred while submitting. Please try again.');
      toast.error('Network connection error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />

      <main style={{ flex: 1, padding: '24px 0 60px 0' }}>
        <div className="container" style={{ maxWidth: '640px' }}>
          {/* Header Banner */}
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                margin: '0 auto 12px auto',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #4f46e5 0%, #312e81 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(99, 102, 241, 0.35)',
              }}
            >
              <Building2 size={22} color="#ffffff" />
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.4px' }}>
              Register your Organization
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Establish your organization identity on ShiftGuard with custom workspace routing.
            </p>
          </div>

          {/* Wizard Step Progress Bar */}
          <div style={{ marginBottom: '20px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: currentStep >= 1 ? '#818cf8' : 'var(--text-muted)',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                <div
                  style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    backgroundColor: currentStep >= 1 ? '#4f46e5' : 'rgba(255,255,255,0.1)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  1
                </div>
                <span>Details</span>
              </div>

              <div style={{ flex: 1, height: '2px', backgroundColor: 'rgba(255,255,255,0.1)', margin: '0 8px' }}>
                <div
                  style={{
                    height: '100%',
                    backgroundColor: '#4f46e5',
                    width: currentStep >= 2 ? '100%' : '0%',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: currentStep >= 2 ? '#818cf8' : 'var(--text-muted)',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                <div
                  style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    backgroundColor: currentStep >= 2 ? '#4f46e5' : 'rgba(255,255,255,0.1)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  2
                </div>
                <span>Admin</span>
              </div>

              <div style={{ flex: 1, height: '2px', backgroundColor: 'rgba(255,255,255,0.1)', margin: '0 8px' }}>
                <div
                  style={{
                    height: '100%',
                    backgroundColor: '#4f46e5',
                    width: currentStep >= 3 ? '100%' : '0%',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: currentStep >= 3 ? '#818cf8' : 'var(--text-muted)',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                <div
                  style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    backgroundColor: currentStep >= 3 ? '#4f46e5' : 'rgba(255,255,255,0.1)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  3
                </div>
                <span>Submit</span>
              </div>
            </div>
          </div>

          {/* Registration Form Card */}
          <div className="glass-card" style={{ padding: '24px 18px' }}>
            {serverError && (
              <div
                style={{
                  backgroundColor: 'var(--danger-bg)',
                  border: '1px solid var(--danger-border)',
                  color: 'var(--danger-text)',
                  padding: '14px 18px',
                  borderRadius: '8px',
                  fontSize: '13.5px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  marginBottom: '24px',
                }}
              >
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>{serverError}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              {/* STEP 1: ORGANIZATION DETAILS */}
              {currentStep === 1 && (
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', marginBottom: '20px' }}>
                    Step 1 — Organization Basic Details
                  </h3>

                  {/* Organization Name */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="name">
                      Organization Name <span className="required">*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        id="name"
                        name="name"
                        type="text"
                        placeholder="e.g. Acme Health Solutions"
                        value={formData.name}
                        onChange={handleInputChange}
                        className="form-input"
                        style={{ paddingLeft: '40px' }}
                        required
                      />
                      <Building2
                        size={18}
                        color="var(--text-muted)"
                        style={{ position: 'absolute', left: '14px', top: '13px' }}
                      />
                    </div>
                    {errors.name && <div className="form-error">{errors.name}</div>}
                  </div>

                  {/* Organization Code (Custom Short Form Code) */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="organizationCode">
                      Organization Code (Short Form) <span className="required">*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        id="organizationCode"
                        name="organizationCode"
                        type="text"
                        maxLength={12}
                        placeholder="e.g. ABCENG"
                        value={formData.organizationCode}
                        onChange={handleInputChange}
                        className="form-input"
                        style={{ paddingLeft: '40px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}
                        required
                      />
                      <Globe
                        size={18}
                        color="var(--text-muted)"
                        style={{ position: 'absolute', left: '14px', top: '13px' }}
                      />
                    </div>
                    <div className="form-hint">
                      Unique 3–12 uppercase code. Forms your custom workspace path:{' '}
                      <strong style={{ color: '#818cf8' }}>
                        /{formData.organizationCode || 'ABCENG'}
                      </strong>
                    </div>
                    {errors.organizationCode && <div className="form-error">{errors.organizationCode}</div>}
                  </div>

                  {/* Phone Number */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="phone">
                      Phone Number <span className="required">*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        id="phone"
                        name="phone"
                        type="tel"
                        placeholder="e.g. +1 555 123 4567 or +91 9876543210"
                        value={formData.phone}
                        onChange={handleInputChange}
                        className="form-input"
                        style={{ paddingLeft: '40px' }}
                        required
                      />
                      <Phone
                        size={18}
                        color="var(--text-muted)"
                        style={{ position: 'absolute', left: '14px', top: '13px' }}
                      />
                    </div>
                    {errors.phone && <div className="form-error">{errors.phone}</div>}
                  </div>

                  <div style={{ marginTop: '32px' }}>
                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="btn btn-primary"
                      style={{ width: '100%', padding: '14px', fontSize: '15px' }}
                    >
                      <span>Continue to Step 2 (Administrator)</span>
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: ADMINISTRATOR CONTACT */}
              {currentStep === 2 && (
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', marginBottom: '20px' }}>
                    Step 2 — Primary Contact &amp; Administrator
                  </h3>

                  {/* Contact Person Name */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="contactPersonName">
                      Contact Person Full Name <span className="required">*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        id="contactPersonName"
                        name="contactPersonName"
                        type="text"
                        placeholder="e.g. Jane Doe"
                        value={formData.contactPersonName}
                        onChange={handleInputChange}
                        className="form-input"
                        style={{ paddingLeft: '40px' }}
                        required
                      />
                      <User
                        size={18}
                        color="var(--text-muted)"
                        style={{ position: 'absolute', left: '14px', top: '13px' }}
                      />
                    </div>
                    {errors.contactPersonName && (
                      <div className="form-error">{errors.contactPersonName}</div>
                    )}
                  </div>

                  {/* Contact Person Email */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="contactEmail">
                      Administrator Email Address <span className="required">*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        id="contactEmail"
                        name="contactEmail"
                        type="email"
                        placeholder="e.g. admin@acmehealth.com"
                        value={formData.contactEmail}
                        onChange={handleInputChange}
                        className="form-input"
                        style={{ paddingLeft: '40px' }}
                        required
                      />
                      <Mail
                        size={18}
                        color="var(--text-muted)"
                        style={{ position: 'absolute', left: '14px', top: '13px' }}
                      />
                    </div>
                    <div className="form-hint">
                      Your primary administrator login credentials will be dispatched to this email upon Super Admin approval.
                    </div>
                    {errors.contactEmail && <div className="form-error">{errors.contactEmail}</div>}
                  </div>

                  <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
                    <button
                      type="button"
                      onClick={handlePrevStep}
                      className="btn btn-secondary"
                      style={{ flex: 1, padding: '14px' }}
                    >
                      <ArrowLeft size={16} />
                      <span>Back</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="btn btn-primary"
                      style={{ flex: 2, padding: '14px' }}
                    >
                      <span>Continue to Step 3 (Branding)</span>
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: BRANDING & FINAL VERIFICATION */}
              {currentStep === 3 && (
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', marginBottom: '20px' }}>
                    Step 3 — Organization Branding &amp; Final Review
                  </h3>

                  {/* Logo Upload */}
                  <div className="form-group">
                    <label className="form-label">
                      Organization Logo <span className="required">*</span>
                    </label>

                    {!logoPreview ? (
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsDragging(true);
                        }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          border: `2px dashed ${isDragging ? 'var(--primary-light)' : 'var(--border-medium)'}`,
                          borderRadius: 'var(--radius-md)',
                          padding: '32px 20px',
                          textAlign: 'center',
                          cursor: isSubmitting ? 'not-allowed' : 'pointer',
                          backgroundColor: isDragging ? 'rgba(99, 102, 241, 0.08)' : 'rgba(13, 18, 31, 0.6)',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                          onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                          style={{ display: 'none' }}
                          disabled={isSubmitting}
                        />
                        <div
                          style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '50%',
                            backgroundColor: 'rgba(99, 102, 241, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 12px auto',
                          }}
                        >
                          <Upload size={20} color="#818cf8" />
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc', marginBottom: '4px' }}>
                          Click to upload or drag &amp; drop
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          PNG, JPG, WEBP, or SVG (Max 2MB)
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '14px 18px',
                          backgroundColor: 'rgba(13, 18, 31, 0.8)',
                          border: '1px solid var(--border-medium)',
                          borderRadius: 'var(--radius-md)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <div
                            style={{
                              width: '48px',
                              height: '48px',
                              borderRadius: '8px',
                              background: 'rgba(255,255,255,0.05)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              overflow: 'hidden',
                              border: '1px solid var(--border-subtle)',
                            }}
                          >
                            <img
                              src={logoPreview}
                              alt="Logo Preview"
                              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                            />
                          </div>
                          <div>
                            <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#f8fafc' }}>
                              {logoFile?.name}
                            </div>
                            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                              {logoFile ? `${(logoFile.size / 1024).toFixed(1)} KB` : ''}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={removeLogo}
                          disabled={isSubmitting}
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '6px', color: 'var(--text-muted)' }}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}

                    {errors.logo && <div className="form-error">{errors.logo}</div>}
                  </div>

                  {/* Summary Review Card */}
                  <div
                    style={{
                      margin: '24px 0',
                      padding: '16px 18px',
                      backgroundColor: 'rgba(99, 102, 241, 0.08)',
                      border: '1px solid rgba(99, 102, 241, 0.2)',
                      borderRadius: '8px',
                    }}
                  >
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Registration Summary Review
                    </div>
                    <div style={{ fontSize: '13.5px', color: '#ffffff', marginBottom: '4px' }}>
                      <strong>Organization:</strong> {formData.name} ({formData.organizationCode})
                    </div>
                    <div style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      <strong>Contact:</strong> {formData.contactPersonName} &bull; {formData.contactEmail}
                    </div>
                    <div style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}>
                      <strong>Phone:</strong> {formData.phone}
                    </div>
                  </div>

                  {/* Terms & Verification Checkbox */}
                  <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        name="agreedToTerms"
                        checked={formData.agreedToTerms}
                        onChange={handleInputChange}
                        disabled={isSubmitting}
                        style={{ marginTop: '3px' }}
                      />
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                        I confirm that I am an authorized representative of this organization and that all submitted information is accurate.
                      </span>
                    </label>
                    {errors.agreedToTerms && <div className="form-error">{errors.agreedToTerms}</div>}
                  </div>

                  <div style={{ display: 'flex', gap: '12px', marginTop: '28px' }}>
                    <button
                      type="button"
                      onClick={handlePrevStep}
                      disabled={isSubmitting}
                      className="btn btn-secondary"
                      style={{ flex: 1, padding: '14px' }}
                    >
                      <ArrowLeft size={16} />
                      <span>Back</span>
                    </button>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="btn btn-primary"
                      style={{ flex: 2, padding: '14px', fontSize: '15px' }}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          <span>Submitting...</span>
                        </>
                      ) : (
                        <>
                          <span>Submit Registration Application</span>
                          <ArrowRight size={16} />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '13px', color: 'var(--text-muted)' }}>
                Already registered?{' '}
                <Link href="/login" style={{ color: '#818cf8', fontWeight: 600 }}>
                  Sign In Portal &rarr;
                </Link>
              </div>
            </form>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
