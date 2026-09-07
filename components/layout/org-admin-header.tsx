'use client';

import React from 'react';
import Link from 'next/link';
import { Menu, X, ArrowLeft } from 'lucide-react';
import styles from './org-admin-header.module.css';

interface OrgAdminHeaderProps {
  organizationCode: string;
  logoUrl?: string | null;
  panelTitle: string;
  panelSubtitle?: string;
  backHref?: string;
  headerMenuOpen?: boolean;
  onToggleHeaderMenu?: () => void;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

export function OrgAdminHeader({
  organizationCode,
  logoUrl,
  panelTitle,
  panelSubtitle,
  backHref,
  headerMenuOpen = false,
  onToggleHeaderMenu,
  actions,
  children,
}: OrgAdminHeaderProps) {
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
        <div className={styles.logoBox}>
          <img
            src={logoUrl || '/logo.svg'}
            alt="Org Logo"
            className={styles.logoImg}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = '/logo.svg';
            }}
          />
        </div>
        <div className={styles.mobileTextCol}>
          <span className={styles.mobileOrgCode}>{organizationCode}</span>
          <span className={styles.mobilePanelText}>{panelTitle}</span>
        </div>
      </div>

      {/* Right Action / Line Button Area */}
      <div className={styles.headerRight}>
        {actions && <div className={styles.desktopActions}>{actions}</div>}

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
