import { GraphQLError } from 'graphql';
import crypto from 'crypto';
import { IAuthProvider } from '../interfaces/auth-provider.interface';
import { 
  AuthUser, 
  TotpDevice 
} from '../interfaces/auth.entities';
import { 
  AuthServiceResponse, 
  MfaVerificationResult, 
  UserPaginationResult, 
  AuthTokens, 
  UpdateUserResult 
} from '../interfaces/auth.dtos';
import { RolePolicy } from '../interfaces/rbac.types';
import { TenantService } from '../../tenant/services/tenant.service';
import { IAuthContext } from '../interfaces/auth-context.interface'

export class AuthService {
  constructor(
    private provider: IAuthProvider,
    private tenantService: TenantService,
  ) {}

  /**
   * Login Operation: Logs in with Auth Provider, then collects Tenant and Authorization information.
   */
  async login(email: string, password: string, context: IAuthContext): Promise<AuthServiceResponse> {
    // 1. Verify Credentials via Provider
    const credentialsUser = await this.provider.verifyCredentials(email, password);
    const userProfile = await this.provider.getUser(credentialsUser.id);
    const user = { ...credentialsUser, ...userProfile };

    const rawTenantIds = user.tenantIds || [];
    const tenantIds = rawTenantIds.filter((id) => id !== 'public');

    let activeTenantDetails: any = null;
    let availableTenantsDetails: any[] = [];
    let initialPermissions: any = null;
    let isMfaRequiredByPolicy = false;

    // 2. Load Tenant Context if available
    if (tenantIds.length > 0) {
      const activeTenantId = tenantIds[0]; // Default to first tenant

      try {
        const tempCtx = { ...context, tenantId: activeTenantId } as any;
        activeTenantDetails = await this.tenantService.getTenant(activeTenantId, tempCtx);

        // Fetch User Role & Policy for this tenant via Provider
        const role = await this.provider.getUserRoleInTenant(user.id, activeTenantId);
        if (role) {
          const policy = await this.provider.getRolePolicy(activeTenantId, role);
          if (policy) {
            initialPermissions = policy.permissions;
            if (policy.mfa_required) {
              isMfaRequiredByPolicy = true;
            }
          }
        }
      } catch (e) {
        console.warn('Error fetching active tenant details:', e);
      }

      // Load other available tenants for the switcher
      for (const tId of tenantIds) {
        try {
          const tempCtx = { ...context, tenantId: tId } as any;
          const tDetails = await this.tenantService.getTenant(tId, tempCtx);
          if (tDetails) availableTenantsDetails.push(tDetails);
        } catch (error) {
          console.warn(`Error fetching tenant ${tId}:`, error);
        }
      }
    }

    // 3. MFA & Password Policy Checks
    const requiresPasswordChange = await this.provider.getPasswordChangeRequirement(user.id);
    const devices = await this.provider.listTotpDevices(user.id);
    const hasMfaDevice = devices.some((d: any) => d.verified === true);

    const sessionPayload = {
      mfaEnforced: isMfaRequiredByPolicy,
      mfaEnabled: hasMfaDevice,
      mfaVerified: false,
      requiresPasswordChange: requiresPasswordChange,
    };

    // 4. Create Session
    const sessionResult = await this.provider.createNewSession(user.id, sessionPayload);

    return {
      user: user,
      tenant: activeTenantDetails,
      availableTenants: availableTenantsDetails,
      accessToken: sessionResult.tokens.accessToken,
      refreshToken: sessionResult.tokens.refreshToken,
      permissions: initialPermissions,
      requiresPasswordChange: requiresPasswordChange,
      requiresMfa: isMfaRequiredByPolicy || hasMfaDevice,
      mfaEnforced: isMfaRequiredByPolicy,
      mfaEnabled: hasMfaDevice,
    };
  }

  async register(
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    context: IAuthContext,
  ): Promise<AuthServiceResponse> {
    const createdUser = await this.provider.createUser(email, password);

    await this.provider.updateUser(createdUser.id, {
      firstName,
      lastName,
    });

    const userProfile = await this.provider.getUser(createdUser.id);
    const user = { ...createdUser, ...userProfile };

    // Default session payload for new users
    const sessionPayload = {
      mfaEnforced: false,
      mfaEnabled: false,
      mfaVerified: false,
      requiresPasswordChange: false,
    };

    const sessionResult = await this.provider.createNewSession(user.id, sessionPayload);

    return {
      user: user,
      tenant: null,
      availableTenants: [],
      accessToken: sessionResult.tokens.accessToken,
      refreshToken: sessionResult.tokens.refreshToken,
      permissions: null,
      requiresPasswordChange: false,
      requiresMfa: false,
      mfaEnforced: false,
      mfaEnabled: false,
    };
  }

  async refreshToken(token: string, context: IAuthContext): Promise<AuthTokens> {
    return await this.provider.refreshToken(token, context);
  }

