export interface AuthUser {
  id: string;
  email: string;
  timeJoined: number;
  tenantIds?: string[];
  firstName?: string;
  lastName?: string;
  title?: string;
  phone?: string;
  countryCode?: string;
  timezone?: string;
  language?: string;
  avatar?: string;
}

export interface UserProfile {
  firstName?: string;
  lastName?: string;
  title?: string;
  phone?: string;
  countryCode?: string;
  timezone?: string;
  language?: string;
  avatar?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
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

// Unified response type for Login and Register operations
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

export interface UpdateUserResult {
  user: AuthUser;
  accessToken?: string;
  refreshToken?: string;
}