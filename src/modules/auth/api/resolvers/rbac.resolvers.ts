import { GraphQLError } from 'graphql';
import { MyContext } from '../../../../context';
import { protect } from '../../utils/auth-middleware';
import { checkEntityAccess } from '../../utils/rbac-helper';
import { RolePolicy } from '../../interfaces/rbac.types';

const resolvers = {
  AuthQueries: {
    listPolicies: protect(async (_parent: any, _args: any, ctx: MyContext) => {
      if (!ctx.tenantId) throw new GraphQLError('Tenant ID required.', { extensions: { code: 'BAD_REQUEST' } });
      checkEntityAccess(ctx, 'system_iam', 'read');

      const roleNames = await ctx.rbacService.listTenantRoles(ctx.tenantId);
      const results = [];
      for (const name of roleNames) {
        const policy = await ctx.rbacService.getRolePolicy(ctx.tenantId, name);
        if (policy) {
          results.push({ name, policy });
        }
      }
      return results;
    }),

    getPolicy: protect(async (_parent: any, args: { roleName: string }, ctx: MyContext) => {
      if (!ctx.tenantId) throw new GraphQLError('Tenant ID required.', { extensions: { code: 'BAD_REQUEST' } });
      checkEntityAccess(ctx, 'system_iam', 'read');

      return await ctx.rbacService.getRolePolicy(ctx.tenantId, args.roleName);
    }),
  },

  AuthMutations: {
    createPolicy: protect(async (_parent: any, args: { roleName: string; policy: RolePolicy }, ctx: MyContext) => {
      if (!ctx.tenantId) throw new GraphQLError('Tenant ID required.', { extensions: { code: 'BAD_REQUEST' } });
      checkEntityAccess(ctx, 'system_iam', 'create');

      await ctx.rbacService.setRolePolicy(ctx.tenantId, args.roleName, args.policy);
      return true;
    }),

    deletePolicy: protect(async (_parent: any, args: { roleName: string }, ctx: MyContext) => {
      if (!ctx.tenantId) throw new GraphQLError('Tenant ID required.', { extensions: { code: 'BAD_REQUEST' } });
      checkEntityAccess(ctx, 'system_iam', 'delete');

      if (args.roleName === 'admin') {
        throw new GraphQLError('Cannot delete root admin role.', { extensions: { code: 'BAD_REQUEST' } });
      }

      await ctx.rbacService.deleteRolePolicy(ctx.tenantId, args.roleName);
      return true;
    }),
  },
};

export default resolvers;