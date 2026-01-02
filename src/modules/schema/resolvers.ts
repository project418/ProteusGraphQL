import { GraphQLJSON } from 'graphql-type-json';
import { schemaClient } from '../../clients/proteus.client';
import { structToJson } from '../../utils/struct-helper';

// Helper: gRPC Call Wrapper
const grpcCall = (method: Function, request: any) => {
  return new Promise((resolve, reject) => {
    method.call(schemaClient, request, (err: any, response: any) => {
      if (err) reject(err);
      else resolve(response);
    });
  });
};

const mapEntity = (entity: any) => {
  if (!entity) return null;
  
  const cleanFields = entity.fields ? entity.fields.map(mapField) : [];

  return {
    ...entity,
    fields: cleanFields
  };
};

const mapField = (field: any) => {
  if (!field) return null;
  return {
    ...field,
    ui_config: structToJson(field.ui_config),
    validation: structToJson(field.validation)
  };
};

const resolvers = {
  JSON: GraphQLJSON,

  Query: {
    entities: async () => {
      const res: any = await grpcCall(schemaClient.ListEntities, {});
      return {
        entities: res.entities.map(mapEntity) 
      };
    },

    entity: async (_: any, args: { id: string }) => {
      const res = await grpcCall(schemaClient.GetEntity, args);
      return mapEntity(res);
    },

    field: async (_: any, args: { id: string }) => {
      const res = await grpcCall(schemaClient.GetField, args);
      return mapField(res);
    },
  },

  Mutation: {
    createEntity: async (_: any, args: any) => {
      const res = await grpcCall(schemaClient.CreateEntity, args);
      return mapEntity(res);
    },

    updateEntity: async (_: any, args: any) => {
      const res = await grpcCall(schemaClient.UpdateEntity, args);
      return mapEntity(res);
    },

    deleteEntity: async (_: any, args: any) => {
      const res = await grpcCall(schemaClient.DeleteEntity, args);
      return res;
    },
    
    createField: async (_: any, args: any) => {
      const res = await grpcCall(schemaClient.CreateField, args);
      return mapField(res);
    },

    updateField: async (_: any, args: any) => {
      const res = await grpcCall(schemaClient.UpdateField, args);
      return mapField(res);
    },

    deleteField: async (_: any, args: any) => {
      const res = await grpcCall(schemaClient.DeleteField, args);
      return res;
    },
  },
};

export default resolvers;