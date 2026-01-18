import { IRbacProvider } from '../interfaces/providers/rbac.provider.interface';

export class RbacService {
  constructor(private provider: IRbacProvider) {}

  async getUserRoleInTenant(userId: string, tenantId: string): Promise<string | null> {
    return await this.provider.getUserRoleInTenant(userId, tenantId);
  }

  async listTenantRoles(tenantId: string): Promise<string[]> {
    return await this.provider.listTenantRoles(tenantId);
  }

  async getRolePermissions(tenantId: string, roleName: string): Promise<string[]> {
    return await this.provider.getRolePermissions(tenantId, roleName);
  }

  async createOrUpdateRole(tenantId: string, roleName: string, permissions: string[]): Promise<void> {
    return await this.provider.createOrUpdateRole(tenantId, roleName, permissions);
  }

  async deleteRole(tenantId: string, roleName: string): Promise<void> {
    return await this.provider.deleteRole(tenantId, roleName);
  }

  async assignRole(userId: string, tenantId: string, roleName: string): Promise<void> {
    await this.provider.assignRoleToUser(userId, tenantId, roleName);
  }
}
