import { InviteInfo } from './auth.entities';

export interface UserMetadataStructure {
  tenants?: {
    [tenantId: string]: string;
  };
  pending_invites?: {
    [token: string]: InviteInfo;
  };
  requires_password_change?: boolean;
}
