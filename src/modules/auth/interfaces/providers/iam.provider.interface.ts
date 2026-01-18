import { AuthUser, InviteInfo } from '../auth.entities';
import { UserPaginationResult } from '../auth.dtos';

export interface IIamProvider {
  // User Management
  getUser(userId: string): Promise<AuthUser | null>;
  getUserByEmail(email: string): Promise<AuthUser | null>;
  createUser(email: string, password: string): Promise<AuthUser>;
  updateUser(userId: string, data: any): Promise<AuthUser>;

  // Tenant Association
  createProviderTenant(tenantId: string): Promise<void>;
  associateUserToTenant(userId: string, tenantId: string): Promise<void>;
  disassociateUserFromTenant(userId: string, tenantId: string): Promise<void>;
  getTenantUsers(tenantId: string, limit?: number, paginationToken?: string): Promise<UserPaginationResult>;

  // Invites
  addPendingInvite(userId: string, token: string, invite: InviteInfo): Promise<void>;
  consumePendingInvite(userId: string, token: string): Promise<InviteInfo | null>;
}