  async logout(userId: string): Promise<boolean> {
    await this.provider.logout(userId);
    return true;
  }

  // --- Tenant Management ---

  async createOwnTenant(userId: string, tenantName: string, context: IAuthContext): Promise<any> {
    // 1. Create Tenant in Database (via gRPC)
    const newTenant: any = await this.tenantService.createTenant(tenantName, context as any);
    const newTenantId = newTenant.id;

    try {
      // 2. Register Tenant in Auth Provider
      await this.provider.createProviderTenant(newTenantId);

      // 3. Associate User with Tenant
      await this.provider.associateUserToTenant(userId, newTenantId);

      // 4. Create and Assign Admin Policy
      const adminPolicy: RolePolicy = {
        description: 'Root Admin Policy',
        mfa_required: true,
        permissions: {
          system_iam: { access: true, actions: ['*'] },
          '*': { access: true, actions: ['*'] },
        },
      };

      await this.provider.setRolePolicy(newTenantId, 'admin', adminPolicy);
      await this.provider.assignRoleToUser(userId, newTenantId, 'admin');

      return newTenant;

    } catch (error) {
      // ROLLBACK: If provider setup fails, delete the created tenant from DB to maintain consistency
      console.error(`Failed to setup provider for tenant ${newTenantId}. Rolling back...`, error);
      try {
        await this.tenantService.deleteTenant(newTenantId, context as any);
      } catch (rollbackError) {
        console.error(`CRITICAL: Failed to rollback tenant ${newTenantId}`, rollbackError);
      }
      throw new GraphQLError('Failed to create tenant organization. Please try again.');
    }
  }

  async updateTenant(name: string, context: IAuthContext): Promise<any> {
    if (!context.tenantId) {
      throw new GraphQLError('Tenant ID header is required.');
    }
    return await this.tenantService.updateTenant(context.tenantId, name, context as any);
  }

  // --- User Invitation and Management ---

  async inviteUser(email: string, roleName: string, tenantId: string, senderId: string): Promise<boolean> {
    const existingUser = await this.provider.getUserByEmail(email);

    if (existingUser) {
      const inviteToken = crypto.randomBytes(32).toString('hex');

      await this.provider.addPendingInvite(existingUser.id, inviteToken, {
        tenantId,
        roleName,
        invitedBy: senderId,
        createdAt: Date.now(),
      });

      // TODO: Replace with real email service
      const inviteLink = `http://localhost:5173/auth/join-tenant?token=${inviteToken}`;
      console.log('📨 INVITE LINK (Existing User):', inviteLink);
      return true;
    } else {
      const tempPassword = crypto.randomBytes(12).toString('hex') + '!Aa1';
      const newUser = await this.provider.createUser(email, tempPassword);

      await this.provider.setPasswordChangeRequirement(newUser.id, true);
      await this.provider.associateUserToTenant(newUser.id, tenantId);
      await this.provider.assignRoleToUser(newUser.id, tenantId, roleName);

      // TODO: Replace with real email service
      console.log('📨 NEW USER CREATED (Temp Password):', email, tempPassword);
      return true;
    }
  }

  async acceptInvite(userId: string, token: string): Promise<boolean> {
    const inviteData = await this.provider.consumePendingInvite(userId, token);

    if (!inviteData) {
      throw new GraphQLError('Invalid or expired invite token.');
    }

    await this.provider.associateUserToTenant(userId, inviteData.tenantId);
    await this.provider.assignRoleToUser(userId, inviteData.tenantId, inviteData.roleName);

    return true;
  }

  // --- Helper Methods ---

  async getUser(userId: string): Promise<AuthUser | null> {
    return await this.provider.getUser(userId);
  }

  async getTenants(userId: string, context: IAuthContext): Promise<any[]> {
    const user = await this.provider.getUser(userId);
    if (!user || !user.tenantIds) return [];

    const tenantIds = user.tenantIds.filter((id) => id !== 'public');
    const tenants = [];

    for (const tId of tenantIds) {
      try {
        const tempCtx = { ...context, tenantId: tId } as any;
        const tenant = await this.tenantService.getTenant(tId, tempCtx);
        if (tenant) {
          tenants.push(tenant);
        }
      } catch (error) {
        console.warn(`Error fetching tenant ${tId}:`, error);
      }
    }
    return tenants;
  }

  async getTenantUsers(tenantId: string, limit?: number, paginationToken?: string): Promise<UserPaginationResult> {
    return await this.provider.getTenantUsers(tenantId, limit, paginationToken);
  }

  // --- Policy & RBAC Proxy Methods ---

  async getUserRoleInTenant(userId: string, tenantId: string): Promise<string | null> {
    return await this.provider.getUserRoleInTenant(userId, tenantId);
  }

  async getRolePolicy(tenantId: string, roleName: string): Promise<RolePolicy | null> {
    return await this.provider.getRolePolicy(tenantId, roleName);
  }

  async listTenantRoles(tenantId: string): Promise<string[]> {
    return await this.provider.listTenantRoles(tenantId);
  }

