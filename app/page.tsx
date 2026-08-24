'use client';

import React from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import {
  Shield,
  Building2,
  Lock,
  ArrowRight,
  Sparkles,
  Users,
  Calendar,
  Clock,
  MapPin,
  Smartphone,
  BarChart3,
  Network,
  CheckCircle2,
  Navigation,
} from 'lucide-react';
import styles from './Landing.module.css';

export default function HomePage() {
  return (
    <div className={styles.pageContainer}>
      <div className="bg-glow-layer" />
      <Header />

      <main style={{ flex: 1 }}>
        {/* Hero Section */}
        <section className={styles.heroSection}>
          <div className="container" style={{ maxWidth: '980px' }}>
            <div className={styles.heroBadge}>
              <Sparkles size={15} color="#818cf8" />
              <span>ShiftGuard Enterprise 3.0 • Multi-Tenant Workforce SaaS</span>
            </div>

            <h1 className={styles.heroTitle}>
              Smarter Rostering.{' '}
              <span className="text-gradient">Verified Attendance.</span>
            </h1>

            <p className={styles.heroSubtitle}>
              ShiftGuard enforces 3-Layer Zero-Trust Attendance: Registered Hardware Devices, Branch IPs, and Geofenced GPS Locations with seamless multi-tenant governance.
            </p>

            <div className={styles.ctaGroup}>
              <Link href="/register" className="btn btn-gradient btn-lg">
                <Building2 size={18} />
                <span>Register Your Organization</span>
                <ArrowRight size={18} />
              </Link>

              <Link href="/login" className="btn btn-secondary btn-lg">
                <Lock size={18} color="#818cf8" />
                <span>Sign In to Workspace</span>
              </Link>
            </div>
          </div>
        </section>

        {/* 3-Layer Security Section (Section 5) */}
        <section style={{ padding: '24px 0 40px 0' }}>
          <div className="container">
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                3-Layer Zero-Trust Attendance Verification
              </h2>
              <p className={styles.sectionDescription}>
                Normal attendance is allowed ONLY when all three verification layers pass simultaneously.
              </p>
            </div>

            <div className={styles.featureGrid}>
              {/* Layer 1 */}
              <div className="glass-card glass-card-hover" style={{ padding: '20px 18px' }}>
                <div
                  className={styles.featureIconBox}
                  style={{
                    backgroundColor: 'rgba(99, 102, 241, 0.15)',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    color: '#818cf8',
                  }}
                >
                  <Smartphone size={20} />
                </div>
                <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '3px' }}>
                  Layer 1
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>
                  Registered Device
                </h3>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  Validates authorized hardware secret stored securely in browser storage. Prevents clocking in from unauthorized devices.
                </p>
              </div>

              {/* Layer 2 */}
              <div className="glass-card glass-card-hover" style={{ padding: '20px 18px' }}>
                <div
                  className={styles.featureIconBox}
                  style={{
                    backgroundColor: 'rgba(6, 182, 212, 0.15)',
                    border: '1px solid rgba(6, 182, 212, 0.3)',
                    color: '#38bdf8',
                  }}
                >
                  <Network size={20} />
                </div>
                <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '3px' }}>
                  Layer 2
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>
                  Approved Branch Network
                </h3>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  Verifies public IP against real-time active branch identities. Staff must be connected to authorized workplace Wi-Fi.
                </p>
              </div>

              {/* Layer 3 */}
              <div className="glass-card glass-card-hover" style={{ padding: '20px 18px' }}>
                <div
                  className={styles.featureIconBox}
                  style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    color: '#34d399',
                  }}
                >
                  <Navigation size={20} />
                </div>
                <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '3px' }}>
                  Layer 3
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>
                  Geofence Boundary
                </h3>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  Calculates GPS coordinates against configured branch center point and radius. Supports desktop fallback positioning.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Multi-Branch Rostering & Features Section */}
        <section style={{ padding: '24px 0 40px 0' }}>
          <div className="container">
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                Built for Enterprise Reliability &amp; Compliance
              </h2>
              <p className={styles.sectionDescription}>
                Complete operational visibility across shifts, rosters, leaves, and analytics.
              </p>
            </div>

            <div className={styles.featureGrid}>
              {/* Feature 1 */}
              <div className="glass-card glass-card-hover" style={{ padding: '18px 16px' }}>
                <Calendar size={20} color="#818cf8" style={{ marginBottom: '12px' }} />
                <h3 style={{ fontSize: '15.5px', fontWeight: 700, color: '#ffffff', marginBottom: '4px' }}>
                  Shift &amp; Roster Management
                </h3>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  Define recurring shift patterns, working days, minimum staffing requirements, overnight shifts, and daily roster overrides.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="glass-card glass-card-hover" style={{ padding: '18px 16px' }}>
                <Users size={20} color="#38bdf8" style={{ marginBottom: '12px' }} />
                <h3 style={{ fontSize: '15.5px', fontWeight: 700, color: '#ffffff', marginBottom: '4px' }}>
                  Staff &amp; Branch Directory
                </h3>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  Manage physical branch locations, assigned staff, hardware device registrations, and profile security status.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="glass-card glass-card-hover" style={{ padding: '18px 16px' }}>
                <Clock size={20} color="#34d399" style={{ marginBottom: '12px' }} />
                <h3 style={{ fontSize: '15.5px', fontWeight: 700, color: '#ffffff', marginBottom: '4px' }}>
                  Leave &amp; Corrections Workflow
                </h3>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  Submit leave applications with live staffing impact analysis and review attendance correction requests with audit trails.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="glass-card glass-card-hover" style={{ padding: '18px 16px' }}>
                <BarChart3 size={20} color="#fbbf24" style={{ marginBottom: '12px' }} />
                <h3 style={{ fontSize: '15.5px', fontWeight: 700, color: '#ffffff', marginBottom: '4px' }}>
                  Daily &amp; Monthly Reports
                </h3>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  Export daily or monthly attendance summaries to CSV and PDF format with clock-in times, late minutes, and verification states.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works (Section 11) */}
        <section style={{ padding: '24px 0 50px 0' }}>
          <div className="container">
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                How ShiftGuard Works
              </h2>
              <p className={styles.sectionDescription}>
                Simple 5-step operational workflow for organizations and staff.
              </p>
            </div>

            <div className={styles.howItWorksGrid}>
              <div className={styles.stepCard}>
                <span className={styles.stepNumber}>STEP 01</span>
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', marginBottom: '4px' }}>
                  Register Organization
                </h4>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.45' }}>
                  Submit organization details and admin contact info for platform setup.
                </p>
              </div>

              <div className={styles.stepCard}>
                <span className={styles.stepNumber}>STEP 02</span>
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', marginBottom: '4px' }}>
                  Set Up Branches
                </h4>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.45' }}>
                  Configure workplace physical locations, network IPs, and geofence boundaries.
                </p>
              </div>

              <div className={styles.stepCard}>
                <span className={styles.stepNumber}>STEP 03</span>
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', marginBottom: '4px' }}>
                  Add Staff &amp; Shifts
                </h4>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.45' }}>
                  Add staff members, assign branches, create shift patterns, and publish rosters.
                </p>
              </div>

              <div className={styles.stepCard}>
                <span className={styles.stepNumber}>STEP 04</span>
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', marginBottom: '4px' }}>
                  3-Layer Verification
                </h4>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.45' }}>
                  Staff verifies registered device, branch network IP, and geofence location.
                </p>
              </div>

              <div className={styles.stepCard}>
                <span className={styles.stepNumber}>STEP 05</span>
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', marginBottom: '4px' }}>
                  Track Attendance
                </h4>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.45' }}>
                  Review real-time attendance logs, manage corrections, and generate reports.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA (Section 12) */}
        <section style={{ padding: '30px 0 50px 0', textAlign: 'center' }}>
          <div className="container" style={{ maxWidth: '800px' }}>
            <div className="glass-card" style={{ padding: '28px 20px', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
              <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', marginBottom: '10px', letterSpacing: '-0.3px' }}>
                Ready to simplify workforce attendance?
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: '1.5' }}>
                Deploy ShiftGuard zero-trust attendance and rostering infrastructure for your organization today.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                <Link href="/register" className="btn btn-gradient btn-lg">
                  <Building2 size={16} />
                  <span>Register Organization</span>
                  <ArrowRight size={16} />
                </Link>
                <Link href="/login" className="btn btn-secondary btn-lg">
                  <Lock size={16} color="#818cf8" />
                  <span>Sign In</span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
