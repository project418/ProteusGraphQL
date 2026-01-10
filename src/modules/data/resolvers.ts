import { dataClient } from '../../clients/proteus.client';
import { structToJson } from '../../utils/struct-helper';
import { grpcCall, MyContext } from '../../utils/grpc-helper';

const mapRecord = (record: any) => {
  if (!record) return null;
  return {
    ...record,
    data: structToJson(record.data), 
  };
};

const resolvers = {
  Query: {
    getRecord: async (_: any, args: any, ctx: MyContext) => {
      const res = await grpcCall(dataClient, 'GetRecord', args, ctx);
      return mapRecord(res);
    },
    
    queryRecords: async (_: any, args: any, ctx: MyContext) => {
      const res: any = await grpcCall(dataClient, 'Query', args, ctx);
      return {
        ...res,
        data: res.data ? res.data.map(mapRecord) : [] 
      };
    },
  },

  Mutation: {
    createRecord: async (_: any, args: any, ctx: MyContext) => {
      const res = await grpcCall(dataClient, 'CreateRecord', args, ctx);
      return mapRecord(res);
    },
    
    updateRecord: async (_: any, args: any, ctx: MyContext) => {
      const res = await grpcCall(dataClient, 'UpdateRecord', args, ctx);
      return mapRecord(res);
    },
    
    deleteRecord: async (_: any, args: any, ctx: MyContext) => {
      return await grpcCall(dataClient, 'DeleteRecord', args, ctx);
    },
  },
};

export default resolvers;