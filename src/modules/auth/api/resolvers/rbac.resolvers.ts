import { GraphQLError } from 'graphql';
import { MyContext } from '../../../../context';
import { protect } from '../../utils/auth-middleware';
import { checkEntityAccess } from '../../utils/rbac-helper';

const SYSTEM_ROLES = ['admin'];

const resolvers = {
  AuthQueries: {
    listRoles: protect(async (_parent: any, _args: any, ctx: MyContext) => {
      if (!ctx.tenantId) throw new GraphQLError('Tenant ID required.', { extensions: { code: 'BAD_REQUEST' } });
      checkEntityAccess(ctx, 'system_iam', 'read');

      const roleNames = await ctx.rbacService.listTenantRoles(ctx.tenantId);
      const results = [];

      for (const name of roleNames) {
        const permissions = await ctx.rbacService.getRolePermissions(ctx.tenantId, name);
        results.push({ name, permissions });
      }
      return results;
    }),

    getRolePermissions: protect(async (_parent: any, args: { roleName: string }, ctx: MyContext) => {
      if (!ctx.tenantId) throw new GraphQLError('Tenant ID required.', { extensions: { code: 'BAD_REQUEST' } });
      checkEntityAccess(ctx, 'system_iam', 'read');

      return await ctx.rbacService.getRolePermissions(ctx.tenantId, args.roleName);
    }),
  },

  AuthMutations: {
    createRole: protect(async (_parent: any, args: { roleName: string; permissions: string[] }, ctx: MyContext) => {
      if (!ctx.tenantId) throw new GraphQLError('Tenant ID required.', { extensions: { code: 'BAD_REQUEST' } });
      checkEntityAccess(ctx, 'system_iam', 'create');

      if (SYSTEM_ROLES.includes(args.roleName)) {
        throw new GraphQLError('Cannot create or overwrite system roles.', { extensions: { code: 'FORBIDDEN' } });
      }

      await ctx.rbacService.createOrUpdateRole(ctx.tenantId, args.roleName, args.permissions);
      return true;
    }),

    updateRole: protect(async (_parent: any, args: { roleName: string; permissions: string[] }, ctx: MyContext) => {
      if (!ctx.tenantId) throw new GraphQLError('Tenant ID required.', { extensions: { code: 'BAD_REQUEST' } });
      checkEntityAccess(ctx, 'system_iam', 'update');

      if (SYSTEM_ROLES.includes(args.roleName)) {
        throw new GraphQLError('System roles cannot be modified.', { extensions: { code: 'FORBIDDEN' } });
      }

      await ctx.rbacService.createOrUpdateRole(ctx.tenantId, args.roleName, args.permissions);
      return true;
    }),

    deleteRole: protect(async (_parent: any, args: { roleName: string }, ctx: MyContext) => {
      if (!ctx.tenantId) throw new GraphQLError('Tenant ID required.', { extensions: { code: 'BAD_REQUEST' } });
      checkEntityAccess(ctx, 'system_iam', 'delete');

      if (SYSTEM_ROLES.includes(args.roleName)) {
        throw new GraphQLError('Cannot delete system roles.', { extensions: { code: 'FORBIDDEN' } });
      }

      await ctx.rbacService.deleteRole(ctx.tenantId, args.roleName);
      return true;
    }),
  },
};

export default resolvers;
