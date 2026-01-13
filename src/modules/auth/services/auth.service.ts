import { GraphQLError } from 'graphql';
import crypto from 'crypto';
import { IAuthProvider } from '../interfaces/auth-provider.interface';
import {
  AuthServiceResponse,
  AuthUser,
  TotpDevice,
  MfaVerificationResult,
  UserPaginationResult,
  AuthTokens,
} from '../interfaces/auth-types';
import { IAuthContext } from '../interfaces/auth-context.interface';
import { RolePolicy } from '../interfaces/rbac.interface';
import { tenantClient } from '../../../clients/proteus.client';
import { grpcCall } from '../../../utils/grpc-helper';

export class AuthService {
  constructor(private provider: IAuthProvider) {}

  /**
   * Login Operation: Logs in with Auth Provider, then collects Tenant and Authorization information.
   */
  async login(email: string, password: string, context: IAuthContext): Promise<AuthServiceResponse> {
    // 1. Login via Provider
    const loginResult = await this.provider.login(email, password, context);
    const user = loginResult.user;

    // 2. Get Tenant Information and Permissions
    const rawTenantIds = user.tenantIds || [];
    const tenantIds = rawTenantIds.filter((id) => id !== 'public');

    let activeTenantId: string | undefined;
    let activeTenantDetails: any = null;
    let availableTenantsDetails: any[] = [];
    let initialPermissions: any = null;
    let isMfaRequiredByPolicy = false;

    if (tenantIds.length > 0) {
      activeTenantId = tenantIds[0];

      try {
        const tempCtx = { ...context, tenantId: activeTenantId } as any;
        activeTenantDetails = await grpcCall(tenantClient, 'GetTenant', { id: activeTenantId }, tempCtx);

        // Role check via Provider instead of PolicyService
        const role = await this.provider.getUserRoleInTenant(user.id, activeTenantId);
        if (role) {
          // Policy check via Provider instead of PolicyService
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

      for (const tId of tenantIds) {
        try {
          const tempCtx = { ...context, tenantId: tId } as any;
          const tDetails = await grpcCall(tenantClient, 'GetTenant', { id: tId }, tempCtx);
          availableTenantsDetails.push(tDetails);
        } catch (error) {
          console.warn(`Error fetching tenant ${tId}:`, error);
        }
      }
    }

    const devices = await this.provider.listTotpDevices(user.id);
    const hasMfaDevice = devices.length > 0;

    return {
      user: loginResult.user,
      tenant: activeTenantDetails,
      availableTenants: availableTenantsDetails,
      accessToken: loginResult.tokens.accessToken,
      refreshToken: loginResult.tokens.refreshToken,
      permissions: initialPermissions,
      requiresPasswordChange: false,
      requiresMfa: isMfaRequiredByPolicy || hasMfaDevice,
    };
  }

  async register(email: string, password: string, context: IAuthContext): Promise<AuthServiceResponse> {
    const result = await this.provider.register(email, password, context);

    return {
      user: result.user,
      tenant: null,
      availableTenants: [],
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
      permissions: null,
      requiresPasswordChange: false,
      requiresMfa: false,
    };
  }

  async refreshToken(token: string, context: IAuthContext): Promise<AuthTokens> {
    return await this.provider.refreshToken(token, context);
  }

  // --- Helper Methods ---

  async getUser(userId: string): Promise<AuthUser | null> {
    return await this.provider.getUser(userId);
  }

  async getTenantUsers(tenantId: string, limit?: number, paginationToken?: string): Promise<UserPaginationResult> {
    return await this.provider.getTenantUsers(tenantId, limit, paginationToken);
  }

  async sendPasswordResetEmail(email: string): Promise<boolean> {
    const user = await this.provider.getUserByEmail(email);
    if (!user) return true;

    const token = await this.provider.createPasswordResetToken(user.id);

    if (token) {
      const resetLink = `http://localhost:3000/auth/reset-password?token=${token}`;
      console.log('\n========================================');
      console.log('📧 PASSWORD RESET LINK:', resetLink);
      console.log('========================================\n');
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

  // --- Policy & RBAC Bridge Methods ---

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

  // --- MFA Operations ---

  async createTotpDevice(userId: string, deviceName: string): Promise<TotpDevice> {
    return await this.provider.createTotpDevice(userId, deviceName);
  }

  async verifyTotpDevice(
    userId: string,
    deviceName: string,
    totp: string,
    context: IAuthContext,
  ): Promise<MfaVerificationResult> {
    const verified = await this.provider.verifyTotpDevice(userId, deviceName, totp);

    if (verified && context.session) {
      await context.session.mergeIntoAccessTokenPayload({
        mfaEnabled: true,
        mfaVerified: true,
      });
    }

    return { verified: true };
  }

  async verifyMfa(userId: string, totp: string, context: IAuthContext): Promise<MfaVerificationResult> {
    const result = await this.provider.verifyMfaCode(userId, totp);

    if (result.verified && context.session) {
      await context.session.mergeIntoAccessTokenPayload({ mfaVerified: true });
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

  // --- User Invitation and Management ---

  async inviteUser(email: string, roleName: string, tenantId: string, senderId: string): Promise<boolean> {
    const existingUser = await this.provider.getUserByEmail(email);

    if (existingUser) {
      const inviteToken = crypto.randomBytes(32).toString('hex');

      // Provider instead of PolicyService
      await this.provider.addPendingInvite(existingUser.id, inviteToken, {
        tenantId,
        roleName,
        invitedBy: senderId,
        createdAt: Date.now(),
      });

      const inviteLink = `http://localhost:3000/auth/join-tenant?token=${inviteToken}`;
      console.log('📨 INVITE LINK:', inviteLink);
      return true;
    } else {
      const tempPassword = crypto.randomBytes(8).toString('hex') + 'A1!';
      const registerResult = await this.provider.register(email, tempPassword);
      const newUser = registerResult.user;

      await this.provider.associateUserToTenant(newUser.id, tenantId);

      // Provider instead of PolicyService
      await this.provider.assignRoleToUser(newUser.id, tenantId, roleName);

      console.log('wk NEW USER CREATED:', email, tempPassword);
      return true;
    }
  }

  async acceptInvite(userId: string, token: string): Promise<boolean> {
    // Provider instead of PolicyService
    const inviteData = await this.provider.consumePendingInvite(userId, token);

    if (!inviteData) {
      throw new GraphQLError('Invalid or expired invite token.');
    }

    await this.provider.associateUserToTenant(userId, inviteData.tenantId);
    await this.provider.assignRoleToUser(userId, inviteData.tenantId, inviteData.roleName);

    return true;
  }

  async createOwnTenant(userId: string, tenantName: string): Promise<any> {
    // 1. Create Tenant via gRPC
    const newTenant: any = await new Promise((resolve, reject) => {
      tenantClient.CreateTenant({ name: tenantName }, (err: any, res: any) => (err ? reject(err) : resolve(res)));
    });

    const newTenantId = newTenant.id;

    // 2. Associate user with tenant
    await this.provider.associateUserToTenant(userId, newTenantId);

    // 3. Create and assign Admin policy
    const adminPolicy: RolePolicy = {
      description: 'Root Admin Policy',
      mfa_required: true,
      permissions: {
        system_iam: { access: true, actions: ['*'] },
        '*': { access: true, actions: ['*'] },
      },
    };

    // Provider instead of PolicyService
    await this.provider.setRolePolicy(newTenantId, 'admin', adminPolicy);
    await this.provider.assignRoleToUser(userId, newTenantId, 'admin');

    return newTenant;
  }

  async updateUser(userId: string, input: { email?: string; password?: string }): Promise<AuthUser> {
    return await this.provider.updateUser(userId, input);
  }
}
