import crypto from 'crypto';
import { GraphQLError } from 'graphql';
import { IIamProvider } from '../interfaces/providers/iam.provider.interface';
import { IRbacProvider } from '../interfaces/providers/rbac.provider.interface';
import { IMfaProvider } from '../interfaces/providers/mfa.provider.interface'
import { IAuthCoreProvider } from '../interfaces/providers/auth-core.provider.interface'
import { RolePolicy } from '../interfaces/rbac.types';
import { AuthUser } from '../interfaces/auth.entities';
import { UserPaginationResult, UpdateUserResult } from '../interfaces/auth.dtos';
import { TenantService } from '../../tenant/services/tenant.service';
import { IAuthContext } from '../interfaces/auth-context.interface';


export class IamService {
  constructor(
    private provider: IIamProvider,
    private coreProvider: IAuthCoreProvider,
    private rbacProvider: IRbacProvider,
    private mfaProvider: IMfaProvider,
    private tenantService: TenantService,
  ) {}

  /**
   * Creates a tenant in DB, registers it in Auth Provider, and assigns admin role to creator.
   */
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

      await this.rbacProvider.setRolePolicy(newTenantId, 'admin', adminPolicy);
      await this.rbacProvider.assignRoleToUser(userId, newTenantId, 'admin');

      return newTenant;
    } catch (error) {
      // ROLLBACK: If provider setup fails, delete the created tenant from DB
      console.error(`Failed to setup provider for tenant ${newTenantId}. Rolling back...`, error);
      try {
        await this.tenantService.deleteTenant(newTenantId, context as any);
      } catch (rollbackError) {
        console.error(`CRITICAL: Failed to rollback tenant ${newTenantId}`, rollbackError);
      }
      throw new GraphQLError('Failed to create tenant organization. Please try again.');
    }
  }

  async updateTenant(id: string, name: string, context: IAuthContext): Promise<any> {
    return await this.tenantService.updateTenant(id, name, context as any);
  }

  // --- User Invites ---

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

      await this.coreProvider.setPasswordChangeRequirement(newUser.id, true);
      await this.provider.associateUserToTenant(newUser.id, tenantId);
      await this.rbacProvider.assignRoleToUser(newUser.id, tenantId, roleName);

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
    await this.rbacProvider.assignRoleToUser(userId, inviteData.tenantId, inviteData.roleName);

    return true;
  }

  // --- User Data ---

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

  async updateUser(
    userId: string,
    input: { email?: string; password?: string; currentPassword?: string },
    context?: IAuthContext,
  ): Promise<UpdateUserResult> {
    const updatedUser = await this.provider.updateUser(userId, input);
    let newTokens: any = {};

    if (input.password) {
      await this.coreProvider.setPasswordChangeRequirement(userId, false);

      let sessionPayload = {};
      if (context && context.session) {
        const currentPayload = context.session.getAccessTokenPayload();
        sessionPayload = { ...currentPayload, requiresPasswordChange: false };
      } else {
        const devices = await this.mfaProvider.listTotpDevices(userId);
        const hasMfaDevice = devices.length > 0;
        sessionPayload = {
          mfaEnforced: false,
          mfaEnabled: hasMfaDevice,
          mfaVerified: true,
          requiresPasswordChange: false,
        };
      }

      const sessionResult = await this.coreProvider.createNewSession(userId, sessionPayload);
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

  async removeUserFromTenant(userId: string, tenantId: string): Promise<void> {
    await this.provider.disassociateUserFromTenant(userId, tenantId);
    await this.rbacProvider.removeUserRole(userId, tenantId);
  }
}