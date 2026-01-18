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

export interface TotpDevice {
  deviceName: string;
  secret: string;
  qrCode: string;
  verified?: boolean;
}

export interface InviteInfo {
  tenantId: string;
  roleName: string;
  invitedBy: string;
  createdAt: number;
}
