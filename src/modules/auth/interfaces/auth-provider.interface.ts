import { AuthUser, AuthTokens, TotpDevice, MfaVerificationResult, UserPaginationResult } from './auth-types';
import { RolePolicy, InviteInfo } from './rbac.interface';

export interface IAuthProvider {
  /**
   * Basic Authentication Operations
   * Note: context parameter is optional (type any), required for providers
   * like SuperTokens that need req/res objects.
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
    },
  ): Promise<AuthUser>;

  /**
   * Password Reset Flow
   */
  createPasswordResetToken(userId: string): Promise<string>;

  resetPassword(token: string, newPassword: string): Promise<boolean>;

  /**
   * MFA (Time-based One-Time Password) Management
   */
  createTotpDevice(userId: string, deviceName: string): Promise<TotpDevice>;

  verifyTotpDevice(userId: string, deviceName: string, code: string): Promise<MfaVerificationResult>;

  verifyMfaCode(userId: string, code: string): Promise<MfaVerificationResult>;

  removeTotpDevice(userId: string, deviceName: string): Promise<void>;

  listTotpDevices(userId: string): Promise<any[]>;

  /**
   * Multi-tenancy Management
   */
  associateUserToTenant(userId: string, tenantId: string): Promise<void>;

  disassociateUserFromTenant(userId: string, tenantId: string): Promise<void>;

  getTenantUsers(tenantId: string, limit?: number, paginationToken?: string): Promise<UserPaginationResult>;

  /**
   * Gets the user's role in the tenant.
   */
  getUserRoleInTenant(userId: string, tenantId: string): Promise<string | null>;

  /**
   * Assigns a role to the user in the tenant.
   */
  assignRoleToUser(userId: string, tenantId: string, roleName: string): Promise<void>;

  /**
   * Removes the user's role in the tenant.
   */
  removeUserRole(userId: string, tenantId: string): Promise<void>;

  /**
   * Lists defined roles in the tenant.
   */
  listTenantRoles(tenantId: string): Promise<string[]>;

  /**
   * Gets the policy (permissions) of a specific role.
   */
  getRolePolicy(tenantId: string, roleName: string): Promise<RolePolicy | null>;

  /**
   * Creates or updates a role policy.
   */
  setRolePolicy(tenantId: string, roleName: string, policy: RolePolicy): Promise<void>;

  /**
   * Deletes a role policy.
   */
  deleteRolePolicy(tenantId: string, roleName: string): Promise<void>;

  // --- INVITE MANAGEMENT ---

  addPendingInvite(userId: string, token: string, invite: InviteInfo): Promise<void>;

  consumePendingInvite(userId: string, token: string): Promise<InviteInfo | null>;
}
