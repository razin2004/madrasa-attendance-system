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
        <section style={{ padding: '40px 0 70px 0' }}>
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
              <div className="glass-card glass-card-hover" style={{ padding: '30px 24px' }}>
                <div
                  className={styles.featureIconBox}
                  style={{
                    backgroundColor: 'rgba(99, 102, 241, 0.15)',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    color: '#818cf8',
                  }}
                >
                  <Smartphone size={24} />
                </div>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '4px' }}>
                  Layer 1
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>
                  Registered Device
                </h3>
                <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                  Validates authorized hardware secret stored securely in browser storage. Prevents clocking in from unauthorized devices.
                </p>
              </div>

              {/* Layer 2 */}
              <div className="glass-card glass-card-hover" style={{ padding: '30px 24px' }}>
                <div
                  className={styles.featureIconBox}
                  style={{
                    backgroundColor: 'rgba(6, 182, 212, 0.15)',
                    border: '1px solid rgba(6, 182, 212, 0.3)',
                    color: '#38bdf8',
                  }}
                >
                  <Network size={24} />
                </div>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '4px' }}>
                  Layer 2
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>
                  Approved Branch Network
                </h3>
                <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                  Verifies public IP against real-time active branch identities. Staff must be connected to authorized workplace Wi-Fi.
                </p>
              </div>

              {/* Layer 3 */}
              <div className="glass-card glass-card-hover" style={{ padding: '30px 24px' }}>
                <div
                  className={styles.featureIconBox}
                  style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    color: '#34d399',
                  }}
                >
                  <Navigation size={24} />
                </div>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '4px' }}>
                  Layer 3
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>
                  Geofence Boundary
                </h3>
                <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                  Calculates GPS coordinates against configured branch center point and radius. Supports desktop fallback positioning.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Multi-Branch Rostering & Features Section */}
        <section style={{ padding: '40px 0 70px 0' }}>
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
              <div className="glass-card glass-card-hover" style={{ padding: '26px 22px' }}>
                <Calendar size={24} color="#818cf8" style={{ marginBottom: '16px' }} />
                <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>
                  Shift &amp; Roster Management
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  Define recurring shift patterns, working days, minimum staffing requirements, overnight shifts, and daily roster overrides.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="glass-card glass-card-hover" style={{ padding: '26px 22px' }}>
                <Users size={24} color="#38bdf8" style={{ marginBottom: '16px' }} />
                <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>
                  Staff &amp; Branch Directory
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  Manage physical branch locations, assigned staff, hardware device registrations, and profile security status.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="glass-card glass-card-hover" style={{ padding: '26px 22px' }}>
                <Clock size={24} color="#34d399" style={{ marginBottom: '16px' }} />
                <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>
                  Leave &amp; Corrections Workflow
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  Submit leave applications with live staffing impact analysis and review attendance correction requests with audit trails.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="glass-card glass-card-hover" style={{ padding: '26px 22px' }}>
                <BarChart3 size={24} color="#fbbf24" style={{ marginBottom: '16px' }} />
                <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>
                  Daily &amp; Monthly Reports
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  Export daily or monthly attendance summaries to CSV and PDF format with clock-in times, late minutes, and verification states.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works (Section 11) */}
        <section style={{ padding: '40px 0 80px 0' }}>
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
                <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>
                  Register Organization
                </h4>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  Submit organization details and admin contact info for platform setup.
                </p>
              </div>

              <div className={styles.stepCard}>
                <span className={styles.stepNumber}>STEP 02</span>
                <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>
                  Set Up Branches
                </h4>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  Configure workplace physical locations, network IPs, and geofence boundaries.
                </p>
              </div>

              <div className={styles.stepCard}>
                <span className={styles.stepNumber}>STEP 03</span>
                <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>
                  Add Staff &amp; Shifts
                </h4>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  Add staff members, assign branches, create shift patterns, and publish rosters.
                </p>
              </div>

              <div className={styles.stepCard}>
                <span className={styles.stepNumber}>STEP 04</span>
                <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>
                  3-Layer Verification
                </h4>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  Staff verifies registered device, branch network IP, and geofence location.
                </p>
              </div>

              <div className={styles.stepCard}>
                <span className={styles.stepNumber}>STEP 05</span>
                <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>
                  Track Attendance
                </h4>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  Review real-time attendance logs, manage corrections, and generate reports.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA (Section 12) */}
        <section style={{ padding: '60px 0 90px 0', textAlign: 'center' }}>
          <div className="container" style={{ maxWidth: '800px' }}>
            <div className="glass-card" style={{ padding: '50px 36px', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
              <h2 style={{ fontSize: '30px', fontWeight: 800, color: '#ffffff', marginBottom: '14px', letterSpacing: '-0.5px' }}>
                Ready to simplify workforce attendance?
              </h2>
              <p style={{ fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '32px', lineHeight: '1.6' }}>
                Deploy ShiftGuard zero-trust attendance and rostering infrastructure for your organization today.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
                <Link href="/register" className="btn btn-gradient btn-lg">
                  <Building2 size={18} />
                  <span>Register Your Organization</span>
                  <ArrowRight size={18} />
                </Link>
                <Link href="/login" className="btn btn-secondary btn-lg">
                  <Lock size={18} color="#818cf8" />
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
