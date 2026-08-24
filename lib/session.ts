import { cookies } from 'next/headers';
import { prisma } from './prisma';
import { generateSecureRandomString } from './security';
import { AuthenticatedUser } from '@/types';

export const SESSION_COOKIE_NAME = 'shiftguard_session';
export const SESSION_DURATION_DAYS = 30; // 30-day persistent login (Section 5)

export interface SessionContext {
  sessionToken: string;
  user: AuthenticatedUser;
}

/**
 * Create a new database session and return the session token
 */
export async function createSession(
  userId: string,
  metadata?: { ipAddress?: string; userAgent?: string }
): Promise<{ sessionToken: string; expiresAt: Date }> {
  const sessionToken = generateSecureRandomString(32);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

  await prisma.session.create({
    data: {
      sessionToken,
      userId,
      expiresAt,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    },
  });

  return { sessionToken, expiresAt };
}

/**
 * Set session cookie in Next.js Response / cookies store
 */
export function setSessionCookie(sessionToken: string, expiresAt: Date): void {
  try {
    const cookieStore = cookies();
    cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
    });
  } catch (err) {
    // Handled in route handlers that manage headers directly if needed
  }
}

/**
 * Clear session cookie
 */
export function clearSessionCookie(): void {
  try {
    const cookieStore = cookies();
    cookieStore.set(SESSION_COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
  } catch (err) {
    // Handled in route handlers
  }
}

/**
 * Get and validate the currently active session from the cookie store
 */
export async function getCurrentSession(): Promise<SessionContext | null> {
  try {
    const cookieStore = cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionToken) return null;

    return validateSessionToken(sessionToken);
  } catch (err) {
    return null;
  }
}

/**
 * Validate a raw session token against the database
 */
export async function validateSessionToken(sessionToken: string): Promise<SessionContext | null> {
  const session = await prisma.session.findUnique({
    where: { sessionToken },
    include: {
      user: {
        include: {
          organization: true,
        },
      },
    },
  });

  if (!session) return null;

  // Check if expired (Section 7)
  if (new Date() > session.expiresAt) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  // Check if user is active (Section 7)
  if (session.user.status !== 'ACTIVE') {
    return null;
  }

  const authenticatedUser: AuthenticatedUser = {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: session.user.role as any,
    status: session.user.status as any,
    mustChangePassword: session.user.mustChangePassword,
    organizationId: session.user.organizationId,
    organization: session.user.organization
      ? {
          id: session.user.organization.id,
          organizationCode: session.user.organization.organizationCode,
          name: session.user.organization.name,
          logoUrl: session.user.organization.logoUrl,
          status: session.user.organization.status as any,
        }
      : null,
  };

  return {
    sessionToken,
    user: authenticatedUser,
  };
}

/**
 * Invalidate a session by token
 */
export async function invalidateSession(sessionToken: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { sessionToken },
  });
}
