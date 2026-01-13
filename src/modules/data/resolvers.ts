import { MyContext } from '../../context';
import { checkEntityAccess } from '../auth/utils/rbac-helper';

const resolvers = {
  Query: {
    data: () => ({}),
  },
  Mutation: {
    data: () => ({}),
  },

  DataQueries: {
    getRecord: async (_parent: any, args: any, ctx: MyContext) => {
      checkEntityAccess(ctx, args.entity_id, 'read');
      return await ctx.dataService.getRecord(args.entity_id, args.record_id, ctx);
    },

    queryRecords: async (_parent: any, args: any, ctx: MyContext) => {
      checkEntityAccess(ctx, args.entity_id, 'read');
      return await ctx.dataService.queryRecords(
        args.entity_id,
        args.filters,
        args.sort,
        args.pagination,
        ctx
      );
    },
  },

  DataMutations: {
    createRecord: async (_parent: any, args: any, ctx: MyContext) => {
      checkEntityAccess(ctx, args.entity_id, 'create');
      return await ctx.dataService.createRecord(args.entity_id, args.data, ctx);
    },

    updateRecord: async (_parent: any, args: any, ctx: MyContext) => {
      checkEntityAccess(ctx, args.entity_id, 'update');
      return await ctx.dataService.updateRecord(
        args.entity_id,
        args.record_id,
        args.data,
        ctx
      );
    },

    deleteRecord: async (_parent: any, args: any, ctx: MyContext) => {
      checkEntityAccess(ctx, args.entity_id, 'delete');
      return await ctx.dataService.deleteRecord(args.entity_id, args.record_id, ctx);
    },
  },
};

export default resolvers;