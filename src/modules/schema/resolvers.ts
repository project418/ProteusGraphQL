import { GraphQLJSON } from 'graphql-type-json';
import { schemaClient } from '../../clients/proteus.client';
import { structToJson } from '../../utils/struct-helper';
import { grpcCall, MyContext } from '../../utils/grpc-helper';

// --- Helpers ---
const mapEntity = (entity: any) => {
  if (!entity) return null;
  const cleanFields = entity.fields ? entity.fields.map(mapField) : [];
  return { ...entity, fields: cleanFields };
};

const mapField = (field: any) => {
  if (!field) return null;
  return {
    ...field,
    ui_config: structToJson(field.ui_config),
    validation: structToJson(field.validation),
  };
};

const resolvers = {
  JSON: GraphQLJSON,

  Query: {
    schema: () => ({}),
  },
  Mutation: {
    schema: () => ({}),
  },

  SchemaQueries: {
    entities: async (_parent: any, _args: any, ctx: MyContext) => {
      const res: any = await grpcCall(schemaClient, 'ListEntities', {}, ctx);
      return {
        entities: res.entities.map(mapEntity),
      };
    },

    entity: async (_parent: any, args: { id: string }, ctx: MyContext) => {
      const res = await grpcCall(schemaClient, 'GetEntity', args, ctx);
      return mapEntity(res);
    },

    field: async (_parent: any, args: { id: string }, ctx: MyContext) => {
      const res = await grpcCall(schemaClient, 'GetField', args, ctx);
      return mapField(res);
    },
  },

  SchemaMutations: {
    // -- Entity Operations
    createEntity: async (_parent: any, args: any, ctx: MyContext) => {
      const res = await grpcCall(schemaClient, 'CreateEntity', args, ctx);
      return mapEntity(res);
    },

    updateEntity: async (_parent: any, args: any, ctx: MyContext) => {
      const res = await grpcCall(schemaClient, 'UpdateEntity', args, ctx);
      return mapEntity(res);
    },

    deleteEntity: async (_parent: any, args: any, ctx: MyContext) => {
      return await grpcCall(schemaClient, 'DeleteEntity', args, ctx);
    },

    // -- Field Operations
    createField: async (_parent: any, args: any, ctx: MyContext) => {
      const res = await grpcCall(schemaClient, 'CreateField', args, ctx);
      return mapField(res);
    },

    updateField: async (_parent: any, args: any, ctx: MyContext) => {
      const res = await grpcCall(schemaClient, 'UpdateField', args, ctx);
      return mapField(res);
    },

    deleteField: async (_parent: any, args: any, ctx: MyContext) => {
      return await grpcCall(schemaClient, 'DeleteField', args, ctx);
    },
  },
};

export default resolvers;
