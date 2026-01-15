import { AuthUser, AuthTokens, TotpDevice, MfaVerificationResult, UserPaginationResult } from './auth-types';
import { RolePolicy, InviteInfo } from './rbac.interface';

export interface IAuthProvider {
  /**
   * Basic Authentication Operations
   */
  verifyCredentials(email: string, password: string): Promise<AuthUser>;

  createUser(email: string, password: string): Promise<AuthUser>;

  createNewSession(userId: string, payload: any): Promise<{ tokens: AuthTokens; sessionHandle: string }>;

  refreshToken(refreshToken: string, context?: any): Promise<AuthTokens>;

  logout(userId: string): Promise<void>;

  /**
   * User Management
   */
  getUser(userId: string): Promise<AuthUser | null>;

  getUserByEmail(email: string): Promise<AuthUser | null>;

  updateUser(
    userId: string,
    data: {
      email?: string;
      password?: string;
      currentPassword?: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
      countryCode?: string;
      timezone?: string;
      language?: string;
      avatar?: string;
    },
  ): Promise<AuthUser>;

  /**
   * Password Reset Flow
   */
  createPasswordResetToken(userId: string): Promise<string>;

  resetPassword(token: string, newPassword: string): Promise<boolean>;

  getPasswordChangeRequirement(userId: string): Promise<boolean>;

  setPasswordChangeRequirement(userId: string, required: boolean): Promise<void>;

  /**
   * MFA (Time-based One-Time Password) Management
   */
  createTotpDevice(userId: string, deviceName: string): Promise<TotpDevice>;

  verifyTotpDevice(userId: string, deviceName: string, code: string): Promise<MfaVerificationResult>;

  verifyMfaCode(userId: string, code: string): Promise<MfaVerificationResult>;

  removeTotpDevice(userId: string, deviceName: string): Promise<void>;

  listTotpDevices(userId: string): Promise<any[]>;

  /**
   * Multi-tenancy & Role Management
   */
  createProviderTenant(tenantId: string): Promise<void>;

  associateUserToTenant(userId: string, tenantId: string): Promise<void>;

  disassociateUserFromTenant(userId: string, tenantId: string): Promise<void>;

  getTenantUsers(tenantId: string, limit?: number, paginationToken?: string): Promise<UserPaginationResult>;

  getUserRoleInTenant(userId: string, tenantId: string): Promise<string | null>;

  assignRoleToUser(userId: string, tenantId: string, roleName: string): Promise<void>;

  removeUserRole(userId: string, tenantId: string): Promise<void>;

  listTenantRoles(tenantId: string): Promise<string[]>;

  getRolePolicy(tenantId: string, roleName: string): Promise<RolePolicy | null>;

  setRolePolicy(tenantId: string, roleName: string, policy: RolePolicy): Promise<void>;

  deleteRolePolicy(tenantId: string, roleName: string): Promise<void>;

  // --- Invite Management ---

  addPendingInvite(userId: string, token: string, invite: InviteInfo): Promise<void>;

  consumePendingInvite(userId: string, token: string): Promise<InviteInfo | null>;
}