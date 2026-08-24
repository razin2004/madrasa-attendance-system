# ShiftGuard — Multi-Tenant Rostering & Time-Attendance SaaS

ShiftGuard is an enterprise-grade multi-tenant Rostering and Time-Attendance SaaS built for high-security workplace environments, field operations, and multi-branch organizations.

---

## 🔒 Core Verification Security Model

ShiftGuard enforces a non-negotiable **Three-Layer Attendance Verification Engine** for all normal Clock In and Clock Out punches:

```
+-----------------------+     +-----------------------+     +-----------------------+
|   LAYER 1: DEVICE     |     |   LAYER 2: NETWORK    |     |  LAYER 3: GEOFENCE    |
| Registered Staff      |  +  | Branch Public IP /    |  +  | GPS Coordinates       |
| Hardware Binding      |     | Approved Subnets      |     | Within Radius (m)     |
+-----------------------+     +-----------------------+     +-----------------------+
```

1. **Layer 1 (Device)**: Hardware/browser secret token bound strictly to a registered `StaffDevice`.
2. **Layer 2 (Network IP)**: Verification against registered Branch Public IP addresses or `BranchNetworkIdentity` pool.
3. **Layer 3 (Geofence GPS)**: Haversine distance evaluation ensuring physical presence within the branch's configured geofence radius.

All three verification layers MUST pass (`isReady === true`) for normal Clock In / Clock Out. Exceptional punches require the explicit `MANUAL` attendance or `ADJUSTED` missing-punch correction workflows with mandatory audit logging.

---

## 🚀 System Architecture & Technology Stack

- **Framework**: Next.js 14 (App Router, Server Actions, API Routes)
- **Language**: TypeScript (Strict Mode)
- **Database & ORM**: PostgreSQL (Render / Neon serverless) via Prisma ORM
- **Authentication**: Custom HMAC Session & JWT engine (30-day persistent sessions for staff PWA, OTP 2FA for Super Admin)
- **Email Gateway**: Brevo API (Slot 1 & Slot 2) with SMTP fallback
- **File Storage**: Cloudflare R2 / S3 compatible object storage
- **UI Styling**: Scoped Vanilla CSS Modules
- **PWA Capabilities**: Standalone mobile PWA manifest, offline service worker (`sw.js`)

---

## 🛠️ Environment Variables Configuration

Copy `.env.example` to `.env` or `.env.local` and set the following production configuration:

```bash
# Database Connections
DATABASE_URL="postgresql://user:password@neon.tech/shiftguard?sslmode=require"

# Platform Security Secrets
JWT_SECRET="generate-32-char-random-secret"
SESSION_SECRET="generate-32-char-random-secret"

# Super Admin Platform Account
SUPER_ADMIN_EMAIL="superadmin@yourdomain.com"
SUPER_ADMIN_PASSWORD="YourSecurePassword123!"
SUPER_ADMIN_NAME="Platform Super Admin"

# Base Application URL
NEXT_PUBLIC_APP_URL="https://shiftguard.yourdomain.com"
NODE_ENV="production"

# Email Integration (Brevo / SMTP)
EMAIL_PROVIDER="brevo"
BREVO_API_KEY="xkeysib-your-primary-brevo-api-key"
BREVO_API_KEY_2="xkeysib-your-secondary-brevo-api-key"
BREVO_SENDER_EMAIL="noreply@yourdomain.com"
BREVO_SENDER_NAME="ShiftGuard"

# SMTP Fallback
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="smtp-user@yourdomain.com"
SMTP_PASS="your-smtp-app-password"
SMTP_EMAIL="smtp-user@yourdomain.com"
EMAIL_FROM="ShiftGuard <noreply@yourdomain.com>"
```

---

## 📦 Database Setup & Production Deployment

1. **Apply Database Migrations**:
   ```bash
   npx prisma migrate deploy
   ```

2. **Generate Prisma Client**:
   ```bash
   npx prisma generate
   ```

3. **Seed Initial Super Admin Account**:
   ```bash
   npx tsx prisma/seed.ts
   ```

4. **Build Production Application**:
   ```bash
   npm run build
   ```

5. **Start Production Server**:
   ```bash
   npm run start
   ```

---

## 🧪 Testing & Verification Suites

ShiftGuard includes comprehensive automated end-to-end verification suites:

- **Critical Fix Verification Suite**:
  ```bash
  npx tsx scripts/test-critical-fix.ts
  ```
- **Phase 11 Audit Verification Suite**:
  ```bash
  npx tsx scripts/test-phase11-audit.ts
  ```

---

## 🛡️ Production Security Hardening Checklist

- [x] **HTTP Security Headers**: Enforced `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `HSTS`, `Permissions-Policy`.
- [x] **Aadhaar Privacy**: Only last 4 digits stored; full Aadhaar numbers are never persisted or logged.
- [x] **Multi-Tenant Isolation**: All queries strictly scoped by `organizationId`. Cross-tenant access is rejected at server level.
- [x] **Secret Safety**: No credentials or private keys in Git repository; `.gitignore` configured.
- [x] **Rate Limiting**: IP and account rate limit protection on login, OTP, and sensitive endpoints.
- [x] **Trusted Proxy Header Priority**: Client public IP extracted using Cloudflare (`CF-Connecting-IP`), `X-Real-IP`, or `X-Forwarded-For`.