  async setRolePolicy(tenantId: string, roleName: string, policy: RolePolicy): Promise<void> {
    return await this.provider.setRolePolicy(tenantId, roleName, policy);
  }

  async deleteRolePolicy(tenantId: string, roleName: string): Promise<void> {
    return await this.provider.deleteRolePolicy(tenantId, roleName);
  }

  async assignRole(userId: string, tenantId: string, roleName: string): Promise<void> {
    await this.provider.assignRoleToUser(userId, tenantId, roleName);
  }

  async removeUserFromTenant(userId: string, tenantId: string): Promise<void> {
    await this.provider.disassociateUserFromTenant(userId, tenantId);
    await this.provider.removeUserRole(userId, tenantId);
  }

  // --- MFA & Security ---

  async createTotpDevice(userId: string, deviceName: string): Promise<TotpDevice> {
    return await this.provider.createTotpDevice(userId, deviceName);
  }

  async verifyTotpDevice(
    userId: string,
    deviceName: string,
    totp: string,
    context: IAuthContext,
  ): Promise<MfaVerificationResult> {
    const result = await this.provider.verifyTotpDevice(userId, deviceName, totp);

    if (result.verified && context.session) {
      // Elevate session trust
      const currentPayload = context.session.getAccessTokenPayload();
      const newPayload = {
        ...currentPayload,
        mfaEnabled: true,
        mfaVerified: true,
      };

      const sessionResult = await this.provider.createNewSession(userId, newPayload);
      await context.session.revoke();

      return {
        verified: true,
        accessToken: sessionResult.tokens.accessToken,
        refreshToken: sessionResult.tokens.refreshToken,
      };
    }
    return result;
  }

  async verifyMfa(userId: string, totp: string, context: IAuthContext): Promise<MfaVerificationResult> {
    const result = await this.provider.verifyMfaCode(userId, totp);

    if (result.verified && context.session) {
      // Elevate session trust
      const currentPayload = context.session.getAccessTokenPayload();
      const newPayload = {
        ...currentPayload,
        mfaVerified: true,
      };

      const sessionResult = await this.provider.createNewSession(userId, newPayload);
      await context.session.revoke();

      return {
        verified: true,
        accessToken: sessionResult.tokens.accessToken,
        refreshToken: sessionResult.tokens.refreshToken,
      };
    }
    return result;
  }

  async removeTotpDevice(userId: string, deviceName: string, context: IAuthContext): Promise<boolean> {
    await this.provider.removeTotpDevice(userId, deviceName);

    const devices = await this.provider.listTotpDevices(userId);
    const hasRemaining = devices.length > 0;

    if (context.session) {
      await context.session.mergeIntoAccessTokenPayload({
        mfaEnabled: hasRemaining,
        mfaVerified: hasRemaining,
      });
    }
    return true;
  }

  async listTotpDevices(userId: string): Promise<{ name: string }[]> {
    return await this.provider.listTotpDevices(userId);
  }

  async sendPasswordResetEmail(email: string): Promise<boolean> {
    const user = await this.provider.getUserByEmail(email);
    if (!user) return true; // Security: always return true

    const token = await this.provider.createPasswordResetToken(user.id);
    if (token) {
      // TODO: Replace with real email service
      const resetLink = `http://localhost:5173/auth/reset-password?token=${token}`;
      console.log('📧 PASSWORD RESET LINK:', resetLink);
    }
    return true;
  }

  async resetPassword(token: string, password: string): Promise<boolean> {
    const success = await this.provider.resetPassword(token, password);
    if (!success) {
      throw new GraphQLError('Invalid or expired password reset token.', {
        extensions: { code: 'BAD_REQUEST' },
      });
    }
    return true;
  }

  async updateUser(
    userId: string,
    input: { email?: string; password?: string; currentPassword?: string },
    context?: IAuthContext,
  ): Promise<UpdateUserResult> {
    const updatedUser = await this.provider.updateUser(userId, input);
    let newTokens: any = {};

    if (input.password) {
      await this.provider.setPasswordChangeRequirement(userId, false);

      let sessionPayload = {};
      if (context && context.session) {
        const currentPayload = context.session.getAccessTokenPayload();
        sessionPayload = { ...currentPayload, requiresPasswordChange: false };
      } else {
        // Fallback context for non-session updates
        const devices = await this.provider.listTotpDevices(userId);
        const hasMfaDevice = devices.length > 0;
        sessionPayload = {
          mfaEnforced: false,
          mfaEnabled: hasMfaDevice,
          mfaVerified: true,
          requiresPasswordChange: false,
        };
      }

      const sessionResult = await this.provider.createNewSession(userId, sessionPayload);
      newTokens = {
        accessToken: sessionResult.tokens.accessToken,
        refreshToken: sessionResult.tokens.refreshToken,
      };
    }

    return {
      user: updatedUser,
      ...newTokens,
    };
  }
}