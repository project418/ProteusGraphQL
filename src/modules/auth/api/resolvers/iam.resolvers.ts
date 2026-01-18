import { GraphQLError } from 'graphql';
import { MyContext } from '../../../../context';
import { protect } from '../../utils/auth-middleware';
import { checkEntityAccess } from '../../utils/rbac-helper';

const resolvers = {
  AuthQueries: {
    tenantUsers: protect(async (_parent: any, args: { limit?: number; paginationToken?: string }, ctx: MyContext) => {
      if (!ctx.tenantId) throw new GraphQLError('Tenant ID required.', { extensions: { code: 'BAD_REQUEST' } });
      checkEntityAccess(ctx, 'system_iam', 'read');

      return await ctx.iamService.getTenantUsers(ctx.tenantId, args.limit, args.paginationToken);
    }),
  },

  AuthMutations: {
    updateMe: protect(
      async (_parent: any, args: { input: { email?: string; password?: string } }, ctx: MyContext) => {
        const userId = ctx.session!.getUserId();
        return await ctx.iamService.updateUser(userId, args.input, ctx);
      },
      { allowPasswordChange: true },
    ),

    createOwnTenant: protect(async (_parent: any, args: { name: string }, ctx: MyContext) => {
      const userId = ctx.session!.getUserId();
      return await ctx.iamService.createOwnTenant(userId, args.name, ctx);
    }),

    updateTenant: protect(async (_parent: any, args: { name: string }, ctx: MyContext) => {
      if (!ctx.tenantId) throw new GraphQLError('Tenant ID required.', { extensions: { code: 'BAD_REQUEST' } });
      checkEntityAccess(ctx, 'system_iam', 'update');

      return await ctx.iamService.updateTenant(ctx.tenantId, args.name, ctx);
    }),

    inviteUser: protect(async (_parent: any, args: { email: string; roleName: string }, ctx: MyContext) => {
      if (!ctx.tenantId) throw new GraphQLError('Tenant ID required.', { extensions: { code: 'BAD_REQUEST' } });
      checkEntityAccess(ctx, 'system_iam', 'create');

      const senderId = ctx.session!.getUserId();
      return await ctx.iamService.inviteUser(args.email, args.roleName, ctx.tenantId, senderId);
    }),

    acceptInvite: protect(async (_parent: any, args: { token: string }, ctx: MyContext) => {
      const userId = ctx.session!.getUserId();
      return await ctx.iamService.acceptInvite(userId, args.token);
    }),

    assignRole: protect(async (_parent: any, args: { userId: string; roleName: string }, ctx: MyContext) => {
      if (!ctx.tenantId) throw new GraphQLError('Tenant ID required.', { extensions: { code: 'BAD_REQUEST' } });
      checkEntityAccess(ctx, 'system_iam', 'update');

      // Note: assignRole is conceptually an RBAC operation but handled by IamService for user management flow,
      // or we can use rbacService directly. Let's use RbacService for purity.
      await ctx.rbacService.assignRole(args.userId, ctx.tenantId, args.roleName);
      return true;
    }),

    removeUserFromTenant: protect(async (_parent: any, args: { userId: string }, ctx: MyContext) => {
      if (!ctx.tenantId) throw new GraphQLError('Tenant ID required.', { extensions: { code: 'BAD_REQUEST' } });
      checkEntityAccess(ctx, 'system_iam', 'delete');

      await ctx.iamService.removeUserFromTenant(args.userId, ctx.tenantId);
      return true;
    }),
  },
};

export default resolvers;
