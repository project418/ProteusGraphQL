export interface AuthUser {
  id: string;
  email: string;
  timeJoined: number;
  tenantIds?: string[];

  profile?: UserProfile;
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

export interface AuthTenant {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
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
