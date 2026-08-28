import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ToastProvider } from '@/components/feedback/toast-provider';

export const metadata: Metadata = {
  title: 'ShiftGuard — Multi-Tenant Rostering & Time-Attendance SaaS',
  description:
    'ShiftGuard is an enterprise multi-tenant workforce governance platform with branch-based attendance, rostering, and multi-tier identity.',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ShiftGuard',
  },
};

export const viewport: Viewport = {
  themeColor: '#0b0f19',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="shortcut icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icon.svg" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body>
        <div className="bg-glow-layer" />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
