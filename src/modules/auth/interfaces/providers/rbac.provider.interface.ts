import { RolePolicy } from '../rbac.types';

export interface IRbacProvider {
  getUserRoleInTenant(userId: string, tenantId: string): Promise<string | null>;
  assignRoleToUser(userId: string, tenantId: string, roleName: string): Promise<void>;
  removeUserRole(userId: string, tenantId: string): Promise<void>;
  
  listTenantRoles(tenantId: string): Promise<string[]>;
  getRolePolicy(tenantId: string, roleName: string): Promise<RolePolicy | null>;
  setRolePolicy(tenantId: string, roleName: string, policy: RolePolicy): Promise<void>;
  deleteRolePolicy(tenantId: string, roleName: string): Promise<void>;
}