export type OrganizationStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED';
export type UserRole = 'SUPER_ADMIN' | 'ORG_ADMIN' | 'SUB_ADMIN' | 'STAFF';
export type UserStatus = 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
export type SecurityTokenType = 'LOGIN_OTP' | 'PASSWORD_RESET' | 'INVITATION';
export type EmailStatus = 'PENDING' | 'SENT' | 'FAILED';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  mustChangePassword?: boolean;
  organizationId?: string | null;
  organization?: {
    id: string;
    organizationCode: string | null;
    name: string;
    logoUrl: string | null;
    status: OrganizationStatus;
  } | null;
}

export interface SessionData {
  id: string;
  sessionToken: string;
  userId: string;
  user: AuthenticatedUser;
  expiresAt: Date;
}
