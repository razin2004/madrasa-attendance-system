'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

interface UseMobileNavScrollOptions {
  /** Minimum scroll pixel threshold to trigger direction change (hysteresis) */
  threshold?: number;
  /** Distance from top (in px) where navbar is ALWAYS forced to be visible */
  topThreshold?: number;
  /** Distance from bottom (in px) defining the iOS overscroll / bottom boundary zone */
  bottomThreshold?: number;
}

export function useMobileNavScroll(options: UseMobileNavScrollOptions = {}) {
  const {
    threshold = 8,
    topThreshold = 20,
    bottomThreshold = 50,
  } = options;

  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(true);

  // Store last scroll position & visibility state in refs to prevent race conditions during momentum scroll
  const lastScrollYRef = useRef<number>(0);
  const isVisibleRef = useRef<boolean>(true);

  // Keep ref in sync with state
  useEffect(() => {
    isVisibleRef.current = isVisible;
  }, [isVisible]);

  // 1. ROUTE CHANGE RESET: Ensure bottom nav is always visible on new route loads
  useEffect(() => {
    setIsVisible(true);
    isVisibleRef.current = true;
    if (typeof window !== 'undefined') {
      lastScrollYRef.current = window.scrollY;
    }
  }, [pathname]);

  // 2. MAIN SCROLL LISTENER WITH IOS OVERFLOW & NESTED CONTAINER PROTECTION
  useEffect(() => {
    if (typeof window === 'undefined') return;

    lastScrollYRef.current = window.scrollY;

    const handleScroll = (event: Event) => {
      // 2A. NESTED SCROLL FILTERING:
      // If the scroll event originated inside a nested container (modal, drawer, sheet, table, dropdown),
      // ignore it completely so main page bottom navigation state is not affected.
      if (
        event.target &&
        event.target !== document &&
        event.target !== window &&
        event.target !== document.documentElement &&
        event.target !== document.body
      ) {
        const targetElement = event.target as HTMLElement;
        if (
          targetElement.closest?.(
            '.mobile-drawer-sheet, .modal-overlay, [role="dialog"], [data-nested-scroll="true"], .table-responsive'
          ) ||
          (targetElement !== document.documentElement &&
            targetElement !== document.body &&
            (targetElement.scrollHeight > targetElement.clientHeight ||
              targetElement.scrollWidth > targetElement.clientWidth))
        ) {
          return;
        }
      }

      const currentScrollY = window.scrollY;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const documentHeight = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight
      );

      // 2B. VERY SHORT / UNSCROLLABLE PAGES: Keep navbar visible
      if (documentHeight <= viewportHeight + 40) {
        if (!isVisibleRef.current) {
          setIsVisible(true);
        }
        lastScrollYRef.current = currentScrollY;
        return;
      }

      // 2C. TOP OF PAGE & TOP OVERSCROLL:
      // Always show bottom nav when near the top of the page (or iOS top bounce with negative scrollY)
      if (currentScrollY <= topThreshold) {
        if (!isVisibleRef.current) {
          setIsVisible(true);
        }
        lastScrollYRef.current = Math.max(0, currentScrollY);
        return;
      }

      // 2D. BOTTOM OF PAGE & IOS RUBBER-BAND OVERSCROLL PROTECTION:
      const distanceFromBottom = documentHeight - (currentScrollY + viewportHeight);
      const isNearBottom = distanceFromBottom <= bottomThreshold;

      const delta = currentScrollY - lastScrollYRef.current;

      // When near bottom boundary (or in iOS bottom rubber-band overscroll):
      // DO NOT allow negative delta (upward scroll/bounce) to trigger showing the navbar!
      if (isNearBottom) {
        if (delta > 0 && isVisibleRef.current) {
          setIsVisible(false);
        }
        // Lock lastScrollYRef to prevent bounce recovery from polluting upward scroll detection
        lastScrollYRef.current = Math.min(currentScrollY, lastScrollYRef.current);
        return;
      }

      // 2E. THRESHOLD HYSTERESIS: Ignore micro scroll movements
      if (Math.abs(delta) < threshold) {
        return;
      }

      // 2F. MEANINGFUL SCROLL DIRECTION EVALUATION:
      if (delta > threshold) {
        // Genuine Downward Scroll -> HIDE NAV BAR
        if (isVisibleRef.current) {
          setIsVisible(false);
        }
        lastScrollYRef.current = currentScrollY;
      } else if (delta < -threshold) {
        // Genuine Upward Scroll -> SHOW NAV BAR
        if (!isVisibleRef.current) {
          setIsVisible(true);
        }
        lastScrollYRef.current = currentScrollY;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [threshold, topThreshold, bottomThreshold]);

  return isVisible;
}
