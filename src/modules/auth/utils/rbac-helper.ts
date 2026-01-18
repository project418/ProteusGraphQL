import { GraphQLError } from 'graphql';
import { MyContext } from '../../../context';

// =========================================================================
// Access Control (Guard Functions)
// =========================================================================

/**
 * Checks if the user has permission to perform a specific action on an entity.
 * Uses SuperTokens String Permissions (e.g. "orders:create", "orders:*", "*:*")
 *
 * @param ctx GraphQL Context (contains currentPermissions string array)
 * @param entityName The entity to access (e.g., "orders")
 * @param action The action to perform ("read", "create", "update", "delete")
 */
export const checkEntityAccess = (
  ctx: MyContext,
  entityName: string,
  action: 'read' | 'create' | 'update' | 'delete',
) => {
  const permissions = ctx.currentPermissions || [];

  // 1. Super Admin Wildcard (*:*)
  if (permissions.includes('*:*')) {
    return;
  }

  // 2. Resource Wildcard (entityName:*)
  const resourceWildcard = `${entityName}:*`;
  if (permissions.includes(resourceWildcard)) {
    return;
  }

  // 3. Exact Action Permission (entityName:action)
  // Örn: "orders:read"
  const requiredPermission = `${entityName}:${action}`;
  if (permissions.includes(requiredPermission)) {
    return;
  }

  throw new GraphQLError(`Access denied: You cannot perform '${action}' on '${entityName}'.`, {
    extensions: { code: 'FORBIDDEN', http: { status: 403 } },
  });
};
export const sanitizeRecord = (record: any, entityName: string, ctx: MyContext) => record;
export const sanitizeRecords = (records: any[], entityName: string, ctx: MyContext) => records;
