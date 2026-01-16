import UserMetadata from 'supertokens-node/recipe/usermetadata';
import NodeCache from 'node-cache';

import { IRbacProvider } from '../../interfaces/providers/rbac.provider.interface';
import { RolePolicy, UserMetadataStructure } from '../../interfaces/rbac.types';

export class SuperTokensRbacProvider implements IRbacProvider {
  private cache: NodeCache;

  constructor() {
    // Cache: 10 dk TTL
    this.cache = new NodeCache({ stdTTL: 600, checkperiod: 120 });
  }

  async getUserRoleInTenant(userId: string, tenantId: string): Promise<string | null> {
    try {
      const { metadata } = await UserMetadata.getUserMetadata(userId);
      const userMeta = metadata as UserMetadataStructure;
      return userMeta.tenants?.[tenantId] || null;
    } catch {
      return null;
    }
  }

  async assignRoleToUser(userId: string, tenantId: string, roleName: string): Promise<void> {
    const { metadata } = await UserMetadata.getUserMetadata(userId);
    const userMeta = metadata as UserMetadataStructure;
    const updatedTenants = { ...(userMeta.tenants || {}), [tenantId]: roleName };

    await UserMetadata.updateUserMetadata(userId, { tenants: updatedTenants });
  }

  async removeUserRole(userId: string, tenantId: string): Promise<void> {
    const { metadata } = await UserMetadata.getUserMetadata(userId);
    const userMeta = metadata as UserMetadataStructure;
    if (!userMeta.tenants || !userMeta.tenants[tenantId]) return;

    const updatedTenants = { ...userMeta.tenants };
    delete updatedTenants[tenantId];
    await UserMetadata.updateUserMetadata(userId, { tenants: updatedTenants });
  }

  async listTenantRoles(tenantId: string): Promise<string[]> {
    const cacheKey = `roles_list:${tenantId}`;
    const cachedList = this.cache.get<string[]>(cacheKey);
    if (cachedList) return cachedList;

    try {
      const { metadata } = await UserMetadata.getUserMetadata(cacheKey);
      const roles = (metadata.roles as string[]) || [];
      this.cache.set(cacheKey, roles);
      return roles;
    } catch {
      return [];
    }
  }

  async getRolePolicy(tenantId: string, roleName: string): Promise<RolePolicy | null> {
    const cacheKey = `policy:${tenantId}:${roleName}`;
    const cachedPolicy = this.cache.get<RolePolicy>(cacheKey);
    if (cachedPolicy) return cachedPolicy;

    try {
      const { metadata } = await UserMetadata.getUserMetadata(cacheKey);
      const policy = (metadata.policy as RolePolicy) || null;
      if (policy) this.cache.set(cacheKey, policy);
      return policy;
    } catch {
      return null;
    }
  }

  async setRolePolicy(tenantId: string, roleName: string, policy: RolePolicy): Promise<void> {
    // 1. Save Policy
    const policyKey = `policy:${tenantId}:${roleName}`;
    await UserMetadata.updateUserMetadata(policyKey, { policy: policy as any });
    this.cache.del(policyKey); // Invalidate

    // 2. Update Role List
    const listKey = `roles_list:${tenantId}`;
    const { metadata } = await UserMetadata.getUserMetadata(listKey);
    const currentRoles = (metadata.roles as string[]) || [];

    if (!currentRoles.includes(roleName)) {
      await UserMetadata.updateUserMetadata(listKey, { roles: [...currentRoles, roleName] });
      this.cache.del(listKey);
    }
  }

  async deleteRolePolicy(tenantId: string, roleName: string): Promise<void> {
    // 1. Remove Policy Data
    const policyKey = `policy:${tenantId}:${roleName}`;
    await UserMetadata.updateUserMetadata(policyKey, { policy: null });
    this.cache.del(policyKey);

    // 2. Update Role List
    const listKey = `roles_list:${tenantId}`;
    const { metadata } = await UserMetadata.getUserMetadata(listKey);
    const currentRoles = (metadata.roles as string[]) || [];

    const newRoles = currentRoles.filter((r) => r !== roleName);
    if (newRoles.length !== currentRoles.length) {
      await UserMetadata.updateUserMetadata(listKey, { roles: newRoles });
      this.cache.del(listKey);
    }
  }
}