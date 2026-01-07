require('dotenv').config();
import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { mergeTypeDefs, mergeResolvers } from '@graphql-tools/merge';

import schemaTypeDefs from './modules/schema/typeDefs';
import schemaResolvers from './modules/schema/resolvers';
import dataTypeDefs from './modules/data/typeDefs';
import dataResolvers from './modules/data/resolvers';

const typeDefs = mergeTypeDefs([
  schemaTypeDefs,
  dataTypeDefs
]);

const resolvers = mergeResolvers([
  schemaResolvers,
  dataResolvers
]);

const server = new ApolloServer({
  typeDefs,
  resolvers,
});

const startServer = async () => {
  const { url } = await startStandaloneServer(server, {
    listen: { port: 4000 },
  });
  console.log(`🚀 Gateway Ready: ${url}`);
};

startServer();