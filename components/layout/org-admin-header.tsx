'use client';

import React from 'react';
import Link from 'next/link';
import { Menu, X, ArrowLeft } from 'lucide-react';
import { OrgLogo } from '@/components/branding/org-logo';
import styles from './org-admin-header.module.css';

interface OrgAdminHeaderProps {
  organizationCode: string;
  organizationName?: string;
  showOrgNameOnMobile?: boolean;
  logoUrl?: string | null;
  panelTitle: string;
  panelSubtitle?: string;
  backHref?: string;
  hideMobileOrgBranding?: boolean;
  headerMenuOpen?: boolean;
  onToggleHeaderMenu?: () => void;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

export function OrgAdminHeader({
  organizationCode,
  organizationName,
  showOrgNameOnMobile = false,
  logoUrl,
  panelTitle,
  panelSubtitle,
  backHref,
  hideMobileOrgBranding,
  headerMenuOpen = false,
  onToggleHeaderMenu,
  actions,
  children,
}: OrgAdminHeaderProps) {
  const shouldHideBranding = hideMobileOrgBranding ?? !!backHref;

  return (
    <header className={styles.headerBar}>
      {/* Desktop Header Left (Hidden on mobile) */}
      <div className={styles.desktopHeaderLeft}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {backHref && (
            <Link href={backHref} className={styles.backBtn} aria-label="Go Back">
              <ArrowLeft size={16} />
            </Link>
          )}
          <div>
            <h1 className={styles.desktopTitle}>{panelTitle}</h1>
            {panelSubtitle && <p className={styles.desktopSubtitle}>{panelSubtitle}</p>}
          </div>
        </div>
      </div>

      {/* Mobile Header Left (Hidden on desktop) */}
      <div className={styles.mobileHeaderLeft}>
        {backHref && (
          <Link href={backHref} className={styles.backBtn} aria-label="Go Back">
            <ArrowLeft size={16} />
          </Link>
        )}
        {!shouldHideBranding && (
          <div className={styles.logoBox}>
            <OrgLogo logoUrl={logoUrl} name={organizationName || organizationCode} size={20} />
          </div>
        )}
        <div className={styles.mobileTextCol}>
          {!shouldHideBranding && (
            <span className={styles.mobileOrgCode}>
              {showOrgNameOnMobile && organizationName ? organizationName : organizationCode}
            </span>
          )}
          <span className={shouldHideBranding ? styles.mobileDetailTitle : styles.mobilePanelText}>
            {panelTitle}
          </span>
          {shouldHideBranding && panelSubtitle && (
            <span className={styles.mobileDetailSubtitle}>{panelSubtitle}</span>
          )}
        </div>
      </div>

      {/* Right Action / Line Button Area */}
      <div className={styles.headerRight}>
        {actions && <div className={styles.desktopActions}>{actions}</div>}
        <span className={styles.mobileRoleTag}>Org Admin</span>

        {onToggleHeaderMenu && (
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={onToggleHeaderMenu}
              className={styles.lineButton}
              aria-label="Toggle Navigation Menu"
              aria-expanded={headerMenuOpen}
            >
              {headerMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>

            {headerMenuOpen && (
              <>
                {/* Fixed Backdrop Overlay: Catches any click outside the popup and closes it */}
                <div
                  style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 999,
                    cursor: 'default',
                    backgroundColor: 'transparent',
                  }}
                  onClick={onToggleHeaderMenu}
                />
                <div style={{ position: 'relative', zIndex: 1000 }}>
                  {children}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
