import { IRbacProvider } from '../interfaces/providers/rbac.provider.interface'
import { RolePolicy } from '../interfaces/rbac.types';

export class RbacService {
  constructor(private provider: IRbacProvider) {}

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
}