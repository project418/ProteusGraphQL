import SuperTokens from 'supertokens-node';
import EmailPassword from 'supertokens-node/recipe/emailpassword';
import Session from 'supertokens-node/recipe/session';
import UserMetadata from 'supertokens-node/recipe/usermetadata';
import Totp from 'supertokens-node/recipe/totp';
import { GraphQLError } from 'graphql';

import { IAuthCoreProvider } from '../../interfaces/providers/auth-core.provider.interface';
import { AuthUser, UserProfile } from '../../interfaces/auth.entities';
import { AuthTokens } from '../../interfaces/auth.dtos';
import { RolePolicy, UserMetadataStructure } from '../../interfaces/rbac.types';

export class SuperTokensCoreProvider implements IAuthCoreProvider {
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
      console.error('Session creation error:', error);
      throw new GraphQLError('Failed to create session.', {
        extensions: { code: 'SESSION_CREATION_FAILED', http: { status: 500 } },
      });
    }
  }

  async refreshToken(refreshToken: string, context?: any): Promise<AuthTokens> {
    try {
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
    await Session.revokeAllSessionsForUser(userId);
  }

  async createPasswordResetToken(userId: string): Promise<string> {
    const user = await SuperTokens.getUser(userId);
    if (!user) throw new Error('User not found');

    const response = await EmailPassword.createResetPasswordToken('public', user.id, user.emails[0]);

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
    const { metadata } = await UserMetadata.getUserMetadata(userId);
    return (metadata as UserMetadataStructure).requires_password_change === true;
  }

  async setPasswordChangeRequirement(userId: string, required: boolean): Promise<void> {
    await UserMetadata.updateUserMetadata(userId, { requires_password_change: required });
  }
}
