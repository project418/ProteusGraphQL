import SuperTokens from 'supertokens-node';
import Multitenancy from 'supertokens-node/recipe/multitenancy';
import UserMetadata from 'supertokens-node/recipe/usermetadata';
import EmailPassword from 'supertokens-node/recipe/emailpassword';

import { IIamProvider } from '../../interfaces/providers/iam.provider.interface';
import { AuthUser, InviteInfo, UserProfile } from '../../interfaces/auth.entities';
import { UserPaginationResult } from '../../interfaces/auth.dtos';
import { UserMetadataStructure } from '../../interfaces/rbac.types';
import { GraphQLError } from 'graphql/error'

export class SuperTokensIamProvider implements IIamProvider {
  // --- User Management ---
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
    
    return this.getUser(users[0].id);
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

  // --- Tenant Association ---
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

  // --- Invites ---
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