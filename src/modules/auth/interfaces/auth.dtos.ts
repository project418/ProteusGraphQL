import { AuthUser } from './auth.entities';

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
  role: string | null;
  permissions: string[] | null;
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
