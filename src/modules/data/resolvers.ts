import { dataClient } from '../../clients/proteus.client';
import { structToJson } from '../../utils/struct-helper';
import { grpcCall, MyContext } from '../../utils/grpc-helper';
import { checkEntityAccess, sanitizeRecord, sanitizeRecords } from '../../utils/rbac-helper';

// --- Helpers ---
const mapRecord = (record: any) => {
  if (!record) return null;
  return {
    ...record,
    data: structToJson(record.data), 
  };
};

const resolvers = {
  Query: {
    data: () => ({}),
  },
  Mutation: {
    data: () => ({}),
  },

  DataQueries: {
    getRecord: async (_parent: any, args: any, ctx: MyContext) => {
      checkEntityAccess(ctx, args.entity_id, "read");

      const res = await grpcCall(dataClient, 'GetRecord', args, ctx);
      const mapped = mapRecord(res);

      return sanitizeRecord(mapped, args.entity_id, ctx);
    },
    
    queryRecords: async (_parent: any, args: any, ctx: MyContext) => {
      checkEntityAccess(ctx, args.entity_id, "read");

      const res: any = await grpcCall(dataClient, 'Query', args, ctx);
      const mappedList = res.data ? res.data.map(mapRecord) : [];

      return {
        ...res,
        data: sanitizeRecords(mappedList, args.entity_id, ctx)
      };
    },
  },

  DataMutations: {
    createRecord: async (_parent: any, args: any, ctx: MyContext) => {
      checkEntityAccess(ctx, args.entity_id, "create");

      const res = await grpcCall(dataClient, 'CreateRecord', args, ctx);
      const mapped = mapRecord(res);
      
      return sanitizeRecord(mapped, args.entity_id, ctx);
    },
    
    updateRecord: async (_parent: any, args: any, ctx: MyContext) => {
      checkEntityAccess(ctx, args.entity_id, "update");

      const res = await grpcCall(dataClient, 'UpdateRecord', args, ctx);
      const mapped = mapRecord(res);
      
      return sanitizeRecord(mapped, args.entity_id, ctx);
    },
    
    deleteRecord: async (_parent: any, args: any, ctx: MyContext) => {
      checkEntityAccess(ctx, args.entity_id, "delete");

      return await grpcCall(dataClient, 'DeleteRecord', args, ctx);
    },
  },
};

export default resolvers;