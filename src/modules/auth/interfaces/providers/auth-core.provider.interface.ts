import { AuthUser } from '../auth.entities';
import { AuthTokens } from '../auth.dtos';
import { RolePolicy } from '../rbac.types';
import { TotpDevice } from '../auth.entities';

export interface IAuthCoreProvider {
  // Authentication
  verifyCredentials(email: string, password: string): Promise<AuthUser>;
  createNewSession(userId: string, payload: any): Promise<{ tokens: AuthTokens; sessionHandle: string }>;
  refreshToken(refreshToken: string, context?: any): Promise<AuthTokens>;
  logout(userId: string): Promise<void>;

  // Security
  createPasswordResetToken(userId: string): Promise<string>;
  resetPassword(token: string, newPassword: string): Promise<boolean>;
  getPasswordChangeRequirement(userId: string): Promise<boolean>;
  setPasswordChangeRequirement(userId: string, required: boolean): Promise<void>;
}
