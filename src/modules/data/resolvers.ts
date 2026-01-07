import { dataClient } from '../../clients/proteus.client';
import { structToJson } from '../../utils/struct-helper';

const grpcCall = (method: Function, request: any) => {
  return new Promise((resolve, reject) => {
    method.call(dataClient, request, (err: any, response: any) => {
      if (err) {
        console.error('gRPC Data Error:', err);
        reject(err);
      } else {
        resolve(response);
      }
    });
  });
};

const mapRecord = (record: any) => {
  if (!record) return null;
  return {
    ...record,
    data: structToJson(record.data), 
  };
};

const resolvers = {
  Query: {
    getRecord: async (_: any, args: any) => {
      const res = await grpcCall(dataClient.GetRecord, args);
      return mapRecord(res);
    },
    
    queryRecords: async (_: any, args: any) => {
      const res: any = await grpcCall(dataClient.Query, args);
      return {
        ...res,
        data: res.data ? res.data.map(mapRecord) : [] 
      };
    },
  },

  Mutation: {
    createRecord: async (_: any, args: any) => {
      const res = await grpcCall(dataClient.CreateRecord, args);
      return mapRecord(res);
    },
    
    updateRecord: async (_: any, args: any) => {
      const res = await grpcCall(dataClient.UpdateRecord, args);
      return mapRecord(res);
    },
    
    deleteRecord: (_: any, args: any) => grpcCall(dataClient.DeleteRecord, args),
  },
};

export default resolvers;