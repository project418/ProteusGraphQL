require('dotenv').config();
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import express, { Request, Response } from 'express';
import http from 'http';
import cors from 'cors';
import bodyParser from 'body-parser';
import { mergeTypeDefs, mergeResolvers } from '@graphql-tools/merge';

import { initSuperTokens } from './config/supertokens';
import { middleware, errorHandler } from 'supertokens-node/framework/express';
import { verifySession } from 'supertokens-node/recipe/session/framework/express';
import { SessionRequest } from 'supertokens-node/framework/express';
import SuperTokens from 'supertokens-node';

import schemaTypeDefs from './modules/schema/typeDefs';
import schemaResolvers from './modules/schema/resolvers';
import dataTypeDefs from './modules/data/typeDefs';
import dataResolvers from './modules/data/resolvers';
import authTypeDefs from './modules/auth/typeDefs';
import authResolvers from './modules/auth/resolvers';

import { MyContext } from './utils/grpc-helper';
import { formatError } from './utils/error-handler';

import { AuthService } from './modules/auth/services/auth.service';
import { SuperTokensProvider } from './modules/auth/providers/supertokens.provider';
import { SuperTokensSession } from './modules/auth/providers/supertokens.session';

initSuperTokens();

// --- START AUTH SERVICE ---
const authProvider = new SuperTokensProvider();
const authService = new AuthService(authProvider);

const rootTypeDefs = `#graphql
  type Query {
    _empty: String
  }
  
  type Mutation {
    _empty: String
  }
`;

const typeDefs = mergeTypeDefs([rootTypeDefs, schemaTypeDefs, dataTypeDefs, authTypeDefs]);

const resolvers = mergeResolvers([schemaResolvers, dataResolvers, authResolvers]);

const startServer = async () => {
  const app = express();
  const httpServer = http.createServer(app);

  const server = new ApolloServer<MyContext>({
    typeDefs,
    resolvers,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
    formatError,
  });

  await server.start();

  app.use(
    cors({
      origin: 'http://localhost:3000',
      allowedHeaders: ['content-type', ...SuperTokens.getAllCORSHeaders(), 'x-tenant-id'],
      credentials: true,
    }),
  );

  app.use(middleware());

  app.use(
    '/graphql',
    bodyParser.json(),
    verifySession({ sessionRequired: false }),

    expressMiddleware(server, {
      context: async ({ req, res }: { req: Request; res: Response }) => {
        const stSession = (req as SessionRequest).session;

        let session;
        if (stSession) {
          session = new SuperTokensSession(stSession);
        }

        const headerTenantId = req.headers['x-tenant-id'] as string;
        const tenantId = headerTenantId || '';

        let currentUserRole: string | undefined = undefined;
        let currentPermissions: any = undefined;

        if (session && tenantId) {
          const userId = session.getUserId();

          const roleName = await authService.getUserRoleInTenant(userId, tenantId);
          if (roleName) {
            currentUserRole = roleName;
            const policy = await authService.getRolePolicy(tenantId, roleName);
            if (policy) {
              currentPermissions = policy.permissions;
            }
          }
        }

        return {
          session,
          authService,
          tenantId,
          currentUserRole,
          currentPermissions,
          req,
          res,
        };
      },
    }),
  );

  app.use(errorHandler());

  const PORT = process.env.PORT || 4000;
  await new Promise<void>((resolve) => httpServer.listen({ port: PORT }, resolve));
  console.log(`🚀 Gateway ready at http://localhost:${PORT}/graphql`);
};

startServer();
