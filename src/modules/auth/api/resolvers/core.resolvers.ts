import { MyContext } from '../../../../context';
import { protect } from '../../utils/auth-middleware';

const resolvers = {
  AuthQueries: {
    // Uses IamService
    me: protect(async (_parent: any, _args: any, ctx: MyContext) => {
      const userId = ctx.session!.getUserId();
      return await ctx.iamService.getUser(userId);
    }),

    myPermissions: async (_parent: any, _args: any, ctx: MyContext) => {
      return ctx.currentPermissions || null;
    },

    // Uses IamService
    myTenants: protect(async (_parent: any, _args: any, ctx: MyContext) => {
      const userId = ctx.session!.getUserId();
      return await ctx.iamService.getTenants(userId, ctx);
    }),
  },

  AuthMutations: {
    // Uses AuthCoreService
    login: async (_parent: any, args: any, ctx: MyContext) => {
      return await ctx.authCoreService.login(args.email, args.password, ctx);
    },

    register: async (_parent: any, args: any, ctx: MyContext) => {
      return await ctx.authCoreService.register(args.email, args.password, args.firstName, args.lastName);
    },

    refreshToken: async (_parent: any, args: any, ctx: MyContext) => {
      return await ctx.authCoreService.refreshToken(args.refreshToken, ctx);
    },

    logout: protect(
      async (_parent: any, _args: any, ctx: MyContext) => {
        const userId = ctx.session!.getUserId();
        await ctx.authCoreService.logout(userId);
        await ctx.session!.revoke();
        return true;
      },
      { requireMfaVerification: false, allowMfaSetup: true, allowPasswordChange: false },
    ),

    sendPasswordResetEmail: async (_parent: any, args: { email: string }, ctx: MyContext) => {
      return await ctx.authCoreService.sendPasswordResetEmail(args.email);
    },

    resetPassword: async (_parent: any, args: { token: string; password: string }, ctx: MyContext) => {
      return await ctx.authCoreService.resetPassword(args.token, args.password);
    },
  },
};

export default resolvers;