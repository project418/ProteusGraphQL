import { GraphQLError } from 'graphql';
import { MyContext } from '../../context';
import { protect } from './utils/auth-middleware';
import { checkEntityAccess } from './utils/rbac-helper';
import { RolePolicy } from './interfaces/rbac.interface';

const resolvers = {
  Query: {
    auth: () => ({}),
  },
  Mutation: {
    auth: () => ({}),
  },

  AuthQueries: {
    // Self Service
    me: protect(async (_parent: any, _args: any, ctx: MyContext) => {
      const userId = ctx.session!.getUserId();
      return await ctx.authService.getUser(userId);
    }),

    myPermissions: async (_parent: any, _args: any, ctx: MyContext) => {
      return ctx.currentPermissions || null;
    },

    // User Management
    tenantUsers: protect(async (_parent: any, args: { limit?: number; paginationToken?: string }, ctx: MyContext) => {
      if (!ctx.tenantId) throw new GraphQLError('Tenant ID required.', { extensions: { code: 'BAD_REQUEST' } });

      checkEntityAccess(ctx, 'system_iam', 'read');

      return await ctx.authService.getTenantUsers(ctx.tenantId, args.limit, args.paginationToken);
    }),

    // Policy Management
    listPolicies: protect(async (_parent: any, _args: any, ctx: MyContext) => {
      if (!ctx.tenantId)
        throw new GraphQLError('Tenant ID header is required.', {
          extensions: { code: 'BAD_REQUEST' },
        });
      checkEntityAccess(ctx, 'system_iam', 'read');

      const roleNames = await ctx.authService.listTenantRoles(ctx.tenantId);
      const results = [];
      for (const name of roleNames) {
        const policy = await ctx.authService.getRolePolicy(ctx.tenantId, name);
        if (policy) {
          results.push({ name, policy });
        }
      }
      return results;
    }),

    getPolicy: protect(async (_parent: any, args: { roleName: string }, ctx: MyContext) => {
      if (!ctx.tenantId)
        throw new GraphQLError('Tenant ID header is required.', {
          extensions: { code: 'BAD_REQUEST' },
        });
      checkEntityAccess(ctx, 'system_iam', 'read');

      return await ctx.authService.getRolePolicy(ctx.tenantId, args.roleName);
    }),
  },

  AuthMutations: {
    // Authentication
    login: async (_parent: any, args: any, ctx: MyContext) => {
      return await ctx.authService.login(args.email, args.password, ctx);
    },

    register: async (_parent: any, args: any, ctx: MyContext) => {
      return await ctx.authService.register(args.email, args.password, ctx);
    },

    refreshToken: async (_parent: any, args: any, ctx: MyContext) => {
      return await ctx.authService.refreshToken(args.refreshToken, ctx);
    },

    logout: protect(async (_parent: any, _args: any, ctx: MyContext) => {
      const userId = ctx.session!.getUserId();
      await ctx.authService.logout(userId);
      await ctx.session!.revoke();

      return true;
    }),

    // MFA Operations
    createTotpDevice: protect(
      async (_parent: any, args: { deviceName: string }, ctx: MyContext) => {
        const userId = ctx.session!.getUserId();
        return await ctx.authService.createTotpDevice(userId, args.deviceName);
      },
      { allowMfaSetup: true },
    ),

    verifyTotpDevice: protect(
      async (_parent: any, args: { deviceName: string; totp: string }, ctx: MyContext) => {
        const userId = ctx.session!.getUserId();
        return await ctx.authService.verifyTotpDevice(userId, args.deviceName, args.totp, ctx);
      },
      { allowMfaSetup: true },
    ),

    verifyMfa: protect(
      async (_parent: any, args: { totp: string }, ctx: MyContext) => {
        const userId = ctx.session!.getUserId();
        return await ctx.authService.verifyMfa(userId, args.totp, ctx);
      },
      { requireMfaVerification: false },
    ),

    removeTotpDevice: protect(async (_parent: any, args: { deviceName: string }, ctx: MyContext) => {
      const userId = ctx.session!.getUserId();
      return await ctx.authService.removeTotpDevice(userId, args.deviceName, ctx);
    }),

    // Password Reset
    sendPasswordResetEmail: async (_parent: any, args: { email: string }, ctx: MyContext) => {
      return await ctx.authService.sendPasswordResetEmail(args.email);
    },

    resetPassword: async (_parent: any, args: { token: string; password: string }, ctx: MyContext) => {
      return await ctx.authService.resetPassword(args.token, args.password);
    },

    // Tenant Creation
    createOwnTenant: protect(async (_parent: any, args: { name: string }, ctx: MyContext) => {
      const userId = ctx.session!.getUserId();
      return await ctx.authService.createOwnTenant(userId, args.name, ctx);
    }),

    // Self Service
    updateMe: protect(async (_parent: any, args: { input: { email?: string; password?: string } }, ctx: MyContext) => {
      const userId = ctx.session!.getUserId();
      return await ctx.authService.updateUser(userId, args.input);
    }),

    // User Management
    inviteUser: protect(async (_parent: any, args: { email: string; roleName: string }, ctx: MyContext) => {
      if (!ctx.tenantId) throw new GraphQLError('Tenant ID required.', { extensions: { code: 'BAD_REQUEST' } });
      checkEntityAccess(ctx, 'system_iam', 'create');

      const senderId = ctx.session!.getUserId();
      return await ctx.authService.inviteUser(args.email, args.roleName, ctx.tenantId, senderId);
    }),

    acceptInvite: protect(async (_parent: any, args: { token: string }, ctx: MyContext) => {
      const userId = ctx.session!.getUserId();
      return await ctx.authService.acceptInvite(userId, args.token);
    }),

    assignRole: protect(async (_parent: any, args: { userId: string; roleName: string }, ctx: MyContext) => {
      if (!ctx.tenantId)
        throw new GraphQLError('Tenant ID header is required.', {
          extensions: { code: 'BAD_REQUEST' },
        });
      checkEntityAccess(ctx, 'system_iam', 'update');

      await ctx.authService.assignRole(args.userId, ctx.tenantId, args.roleName);
      return true;
    }),

    removeUserFromTenant: protect(async (_parent: any, args: { userId: string }, ctx: MyContext) => {
      if (!ctx.tenantId) throw new GraphQLError('Tenant ID required.', { extensions: { code: 'BAD_REQUEST' } });
      checkEntityAccess(ctx, 'system_iam', 'delete');

      await ctx.authService.removeUserFromTenant(args.userId, ctx.tenantId);
      return true;
    }),

    updateUser: protect(
      async (_parent: any, args: { userId: string; input: { email?: string; password?: string } }, ctx: MyContext) => {
        if (!ctx.tenantId)
          throw new GraphQLError('Tenant ID header is required.', {
            extensions: { code: 'BAD_REQUEST' },
          });
        checkEntityAccess(ctx, 'system_iam', 'update');

        return await ctx.authService.updateUser(args.userId, args.input);
      },
    ),

    // Policy Management
    createPolicy: protect(async (_parent: any, args: { roleName: string; policy: RolePolicy }, ctx: MyContext) => {
      if (!ctx.tenantId)
        throw new GraphQLError('Tenant ID header is required.', {
          extensions: { code: 'BAD_REQUEST' },
        });
      checkEntityAccess(ctx, 'system_iam', 'create');

      await ctx.authService.setRolePolicy(ctx.tenantId, args.roleName, args.policy);
      return true;
    }),

    deletePolicy: protect(async (_parent: any, args: { roleName: string }, ctx: MyContext) => {
      if (!ctx.tenantId)
        throw new GraphQLError('Tenant ID header is required.', {
          extensions: { code: 'BAD_REQUEST' },
        });
      checkEntityAccess(ctx, 'system_iam', 'delete');

      if (args.roleName === 'admin') {
        throw new GraphQLError('Cannot delete root admin role.', {
          extensions: { code: 'BAD_REQUEST' },
        });
      }

      await ctx.authService.deleteRolePolicy(ctx.tenantId, args.roleName);
      return true;
    }),
  },
};

export default resolvers;
