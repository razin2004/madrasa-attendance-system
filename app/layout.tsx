import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ToastProvider } from '@/components/feedback/toast-provider';

export const metadata: Metadata = {
  title: 'ShiftGuard — Multi-Tenant Rostering & Time-Attendance SaaS',
  description:
    'ShiftGuard is an enterprise multi-tenant workforce governance platform with branch-based attendance, rostering, and multi-tier identity.',
  manifest: '/manifest.json',
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
