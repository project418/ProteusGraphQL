import { GraphQLJSON } from 'graphql-type-json';
import { MyContext } from '../../context';

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
      return await ctx.schemaService.listEntities(ctx);
    },

    entity: async (_parent: any, args: { id: string }, ctx: MyContext) => {
      return await ctx.schemaService.getEntity(args.id, ctx);
    },

    field: async (_parent: any, args: { id: string }, ctx: MyContext) => {
      return await ctx.schemaService.getField(args.id, ctx);
    },
  },

  SchemaMutations: {
    // -- Entity Operations
    createEntity: async (_parent: any, args: any, ctx: MyContext) => {
      return await ctx.schemaService.createEntity(args, ctx);
    },

    updateEntity: async (_parent: any, args: any, ctx: MyContext) => {
      return await ctx.schemaService.updateEntity(args, ctx);
    },

    deleteEntity: async (_parent: any, args: any, ctx: MyContext) => {
      return await ctx.schemaService.deleteEntity(args.id, ctx);
    },
    
    // -- Field Operations
    createField: async (_parent: any, args: any, ctx: MyContext) => {
      return await ctx.schemaService.createField(args, ctx);
    },

    updateField: async (_parent: any, args: any, ctx: MyContext) => {
      return await ctx.schemaService.updateField(args, ctx);
    },

    deleteField: async (_parent: any, args: any, ctx: MyContext) => {
      return await ctx.schemaService.deleteField(args.id, ctx);
    },
  },
};

export default resolvers;