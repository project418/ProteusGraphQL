import { AuthUser } from './auth.entities';
import { RolePolicy } from './rbac.types';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface MfaVerificationResult {
  verified: boolean;
  accessToken?: string;
  refreshToken?: string;
}

export interface AuthServiceResponse {
  user: AuthUser;
  tenant: any | null;
  availableTenants: any[];
  accessToken: string;
  refreshToken: string;
  permissions: RolePolicy['permissions'] | null;
  requiresPasswordChange: boolean;
  requiresMfa: boolean;
  mfaEnforced: boolean;
  mfaEnabled: boolean;
}

export interface UserPaginationResult {
  users: AuthUser[];
  nextPaginationToken?: string;
}

export interface UpdateUserResult {
  user: AuthUser;
  accessToken?: string;
  refreshToken?: string;
}