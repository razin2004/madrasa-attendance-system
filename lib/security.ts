import bcrypt from 'bcryptjs';
import crypto from 'crypto';

/**
 * Hash password or PIN with bcrypt (10 rounds)
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Verify password or PIN against bcrypt hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate cryptographically secure random hexadecimal token
 */
export function generateSecureRandomString(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Generate a strong, random temporary password (e.g. "Kp9#mX2$vL8q")
 */
export function generateTemporaryPassword(length: number = 12): string {
  const lowercase = 'abcdefghjkmnpqrstuvwxyz';
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const numbers = '23456789';
  const symbols = '!@#$%&*';
  const allChars = lowercase + uppercase + numbers + symbols;

  // Guarantee at least 1 from each group
  let password = [
    lowercase[crypto.randomInt(0, lowercase.length)],
    uppercase[crypto.randomInt(0, uppercase.length)],
    numbers[crypto.randomInt(0, numbers.length)],
    symbols[crypto.randomInt(0, symbols.length)],
  ];

  for (let i = 4; i < length; i++) {
    password.push(allChars[crypto.randomInt(0, allChars.length)]);
  }

  // Shuffle securely
  for (let i = password.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [password[i], password[j]] = [password[j], password[i]];
  }

  return password.join('');
}

/**
 * Generate exactly 6-digit numeric OTP (100000 - 999999)
 */
export function generateNumericOTP(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Generate unpredictable 6-digit numeric PIN for staff
 */
export function generateNumericPin(length: number = 6): string {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length);
  return crypto.randomInt(min, max).toString();
}

/**
 * Secure SHA-256 hash for OTPs, tokens, and secrets
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

/**
 * Normalize email (lowercase, trimmed, and strip accidental www. prefix)
 */
export function normalizeEmail(email: string): string {
  let clean = email.trim().toLowerCase();
  clean = clean.replace(/@www\./i, '@');
  return clean;
}

/**
 * Generate unique, URL-safe organization code (e.g. ACME01, SHIFT01, APEX01)
 */
export function generateOrganizationCodeBase(orgName: string): string {
  const clean = orgName
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 6);

  const base = clean.length >= 3 ? clean : (clean + 'ORG').slice(0, 6);
  return base;
}

/**
 * Aadhaar-Safe Salted Hashing for intra-organization duplicate detection (Section 17, 18)
 * Never exposes the raw Aadhaar number.
 */
export function hashAadhaar(idNumber: string, salt: string = 'ShiftGuard_Aadhaar_Salt_2026'): string {
  const cleanNumber = idNumber.replace(/\D/g, '');
  return crypto
    .createHmac('sha256', salt)
    .update(cleanNumber)
    .digest('hex');
}

/**
 * Extract clean last 4 digits of Aadhaar or Government ID
 */
export function extractIdLast4(idNumber: string): string {
  const clean = idNumber.replace(/\D/g, '');
  return clean.length >= 4 ? clean.slice(-4) : clean;
}

/**
 * Generate formatted, sequential Staff ID (e.g. "STF001", "STF002")
 */
export function generateStaffId(seqNumber: number, prefix: string = 'STF'): string {
  return `${prefix}${seqNumber.toString().padStart(3, '0')}`;
}

/**
 * Generate 64-character cryptographically secure random device secret (Section 29, 30)
 */
export function generateDeviceSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash device secret with SHA-256 for secure storage
 */
export function hashDeviceSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret.trim()).digest('hex');
}

/**
 * Safely get the public base URL of the app for email links, activation URLs, and redirects.
 * Dynamically fall back to incoming request host if NEXT_PUBLIC_APP_URL is localhost or unconfigured in production.
 */
export function getAppBaseUrl(req?: Request): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const isProduction = process.env.NODE_ENV === 'production';

  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl.replace(/\/+$/, '');
  }

  if (req) {
    try {
      const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
      const proto = req.headers.get('x-forwarded-proto') || (isProduction ? 'https' : 'http');
      if (host) {
        return `${proto}://${host}`.replace(/\/+$/, '');
      }
    } catch {}
  }

  return envUrl ? envUrl.replace(/\/+$/, '') : 'http://localhost:3000';
}
