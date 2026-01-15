import { GraphQLError } from 'graphql';
import { MyContext } from '../../../context';

// =========================================================================
// Access Control (Guard Functions)
// =========================================================================

/**
 * Checks if the user has permission to perform a specific action on an entity.
 * Throws a GraphQLError if access is denied.
 *
 * @param ctx GraphQL Context (contains currentPermissions)
 * @param entityName The entity to access (e.g., "entity_customers")
 * @param action The action to perform ("read", "create", "update", "delete")
 */
export const checkEntityAccess = (
  ctx: MyContext,
  entityName: string,
  action: 'read' | 'create' | 'update' | 'delete',
) => {
  const permissions = ctx.currentPermissions;

  // 1. Deny if no permissions exist (or no session)
  if (!permissions) {
    throw new GraphQLError('Access denied: No permissions found.', {
      extensions: { code: 'FORBIDDEN', http: { status: 403 } },
    });
  }

  const entityRule = permissions[entityName];

  // 2. Deny if there is no rule for this entity AND no wildcard rule
  // Note: To allow wildcard access (super admin), "*" rule is checked as fallback.
  const effectiveRule = entityRule || permissions['*'];

  if (!effectiveRule || !effectiveRule.access) {
    throw new GraphQLError(`Access denied: You cannot access '${entityName}'.`, {
      extensions: { code: 'FORBIDDEN', http: { status: 403 } },
    });
  }

  // 3. Is the requested action allowed? (Check for specific action or "*")
  const allowedActions = effectiveRule.actions || [];
  if (!allowedActions.includes('*') && !allowedActions.includes(action)) {
    throw new GraphQLError(`Access denied: You cannot perform '${action}' on '${entityName}'.`, {
      extensions: { code: 'FORBIDDEN', http: { status: 403 } },
    });
  }

  // Access granted, function completes silently.
};

// =========================================================================
// Data Sanitization (Field Level Security)
// =========================================================================

/**
 * Sanitizes a single record from the database based on the user's "denied_fields" list.
 * Removes restricted fields from the data object.
 *
 * @param record Raw record from database (id, data: {...})
 * @param entityName Name of the entity
 * @param ctx GraphQL Context
 */
export const sanitizeRecord = (record: any, entityName: string, ctx: MyContext) => {
  if (!record || !record.data || !ctx.currentPermissions) {
    return record;
  }

  // Check for specific entity rule, fall back to wildcard if needed
  const entityRule = ctx.currentPermissions[entityName] || ctx.currentPermissions['*'];

  // Return original record if no rule or no denied fields exist
  if (!entityRule || !entityRule.denied_fields || entityRule.denied_fields.length === 0) {
    return record;
  }

  // Filter out denied fields
  // Note: We mutate the data object directly here for performance, as it's a deep copy from gRPC response usually.
  entityRule.denied_fields.forEach((field) => {
    if (record.data[field] !== undefined) {
      delete record.data[field];
    }
  });

  return record;
};

/**
 * Helper function to sanitize a list of records.
 * Iterates through the list and applies sanitizeRecord to each item.
 */
export const sanitizeRecords = (records: any[], entityName: string, ctx: MyContext) => {
  if (!records || !Array.isArray(records)) return [];
  return records.map((record) => sanitizeRecord(record, entityName, ctx));
};