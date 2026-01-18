import { GraphQLError } from 'graphql';
import { IAuthCoreProvider } from '../interfaces/providers/auth-core.provider.interface';
import { AuthServiceResponse } from '../interfaces/auth.dtos';
import { AuthTenant } from '../interfaces/auth.entities';
import { TenantService } from '../../tenant/services/tenant.service';
import { IAuthContext } from '../interfaces/auth-context.interface';
import { IIamProvider } from '../interfaces/providers/iam.provider.interface';
import { IRbacProvider } from '../interfaces/providers/rbac.provider.interface';
import { IMfaProvider } from '../interfaces/providers/mfa.provider.interface';

export class AuthCoreService {
  constructor(
    private provider: IAuthCoreProvider,
    private iamProvider: IIamProvider,
    private rbacProvider: IRbacProvider,
    private mfaProvider: IMfaProvider,
    private tenantService: TenantService,
  ) {}

  /**
   * Logs in with Auth Provider, then collects Tenant and Authorization information.
   */
  async login(email: string, password: string, context: IAuthContext): Promise<AuthServiceResponse> {
    // 1. Verify Credentials via Provider
    const credentialsUser = await this.provider.verifyCredentials(email, password);
    const userProfile = await this.iamProvider.getUser(credentialsUser.id);
    const user = { ...credentialsUser, ...userProfile };

    const rawTenantIds = user.tenantIds || [];
    const tenantIds = rawTenantIds.filter((id) => id !== 'public');

    let activeTenantDetails: AuthTenant | null = null;
    let availableTenantsDetails: AuthTenant[] = [];
    
    let initialRole: string | null = null;
    let initialPermissions: string[] | null = null;
    let isMfaRequiredByPolicy = false;

    // 2. Load Tenant Context if available
    if (tenantIds.length > 0) {
      const activeTenantId = tenantIds[0]; // Default to first tenant

      try {
        const tempCtx = { ...context, tenantId: activeTenantId } as any;
        activeTenantDetails = await this.tenantService.getTenant(activeTenantId, tempCtx);

        // Fetch User Role & Permissions for this tenant via Provider
        const role = await this.rbacProvider.getUserRoleInTenant(user.id, activeTenantId);
        if (role) {
          const permissions = await this.rbacProvider.getRolePermissions(activeTenantId, role);
          if (permissions) {
            initialPermissions = permissions;
            initialRole = role;
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
    const devices = await this.mfaProvider.listTotpDevices(user.id);
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
      role: initialRole,
      permissions: initialPermissions,
      requiresPasswordChange: requiresPasswordChange,
      requiresMfa: isMfaRequiredByPolicy || hasMfaDevice,
      mfaEnforced: isMfaRequiredByPolicy,
      mfaEnabled: hasMfaDevice,
    };
  }

  /**
   * Registers a new user and creates a session.
   */
  async register(email: string, password: string, firstName: string, lastName: string): Promise<AuthServiceResponse> {
    const createdUser = await this.iamProvider.createUser(email, password);

    await this.iamProvider.updateUser(createdUser.id, {
      firstName,
      lastName,
    });

    const userProfile = await this.iamProvider.getUser(createdUser.id);
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
      role: null,
      permissions: null,
      requiresPasswordChange: false,
      requiresMfa: false,
      mfaEnforced: false,
      mfaEnabled: false,
    };
  }

  async refreshToken(token: string, context: IAuthContext) {
    return await this.provider.refreshToken(token, context);
  }

  async logout(userId: string): Promise<boolean> {
    await this.provider.logout(userId);
    return true;
  }

  async sendPasswordResetEmail(email: string): Promise<boolean> {
    const user = await this.iamProvider.getUserByEmail(email);
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
}
