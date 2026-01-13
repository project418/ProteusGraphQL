// src/modules/auth/interfaces/auth-types.ts

export interface AuthUser {
  id: string;
  email: string;
  timeJoined: number;
  tenantIds?: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse {
  user: AuthUser;
  tokens: AuthTokens;
  status?: string;
}

export interface RegisterResponse {
  user: AuthUser;
  tokens: AuthTokens;
  status?: string;
}

export interface TotpDevice {
  name: string;
  secret: string;
  qrCode: string;
}

export interface UserPaginationResult {
  users: AuthUser[];
  nextPaginationToken?: string;
}

export interface MfaVerificationResult {
  verified: boolean;
  tokens?: AuthTokens;
}

export interface AuthServiceResponse {
  user: AuthUser;
  tenant: any | null;
  availableTenants: any[];
  accessToken: string;
  refreshToken: string;
  permissions: any;
  requiresPasswordChange: boolean;
  requiresMfa: boolean;
}
