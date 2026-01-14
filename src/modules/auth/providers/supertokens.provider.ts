import SuperTokens from 'supertokens-node';
import EmailPassword from 'supertokens-node/recipe/emailpassword';
import Session from 'supertokens-node/recipe/session';
import Multitenancy from 'supertokens-node/recipe/multitenancy';
import Totp from 'supertokens-node/recipe/totp';
import UserMetadata from 'supertokens-node/recipe/usermetadata';
import NodeCache from 'node-cache';
import { GraphQLError } from 'graphql';
import { IAuthProvider } from '../interfaces/auth-provider.interface';
import {
  AuthUser,
  AuthTokens,
  LoginResponse,
  RegisterResponse,
  TotpDevice,
  MfaVerificationResult,
  UserPaginationResult,
} from '../interfaces/auth-types';
import { RolePolicy, InviteInfo, UserMetadataStructure } from '../interfaces/rbac.interface';

export class SuperTokensProvider implements IAuthProvider {
  private cache: NodeCache;

  constructor() {
    this.cache = new NodeCache({ stdTTL: 600, checkperiod: 120 });
  }

  // --- 1. Basic Auth Operations ---
  async verifyCredentials(email: string, password: string): Promise<AuthUser> {
    const response = await EmailPassword.signIn('public', email, password);

    if (response.status === 'WRONG_CREDENTIALS_ERROR') {
      throw new GraphQLError('Wrong credentials', {
        extensions: { code: 'WRONG_CREDENTIALS', http: { status: 401 } },
      });
    }

    const user = response.user;
    return {
      id: user.id,
      email: user.emails[0],
      timeJoined: user.timeJoined,
      tenantIds: user.tenantIds,
    };
  }

  async createUser(email: string, password: string): Promise<AuthUser> {
    const response = await EmailPassword.signUp('public', email, password);

    if (response.status === 'EMAIL_ALREADY_EXISTS_ERROR') {
      throw new GraphQLError('Email already exists.', {
        extensions: { code: 'EMAIL_ALREADY_EXISTS', http: { status: 409 } },
      });
    }

    const user = response.user;
    
    return {
      id: user.id,
      email: user.emails[0],
      timeJoined: user.timeJoined,
    };
  }

