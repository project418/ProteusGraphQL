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
  UserProfile, 
  TotpDevice, 
  InviteInfo 
} from '../interfaces/auth.entities';
import { 
  AuthTokens, 
  MfaVerificationResult, 
  UserPaginationResult 
} from '../interfaces/auth.dtos';
import { 
  RolePolicy, 
  UserMetadataStructure 
} from '../interfaces/rbac.types';

export class SuperTokensProvider implements IAuthProvider {
  private cache: NodeCache;

  constructor() {
    // Cache TTL: 10 minutes, Check Period: 2 minutes
    this.cache = new NodeCache({ stdTTL: 600, checkperiod: 120 });
  }

  // ===========================================================================
  // 1. Basic Authentication & Session Management
  // ===========================================================================

  async verifyCredentials(email: string, password: string): Promise<AuthUser> {
    const response = await EmailPassword.signIn('public', email, password);

    if (response.status === 'WRONG_CREDENTIALS_ERROR') {
      throw new GraphQLError('Invalid email or password.', {
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
      // Create session without cookie dependency (for body-based auth)
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
      console.error('Session creation error:', error);
      throw new GraphQLError('Failed to create session.', {
        extensions: { code: 'SESSION_CREATION_FAILED', http: { status: 500 } },
      });
    }
  }

  async refreshToken(refreshToken: string, context?: any): Promise<AuthTokens> {
    try {
      // Manually verify and refresh the session using the refresh token
      const result = await Session.refreshSessionWithoutRequestResponse(refreshToken);
      const sessionData = result.getAllSessionTokensDangerously();

      return {
        accessToken: sessionData.accessToken,
        refreshToken: sessionData.refreshToken || '',
      };
    } catch (err: any) {
      if (err.type === Session.Error.TRY_REFRESH_TOKEN) {
        throw new GraphQLError('Session invalid or expired. Please log in again.', {
          extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
        });
      }

      if (err.type === Session.Error.TOKEN_THEFT_DETECTED) {
        throw new GraphQLError('Token theft detected. Session has been revoked.', {
          extensions: { code: 'TOKEN_THEFT', http: { status: 401 } },
        });
      }

      throw new GraphQLError('Session refresh failed.', {
        extensions: { code: 'SESSION_REFRESH_FAILED', http: { status: 401 } },
      });
    }
  }

  async logout(userId: string): Promise<void> {
    // Revoke all sessions for the user (Global Logout)
    await Session.revokeAllSessionsForUser(userId);
  }

  // ===========================================================================
  // 2. User Management
  // ===========================================================================

  async getUser(userId: string): Promise<AuthUser | null> {
    const user = await SuperTokens.getUser(userId);
    if (!user) return null;

    const { metadata } = await UserMetadata.getUserMetadata(userId);
    const profile = (metadata.profile as UserProfile) || {};

    return {
      id: user.id,
      email: user.emails[0],
      timeJoined: user.timeJoined,
      tenantIds: user.tenantIds,
      firstName: profile.firstName,
      lastName: profile.lastName,
      title: profile.title,
      phone: profile.phone,
      countryCode: profile.countryCode,
      timezone: profile.timezone,
      language: profile.language,
      avatar: profile.avatar,
    };
  }

  async getUserByEmail(email: string): Promise<AuthUser | null> {
    const users = await SuperTokens.listUsersByAccountInfo('public', { email });
    if (users.length === 0) return null;
    
    // Recursive call to get full profile data
    return this.getUser(users[0].id);
  }

  async updateUser(
    userId: string,
    data: {
      email?: string;
      password?: string;
      currentPassword?: string;
      firstName?: string;
      lastName?: string;
      title?: string;
      phone?: string;
      countryCode?: string;
      timezone?: string;
      language?: string;
      avatar?: string;
    },
  ): Promise<AuthUser> {
    const recipeUserId = new SuperTokens.RecipeUserId(userId);

    // 1. Handle Password Change
    if (data.password) {
      if (!data.currentPassword) {
        throw new GraphQLError('Current password is required to set a new password.', {
          extensions: { code: 'BAD_REQUEST' },
        });
      }

      // Verify current password first
      const user = await this.getUser(userId);
      if (!user) throw new GraphQLError('User not found.');

      const authResponse = await EmailPassword.signIn('public', user.email, data.currentPassword);
      if (authResponse.status === 'WRONG_CREDENTIALS_ERROR') {
        throw new GraphQLError('Invalid current password.', {
          extensions: { code: 'INVALID_PASSWORD' },
        });
      }

      await EmailPassword.updateEmailOrPassword({
        recipeUserId,
        password: data.password,
      });
    }

    // 2. Handle Email Change
    if (data.email) {
      const response = await EmailPassword.updateEmailOrPassword({
        recipeUserId,
        email: data.email,
      });
      if (response.status === 'EMAIL_ALREADY_EXISTS_ERROR') {
        throw new GraphQLError('Email already exists.', { extensions: { code: 'EMAIL_ALREADY_EXISTS' } });
      }
    }

    // 3. Handle Profile Metadata Update
    const profileUpdates: Partial<UserProfile> = {};
    if (data.firstName !== undefined) profileUpdates.firstName = data.firstName;
    if (data.lastName !== undefined) profileUpdates.lastName = data.lastName;
    if (data.title !== undefined) profileUpdates.title = data.title;
    if (data.phone !== undefined) profileUpdates.phone = data.phone;
    if (data.countryCode !== undefined) profileUpdates.countryCode = data.countryCode;
    if (data.timezone !== undefined) profileUpdates.timezone = data.timezone;
    if (data.language !== undefined) profileUpdates.language = data.language;
    if (data.avatar !== undefined) profileUpdates.avatar = data.avatar;

    if (Object.keys(profileUpdates).length > 0) {
      const { metadata } = await UserMetadata.getUserMetadata(userId);
      const currentProfile = (metadata.profile as UserProfile) || {};

      await UserMetadata.updateUserMetadata(userId, {
        profile: { ...currentProfile, ...profileUpdates },
      });
    }

    return (await this.getUser(userId))!;
  }

  // ===========================================================================
  // 3. Password Reset & Security Policies
  // ===========================================================================

  async createPasswordResetToken(userId: string): Promise<string> {
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

  async getPasswordChangeRequirement(userId: string): Promise<boolean> {
    try {
      const { metadata } = await UserMetadata.getUserMetadata(userId);
      const userMeta = metadata as UserMetadataStructure;
      return userMeta.requires_password_change === true;
    } catch (error) {
      return false;
    }
  }

  async setPasswordChangeRequirement(userId: string, required: boolean): Promise<void> {
    await UserMetadata.updateUserMetadata(userId, {
      requires_password_change: required,
    });
  }

  // ===========================================================================
  // 4. Multi-Factor Authentication (TOTP)
  // ===========================================================================

  async createTotpDevice(userId: string, deviceName: string): Promise<TotpDevice> {
    const response = await Totp.createDevice(userId, undefined, deviceName);

    if (response.status === 'DEVICE_ALREADY_EXISTS_ERROR') {
      throw new GraphQLError('Device name already exists.', { extensions: { code: 'BAD_REQUEST' } });
    }
    if (response.status === 'UNKNOWN_USER_ID_ERROR') {
      throw new GraphQLError('User not found.', { extensions: { code: 'UNAUTHENTICATED' } });
    }

    return {
      deviceName: response.deviceName,
      secret: response.secret,
      qrCode: response.qrCodeString,
    };
  }

  async verifyTotpDevice(userId: string, deviceName: string, code: string): Promise<MfaVerificationResult> {
    const response = await Totp.verifyDevice('public', userId, deviceName, code);

    if (response.status === 'UNKNOWN_DEVICE_ERROR') throw new GraphQLError('Device not found.');
    if (response.status === 'INVALID_TOTP_ERROR') throw new GraphQLError('Invalid TOTP code.');

    return { verified: true };
  }

  async verifyMfaCode(userId: string, code: string): Promise<MfaVerificationResult> {
    const response = await Totp.verifyTOTP('public', userId, code);

    if (response.status === 'UNKNOWN_USER_ID_ERROR') throw new GraphQLError('User not found.');
    if (response.status === 'INVALID_TOTP_ERROR') throw new GraphQLError('Invalid TOTP code.');

    return { verified: true };
  }

  async removeTotpDevice(userId: string, deviceName: string): Promise<void> {
    await Totp.removeDevice(userId, deviceName);
  }

  async listTotpDevices(userId: string): Promise<any[]> {
    const res = await Totp.listDevices(userId);
    return res.devices;
  }

  // ===========================================================================
  // 5. Multi-tenancy & Tenant Management
  // ===========================================================================

  async createProviderTenant(tenantId: string): Promise<void> {
    await Multitenancy.createOrUpdateTenant(tenantId, {
      firstFactors: ['emailpassword', 'thirdparty'],
    });
  }

  async associateUserToTenant(userId: string, tenantId: string): Promise<void> {
    const recipeUserId = new SuperTokens.RecipeUserId(userId);
    await Multitenancy.associateUserToTenant(tenantId, recipeUserId);
  }

  async disassociateUserFromTenant(userId: string, tenantId: string): Promise<void> {
    const recipeUserId = new SuperTokens.RecipeUserId(userId);
    await Multitenancy.disassociateUserFromTenant(tenantId, recipeUserId);
  }

  async getTenantUsers(tenantId: string, limit: number = 10, paginationToken?: string): Promise<UserPaginationResult> {
    const token = paginationToken ? paginationToken : undefined;

    const response = await SuperTokens.getUsersNewestFirst({
      tenantId,
      limit,
      paginationToken: token,
    });

    const usersWithProfile = await Promise.all(
      response.users.map(async (u) => {
        const { metadata } = await UserMetadata.getUserMetadata(u.id);
        const profile = (metadata.profile as UserProfile) || {};

        return {
          id: u.id,
          email: u.emails[0],
          timeJoined: u.timeJoined,
          firstName: profile.firstName,
          lastName: profile.lastName,
          title: profile.title,
          phone: profile.phone,
          countryCode: profile.countryCode,
          timezone: profile.timezone,
          language: profile.language,
          avatar: profile.avatar,
        };
      }),
    );

    return {
      users: usersWithProfile,
      nextPaginationToken: response.nextPaginationToken,
    };
  }

  // ===========================================================================
  // 6. RBAC (Roles & Permissions) - Stored in Metadata
  // ===========================================================================

  async getUserRoleInTenant(userId: string, tenantId: string): Promise<string | null> {
    try {
      const { metadata } = await UserMetadata.getUserMetadata(userId);
      const userMeta = metadata as UserMetadataStructure;
      return userMeta.tenants?.[tenantId] || null;
    } catch (error) {
      console.error(`Error fetching role for tenant ${tenantId}:`, error);
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

    if (!userMeta.tenants || !userMeta.tenants[tenantId]) return;

    const updatedTenants = { ...userMeta.tenants };
    delete updatedTenants[tenantId];

    await UserMetadata.updateUserMetadata(userId, {
      tenants: updatedTenants,
    });
  }

  async listTenantRoles(tenantId: string): Promise<string[]> {
    // Cache roles to reduce database hits on metadata
    const cacheKey = `roles_list:${tenantId}`;
    const cachedList = this.cache.get<string[]>(cacheKey);
    if (cachedList) return cachedList;

    try {
      // Storing role list in a "virtual" user metadata or similar shared storage
      // For this implementation, we assume roles are stored in a dedicated metadata key
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
    // 1. Save Policy Data
    const policyKey = `policy:${tenantId}:${roleName}`;
    await UserMetadata.updateUserMetadata(policyKey, { policy: policy as any });
    this.cache.del(policyKey); // Invalidate cache

    // 2. Update Role List
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
    // 1. Remove Policy Data
    const policyKey = `policy:${tenantId}:${roleName}`;
    await UserMetadata.updateUserMetadata(policyKey, { policy: null });
    this.cache.del(policyKey);

    // 2. Update Role List
    const listKey = `roles_list:${tenantId}`;
    const { metadata } = await UserMetadata.getUserMetadata(listKey);
    const currentRoles = (metadata.roles as string[]) || [];

    const newRoles = currentRoles.filter((r) => r !== roleName);
    if (newRoles.length !== currentRoles.length) {
      await UserMetadata.updateUserMetadata(listKey, { roles: newRoles });
      this.cache.del(listKey);
    }
  }

  // ===========================================================================
  // 7. Invitations
  // ===========================================================================

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