import UserMetadata from "supertokens-node/recipe/usermetadata";
import NodeCache from "node-cache";
import { RolePolicy, UserMetadataStructure, InviteInfo } from "../types/rbac";

const policyCache = new NodeCache({ stdTTL: 600, checkperiod: 120 });

export class PolicyService {

    // =========================================================================
    // User Role Management
    // =========================================================================

    /**
     * Retrieves the user's role within a specific tenant.
     * E.g., "tenant_abc" -> "admin"
     */
    static async getUserRoleInTenant(userId: string, tenantId: string): Promise<string | null> {
        try {
            const { metadata } = await UserMetadata.getUserMetadata(userId);
            const userMeta = metadata as UserMetadataStructure;
            
            return userMeta.tenants?.[tenantId] || null;
        } catch (error) {
            console.error(`Error fetching user role for tenant ${tenantId}:`, error);
            return null;
        }
    }

    /**
     * Assigns a role to a user in a specific tenant.
     * This operation updates the "User Metadata".
     */
    static async assignRoleToUser(userId: string, tenantId: string, roleName: string): Promise<void> {
        const { metadata } = await UserMetadata.getUserMetadata(userId);
        const userMeta = metadata as UserMetadataStructure;

        const updatedTenants = {
            ...(userMeta.tenants || {}),
            [tenantId]: roleName
        };

        await UserMetadata.updateUserMetadata(userId, {
            tenants: updatedTenants
        });
    }

    /**
     * Removes the user's role from the tenant (Clears from Metadata).
     */
    static async removeUserRole(userId: string, tenantId: string): Promise<void> {
        const { metadata } = await UserMetadata.getUserMetadata(userId);
        const userMeta = metadata as UserMetadataStructure;

        // If tenants object doesn't exist or this tenant is not in it, do nothing
        if (!userMeta.tenants || !userMeta.tenants[tenantId]) {
            return;
        }

        const updatedTenants = { ...userMeta.tenants };
        
        // Setting a key to null is a safe way to remove it in SuperTokens merge logic
        // Here we effectively set the state to "no role".
        // @ts-ignore
        updatedTenants[tenantId] = null; 

        await UserMetadata.updateUserMetadata(userId, {
            tenants: updatedTenants
        });
    }


    // =========================================================================
    // Policy Management (Role and Rule Definitions)
    // =========================================================================

    /**
     * Retrieves all defined role names for a tenant.
     * E.g., ["admin", "editor", "viewer"]
     */
    static async listTenantRoles(tenantId: string): Promise<string[]> {
        const cacheKey = `roles_list:${tenantId}`;
        const cachedList = policyCache.get<string[]>(cacheKey);
        if (cachedList) return cachedList;

        try {
            const { metadata } = await UserMetadata.getUserMetadata(cacheKey);
            const roles = (metadata.roles as string[]) || [];
            
            policyCache.set(cacheKey, roles);
            return roles;
        } catch (e) {
            return [];
        }
    }

    /**
     * Retrieves the role policy stored via "Virtual ID" logic.
     * Checks the cache first, then fetches from SuperTokens.
     */
    static async getRolePolicy(tenantId: string, roleName: string): Promise<RolePolicy | null> {
        const cacheKey = `policy:${tenantId}:${roleName}`;
        const cachedPolicy = policyCache.get<RolePolicy>(cacheKey);
        if (cachedPolicy) return cachedPolicy;

        try {
            const { metadata } = await UserMetadata.getUserMetadata(cacheKey);
            if (!metadata || Object.keys(metadata).length === 0) return null;
            
            const policy = (metadata.policy as RolePolicy) || null;
            if (policy) policyCache.set(cacheKey, policy);
            
            return policy;
        } catch (err) {
            return null;
        }
    }

    /**
     * Creates or updates a role policy for a tenant.
     * Also updates the role list index.
     */
    static async setRolePolicy(tenantId: string, roleName: string, policy: RolePolicy) {
        // 1. Save Policy Data
        const policyKey = `policy:${tenantId}:${roleName}`;
        await UserMetadata.updateUserMetadata(policyKey, { policy: policy as any });
        policyCache.del(policyKey); // Invalidate cache

        // 2. Add role name to the list (Index update)
        const listKey = `roles_list:${tenantId}`;
        const { metadata } = await UserMetadata.getUserMetadata(listKey);
        const currentRoles = (metadata.roles as string[]) || [];

        if (!currentRoles.includes(roleName)) {
            const newRoles = [...currentRoles, roleName];
            await UserMetadata.updateUserMetadata(listKey, { roles: newRoles });
            policyCache.del(listKey); // Invalidate list cache
        }
    }

    /**
     * Completely deletes the role and its policy.
     */
    static async deleteRolePolicy(tenantId: string, roleName: string) {
        // 1. Delete Policy Data (by setting to null)
        const policyKey = `policy:${tenantId}:${roleName}`;
        await UserMetadata.updateUserMetadata(policyKey, { policy: null });
        policyCache.del(policyKey);

        // 2. Remove role name from the list
        const listKey = `roles_list:${tenantId}`;
        const { metadata } = await UserMetadata.getUserMetadata(listKey);
        const currentRoles = (metadata.roles as string[]) || [];

        const newRoles = currentRoles.filter(r => r !== roleName);
        if (newRoles.length !== currentRoles.length) {
            await UserMetadata.updateUserMetadata(listKey, { roles: newRoles });
            policyCache.del(listKey);
        }
    }

    // =========================================================================
    // Invite Management
    // =========================================================================

    /**
     * Adds a pending invite to the user's metadata.
     */
    static async addPendingInvite(userId: string, token: string, invite: InviteInfo): Promise<void> {
        const { metadata } = await UserMetadata.getUserMetadata(userId);
        const userMeta = metadata as UserMetadataStructure;

        const currentInvites = userMeta.pending_invites || {};

        const updatedInvites = {
            ...currentInvites,
            [token]: invite
        };

        await UserMetadata.updateUserMetadata(userId, {
            pending_invites: updatedInvites as any
        });
    }

    /**
     * Consumes (removes) a pending invite from the user's metadata and returns its data.
     */
    static async consumePendingInvite(userId: string, token: string): Promise<InviteInfo | null> {
        const { metadata } = await UserMetadata.getUserMetadata(userId);
        const userMeta = metadata as UserMetadataStructure;

        if (!userMeta.pending_invites || !userMeta.pending_invites[token]) {
            return null;
        }

        const inviteData = userMeta.pending_invites[token];

        const updatedInvites = { ...userMeta.pending_invites };
        delete updatedInvites[token];

        await UserMetadata.updateUserMetadata(userId, {
            pending_invites: updatedInvites as any
        });

        return inviteData;
    }
}