  async createNewSession(userId: string, payload: any): Promise<{ tokens: AuthTokens; sessionHandle: string }> {
    const recipeUserId = new SuperTokens.RecipeUserId(userId);
    
    try {
      const session = await Session.createNewSessionWithoutRequestResponse('public', recipeUserId, payload);
      const tokens = session.getAllSessionTokensDangerously();

      return {
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken || '',
        },
        sessionHandle: session.getHandle(),
      };
    } catch (error) {
      throw new GraphQLError('Session creation failed.', {
        extensions: { code: 'SESSION_CREATION_FAILED', http: { status: 401 } },
      });
    }
  }

  async refreshToken(refreshToken: string, context?: any): Promise<AuthTokens> {
    try {
      const result = await Session.refreshSessionWithoutRequestResponse(refreshToken)
      const sessionData = result.getAllSessionTokensDangerously();

      return {
        accessToken: sessionData.accessToken,
        refreshToken: sessionData.refreshToken || '',
      }
    } catch (err: any) {
      if (err.type === Session.Error.TRY_REFRESH_TOKEN) {
         throw new GraphQLError('Session invalid, please login again.', {
            extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
         });
      }
      
      if (err.type === Session.Error.TOKEN_THEFT_DETECTED) {
         throw new GraphQLError('Token theft detected, session revoked.', {
            extensions: { code: 'TOKEN_THEFT', http: { status: 401 } },
         });
      }

      throw new GraphQLError('Session refresh failed.', {
        extensions: { code: 'SESSION_REFRESH_FAILED', http: { status: 401 } },
      });
    }
  }

  async logout(userId: string): Promise<void> {
    // In SuperTokens logout is usually managed from frontend or session is revoked
    await Session.revokeAllSessionsForUser(userId);
  }

  async updateSessionPayload(sessionHandle: string, payload: any): Promise<void> {
    await Session.mergeIntoAccessTokenPayload(sessionHandle, payload);
  }

  // --- 2. User Management ---

  async getUser(userId: string): Promise<AuthUser | null> {
    const user = await SuperTokens.getUser(userId);
    if (!user) return null;
    return {
      id: user.id,
      email: user.emails[0],
      timeJoined: user.timeJoined,
      tenantIds: user.tenantIds,
    };
  }

  async getUserByEmail(email: string): Promise<AuthUser | null> {
    const users = await SuperTokens.listUsersByAccountInfo('public', { email });
    if (users.length === 0) return null;
    const user = users[0];
    return {
      id: user.id,
      email: user.emails[0],
      timeJoined: user.timeJoined,
      tenantIds: user.tenantIds,
    };
  }

  async updateUser(userId: string, data: { email?: string; password?: string }): Promise<AuthUser> {
    const recipeUserId = new SuperTokens.RecipeUserId(userId);

    const response = await EmailPassword.updateEmailOrPassword({
      recipeUserId,
      email: data.email,
      password: data.password,
    });

    if (response.status === 'EMAIL_ALREADY_EXISTS_ERROR') {
      throw new GraphQLError('Email already exists.', {
        extensions: { code: 'EMAIL_ALREADY_EXISTS' },
      });
    } else if (response.status === 'UNKNOWN_USER_ID_ERROR') {
      throw new GraphQLError('User not found.', { extensions: { code: 'USER_NOT_FOUND' } });
    }

    // Fetch and return current user
    return (await this.getUser(userId))!;
  }

  // --- 3. Password Reset ---

  async createPasswordResetToken(userId: string): Promise<string> {
    // Note: SuperTokens createResetPasswordToken usually accepts email, not userId.
    // However, if we receive userId due to interface, we must find the email first.
    const user = await this.getUser(userId);
    if (!user) throw new Error('User not found');

    const response = await EmailPassword.createResetPasswordToken('public', user.id, user.email);

    if (response.status === 'OK') {
      return response.token;
    }
    return '';
  }

  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    const response = await EmailPassword.resetPasswordUsingToken('public', token, newPassword);
    return response.status === 'OK';
  }

  // --- 4. MFA / TOTP ---

  async createTotpDevice(userId: string, deviceName: string): Promise<TotpDevice> {
    const response = await Totp.createDevice(userId, undefined, deviceName);

    if (response.status === 'DEVICE_ALREADY_EXISTS_ERROR') {
      throw new GraphQLError('Device name already exists.', {
        extensions: { code: 'BAD_REQUEST' },
      });
    }
    if (response.status === 'UNKNOWN_USER_ID_ERROR') {
      throw new GraphQLError('User not found.', { extensions: { code: 'UNAUTHENTICATED' } });
    }

    return {
      name: response.deviceName,
      secret: response.secret,
      qrCode: response.qrCodeString,
    };
  }

  async verifyTotpDevice(userId: string, deviceName: string, code: string): Promise<MfaVerificationResult> {
    const response = await Totp.verifyDevice('public', userId, deviceName, code);

    if (response.status === 'UNKNOWN_DEVICE_ERROR') {
      throw new GraphQLError('Device not found.');
    }
    if (response.status === 'INVALID_TOTP_ERROR') {
      throw new GraphQLError('Invalid code.');
    }
    
    return { verified: true };
  }

  async verifyMfaCode(userId: string, code: string): Promise<MfaVerificationResult> {
    const response = await Totp.verifyTOTP('public', userId, code);

    if (response.status === 'UNKNOWN_USER_ID_ERROR') throw new GraphQLError('User not found.');
    if (response.status === 'INVALID_TOTP_ERROR') throw new GraphQLError('Invalid code.');

    return { verified: true };
  }

  async removeTotpDevice(userId: string, deviceName: string): Promise<void> {
    await Totp.removeDevice(userId, deviceName);
  }

  async listTotpDevices(userId: string): Promise<any[]> {
    const res = await Totp.listDevices(userId);
    return res.devices;
  }

  // --- 5. Multi-tenancy ---

  async associateUserToTenant(userId: string, tenantId: string): Promise<void> {
    const recipeUserId = new SuperTokens.RecipeUserId(userId);
    await Multitenancy.associateUserToTenant(tenantId, recipeUserId);
  }

  async disassociateUserFromTenant(userId: string, tenantId: string): Promise<void> {
    const recipeUserId = new SuperTokens.RecipeUserId(userId);
    await Multitenancy.disassociateUserFromTenant(tenantId, recipeUserId);
  }

  async getTenantUsers(tenantId: string, limit: number = 10, paginationToken?: string): Promise<UserPaginationResult> {
    const response = await SuperTokens.getUsersNewestFirst({
      tenantId,
      limit,
      paginationToken,
    });

    return {
      users: response.users.map((u) => ({
        id: u.id,
        email: u.emails[0],
        timeJoined: u.timeJoined,
      })),
      nextPaginationToken: response.nextPaginationToken,
    };
  }

  // --- POLICY / RBAC METHODS ---

  async getUserRoleInTenant(userId: string, tenantId: string): Promise<string | null> {
    try {
      const { metadata } = await UserMetadata.getUserMetadata(userId);
      const userMeta = metadata as UserMetadataStructure;
      return userMeta.tenants?.[tenantId] || null;
    } catch (error) {
      console.error(`Error fetching user role for tenant ${tenantId}:`, error);
      return null;
    }
  }

  async assignRoleToUser(userId: string, tenantId: string, roleName: string): Promise<void> {
    const { metadata } = await UserMetadata.getUserMetadata(userId);
    const userMeta = metadata as UserMetadataStructure;

    const updatedTenants = {
      ...(userMeta.tenants || {}),
      [tenantId]: roleName,
    };

    await UserMetadata.updateUserMetadata(userId, {
      tenants: updatedTenants,
    });
  }

  async removeUserRole(userId: string, tenantId: string): Promise<void> {
    const { metadata } = await UserMetadata.getUserMetadata(userId);
    const userMeta = metadata as UserMetadataStructure;

    if (!userMeta.tenants || !userMeta.tenants[tenantId]) {
      return;
    }

    const updatedTenants = { ...userMeta.tenants };
    // @ts-ignore
    updatedTenants[tenantId] = null; // Set to null to delete

    await UserMetadata.updateUserMetadata(userId, {
      tenants: updatedTenants,
    });
  }

  async listTenantRoles(tenantId: string): Promise<string[]> {
    const cacheKey = `roles_list:${tenantId}`;
    const cachedList = this.cache.get<string[]>(cacheKey);
    if (cachedList) return cachedList;

    try {
      // We keep tenant roles on a virtual user
      const { metadata } = await UserMetadata.getUserMetadata(cacheKey);
      const roles = (metadata.roles as string[]) || [];

      this.cache.set(cacheKey, roles);
      return roles;
    } catch (e) {
      return [];
    }
  }

  async getRolePolicy(tenantId: string, roleName: string): Promise<RolePolicy | null> {
    const cacheKey = `policy:${tenantId}:${roleName}`;
    const cachedPolicy = this.cache.get<RolePolicy>(cacheKey);
    if (cachedPolicy) return cachedPolicy;

    try {
      const { metadata } = await UserMetadata.getUserMetadata(cacheKey);
      if (!metadata || Object.keys(metadata).length === 0) return null;

      const policy = (metadata.policy as RolePolicy) || null;
      if (policy) this.cache.set(cacheKey, policy);

      return policy;
    } catch (err) {
      return null;
    }
  }

  async setRolePolicy(tenantId: string, roleName: string, policy: RolePolicy): Promise<void> {
    // 1. Save policy data
    const policyKey = `policy:${tenantId}:${roleName}`;
    await UserMetadata.updateUserMetadata(policyKey, { policy: policy as any });
    this.cache.del(policyKey);

    // 2. Add to role list
    const listKey = `roles_list:${tenantId}`;
    const { metadata } = await UserMetadata.getUserMetadata(listKey);
    const currentRoles = (metadata.roles as string[]) || [];

    if (!currentRoles.includes(roleName)) {
      const newRoles = [...currentRoles, roleName];
      await UserMetadata.updateUserMetadata(listKey, { roles: newRoles });
      this.cache.del(listKey);
    }
  }

  async deleteRolePolicy(tenantId: string, roleName: string): Promise<void> {
    // 1. Delete policy data
    const policyKey = `policy:${tenantId}:${roleName}`;
    await UserMetadata.updateUserMetadata(policyKey, { policy: null });
    this.cache.del(policyKey);

    // 2. Remove from role list
    const listKey = `roles_list:${tenantId}`;
    const { metadata } = await UserMetadata.getUserMetadata(listKey);
    const currentRoles = (metadata.roles as string[]) || [];

    const newRoles = currentRoles.filter((r) => r !== roleName);
    if (newRoles.length !== currentRoles.length) {
      await UserMetadata.updateUserMetadata(listKey, { roles: newRoles });
      this.cache.del(listKey);
    }
  }

  async addPendingInvite(userId: string, token: string, invite: InviteInfo): Promise<void> {
    const { metadata } = await UserMetadata.getUserMetadata(userId);
    const userMeta = metadata as UserMetadataStructure;

    const currentInvites = userMeta.pending_invites || {};
    const updatedInvites = {
      ...currentInvites,
      [token]: invite,
    };

    await UserMetadata.updateUserMetadata(userId, {
      pending_invites: updatedInvites as any,
    });
  }

  async consumePendingInvite(userId: string, token: string): Promise<InviteInfo | null> {
    const { metadata } = await UserMetadata.getUserMetadata(userId);
    const userMeta = metadata as UserMetadataStructure;

    if (!userMeta.pending_invites || !userMeta.pending_invites[token]) {
      return null;
    }

    const inviteData = userMeta.pending_invites[token];
    const updatedInvites = { ...userMeta.pending_invites };
    delete updatedInvites[token];

    await UserMetadata.updateUserMetadata(userId, {
      pending_invites: updatedInvites as any,
    });

    return inviteData;
  }
}
