export interface IRbacProvider {
  getUserRoleInTenant(userId: string, tenantId: string): Promise<string | null>;
  assignRoleToUser(userId: string, tenantId: string, roleName: string): Promise<void>;
  removeUserRole(userId: string, tenantId: string): Promise<void>;

  listTenantRoles(tenantId: string): Promise<string[]>;

  getRolePermissions(tenantId: string, roleName: string): Promise<string[]>;
  createOrUpdateRole(tenantId: string, roleName: string, permissions: string[]): Promise<void>;
  deleteRole(tenantId: string, roleName: string): Promise<void>;
}
