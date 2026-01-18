import UserRoles from 'supertokens-node/recipe/userroles';
import { IRbacProvider } from '../../interfaces/providers/rbac.provider.interface';

export class SuperTokensRbacProvider implements IRbacProvider {
  async getUserRoleInTenant(userId: string, tenantId: string): Promise<string | null> {
    try {
      const response = await UserRoles.getRolesForUser(tenantId, userId);
      const prefix = `${tenantId}_`;
      const globalRole = response.roles.find((r) => r.startsWith(prefix));
      return globalRole ? globalRole.replace(prefix, '') : null;
    } catch (error) {
      console.error('Get user role error:', error);
      return null;
    }
  }

  async assignRoleToUser(userId: string, tenantId: string, roleName: string): Promise<void> {
    const globalRoleName = `${tenantId}_${roleName}`;
    await this.removeUserRole(userId, tenantId);

    await UserRoles.createNewRoleOrAddPermissions(globalRoleName, []);

    await UserRoles.addRoleToUser(tenantId, userId, globalRoleName);
  }

  async removeUserRole(userId: string, tenantId: string): Promise<void> {
    const currentRole = await this.getUserRoleInTenant(userId, tenantId);
    if (currentRole) {
      const globalRoleName = `${tenantId}_${currentRole}`;
      await UserRoles.removeUserRole(tenantId, userId, globalRoleName);
    }
  }

  async listTenantRoles(tenantId: string): Promise<string[]> {
    const response = await UserRoles.getAllRoles();
    const prefix = `${tenantId}_`;

    return response.roles.filter((r) => r.startsWith(prefix)).map((r) => r.replace(prefix, ''));
  }

  async getRolePermissions(tenantId: string, roleName: string): Promise<string[]> {
    const globalRoleName = `${tenantId}_${roleName}`;
    const response = await UserRoles.getPermissionsForRole(globalRoleName);

    if (response.status === 'UNKNOWN_ROLE_ERROR') return [];
    return response.permissions;
  }

  async createOrUpdateRole(tenantId: string, roleName: string, permissions: string[]): Promise<void> {
    const globalRoleName = `${tenantId}_${roleName}`;

    const existing = await UserRoles.getPermissionsForRole(globalRoleName);

    if (existing.status === 'OK') {
      if (existing.permissions.length > 0) {
        await UserRoles.removePermissionsFromRole(globalRoleName, existing.permissions);
      }
    }

    await UserRoles.createNewRoleOrAddPermissions(globalRoleName, permissions);
  }

  async deleteRole(tenantId: string, roleName: string): Promise<void> {
    const globalRoleName = `${tenantId}_${roleName}`;
    await UserRoles.deleteRole(globalRoleName);
  }
}
