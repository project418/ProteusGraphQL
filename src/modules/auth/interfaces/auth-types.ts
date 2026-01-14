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
  sessionHandle: string;
  status?: string;
}

export interface RegisterResponse {
  user: AuthUser;
  tokens: AuthTokens;
  sessionHandle: string;
  status?: string;
}

export interface TotpDevice {
  deviceName: string;
  secret: string;
  qrCode: string;
}

export interface UserPaginationResult {
  users: AuthUser[];
  nextPaginationToken?: string;
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
  permissions: any;
  requiresPasswordChange: boolean;
  requiresMfa: boolean;
  mfaEnforced: boolean;
  mfaEnabled: boolean;
}
