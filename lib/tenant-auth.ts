import { prisma } from './prisma';
import { getCurrentSession, SessionContext } from './session';
import { Organization, StaffProfile, Branch, StaffDevice } from '@prisma/client';

export interface TenantAuthResult {
  authorized: boolean;
  errorStatus?: number;
  errorMessage?: string;
  session?: SessionContext;
  organization?: Organization;
}

export interface StaffAuthResult extends TenantAuthResult {
  staffProfile?: any;
}

/**
 * Validate that the current request has an active session with ORG_ADMIN or SUPER_ADMIN
 * privileges for the specified organizationCode.
 */
export async function requireOrgAdmin(organizationCode: string): Promise<TenantAuthResult> {
  const code = organizationCode?.toUpperCase().trim();
  if (!code) {
    return {
      authorized: false,
      errorStatus: 400,
      errorMessage: 'Organization code is missing.',
    };
  }

  // 1. Validate Session
  const session = await getCurrentSession();
  if (!session) {
    return {
      authorized: false,
      errorStatus: 401,
      errorMessage: 'Authentication required. Please sign in.',
    };
  }

  // 2. Resolve Target Organization
  const organization = await prisma.organization.findFirst({
    where: {
      organizationCode: { equals: code, mode: 'insensitive' },
    },
  });

  if (!organization) {
    return {
      authorized: false,
      errorStatus: 404,
      errorMessage: `Organization "${code}" not found.`,
    };
  }

  if (organization.status !== 'ACTIVE') {
    return {
      authorized: false,
      errorStatus: 403,
      errorMessage: `Organization is currently ${organization.status.toLowerCase()}.`,
    };
  }

  // 3. Super Admin bypass check
  if (session.user.role === 'SUPER_ADMIN') {
    return {
      authorized: true,
      session,
      organization,
    };
  }

  // 4. Strict Tenant Isolation Check
  if (session.user.organizationId !== organization.id) {
    return {
      authorized: false,
      errorStatus: 403,
      errorMessage: 'Access denied: You do not belong to this organization.',
    };
  }

  // 5. Role Authorization
  if (session.user.role !== 'ORG_ADMIN' && session.user.role !== 'SUB_ADMIN') {
    return {
      authorized: false,
      errorStatus: 403,
      errorMessage: 'Administrator privileges required for this action.',
    };
  }

  return {
    authorized: true,
    session,
    organization,
  };
}

/**
 * Validate that the current request has an active session for a STAFF member
 * belonging to the specified organizationCode.
 */
export async function requireStaff(organizationCode: string): Promise<StaffAuthResult> {
  const code = organizationCode?.toUpperCase().trim();
  if (!code) {
    return {
      authorized: false,
      errorStatus: 400,
      errorMessage: 'Organization code is missing.',
    };
  }

  // 1. Validate Session
  const session = await getCurrentSession();
  if (!session) {
    return {
      authorized: false,
      errorStatus: 401,
      errorMessage: 'Authentication required. Please sign in.',
    };
  }

  // 2. Resolve Target Organization
  const organization = await prisma.organization.findFirst({
    where: {
      organizationCode: { equals: code, mode: 'insensitive' },
    },
  });

  if (!organization) {
    return {
      authorized: false,
      errorStatus: 404,
      errorMessage: `Organization "${code}" not found.`,
    };
  }

  if (organization.status !== 'ACTIVE') {
    return {
      authorized: false,
      errorStatus: 403,
      errorMessage: `Organization is currently ${organization.status.toLowerCase()}.`,
    };
  }

  // 3. Strict Tenant Isolation Check
  if (session.user.organizationId !== organization.id) {
    return {
      authorized: false,
      errorStatus: 403,
      errorMessage: 'Access denied: You do not belong to this organization.',
    };
  }

  // 4. Resolve Staff Profile & Device
  const staffProfile = await prisma.staffProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
        },
      },
      devices: true,
      branchAssignments: {
        include: { branch: true },
      },
    },
  });

  if (!staffProfile) {
    return {
      authorized: false,
      errorStatus: 403,
      errorMessage: 'Staff profile not found for this account.',
    };
  }

  if (session.user.status !== 'ACTIVE') {
    return {
      authorized: false,
      errorStatus: 403,
      errorMessage: 'Staff account is currently inactive.',
    };
  }

  return {
    authorized: true,
    session,
    organization,
    staffProfile,
  };
}
