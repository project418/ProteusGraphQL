import { MyContext } from '../../../../context';
import { protect } from '../../utils/auth-middleware';

const resolvers = {
  AuthQueries: {
    listTotpDevices: protect(
      async (_parent: any, _args: any, ctx: MyContext) => {
        const userId = ctx.session!.getUserId();
        return await ctx.mfaService.listTotpDevices(userId);
      },
      { allowMfaSetup: true, allowPasswordChange: true },
    ),
  },

  AuthMutations: {
    createTotpDevice: protect(
      async (_parent: any, args: { deviceName: string }, ctx: MyContext) => {
        const userId = ctx.session!.getUserId();
        return await ctx.mfaService.createTotpDevice(userId, args.deviceName);
      },
      { allowMfaSetup: true, allowPasswordChange: true },
    ),

    verifyTotpDevice: protect(
      async (_parent: any, args: { deviceName: string; totp: string }, ctx: MyContext) => {
        const userId = ctx.session!.getUserId();
        return await ctx.mfaService.verifyTotpDevice(userId, args.deviceName, args.totp, ctx);
      },
      { allowMfaSetup: true, allowPasswordChange: true },
    ),

    verifyMfa: protect(
      async (_parent: any, args: { totp: string }, ctx: MyContext) => {
        const userId = ctx.session!.getUserId();
        return await ctx.mfaService.verifyMfa(userId, args.totp, ctx);
      },
      { requireMfaVerification: false, allowPasswordChange: true },
    ),

    removeTotpDevice: protect(async (_parent: any, args: { deviceName: string }, ctx: MyContext) => {
      const userId = ctx.session!.getUserId();
      return await ctx.mfaService.removeTotpDevice(userId, args.deviceName, ctx);
    }),
  },
};

export default resolvers;
