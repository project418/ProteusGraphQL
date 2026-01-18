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

// TypeDefs & Resolvers (Updated Paths)
import schemaTypeDefs from './modules/schema/typeDefs';
import schemaResolvers from './modules/schema/resolvers';
import dataTypeDefs from './modules/data/typeDefs';
import dataResolvers from './modules/data/resolvers';
import authTypeDefs from './modules/auth/api/typeDefs';
import authResolvers from './modules/auth/api/resolvers';

import { MyContext } from './context';
import { formatError } from './utils/error-handler';

// Services
import { SchemaService } from './modules/schema/services/schema.service';
import { DataService } from './modules/data/services/data.service';
import { TenantService } from './modules/tenant/services/tenant.service';

// Providers
import { SuperTokensCoreProvider } from './modules/auth/providers/supertokens/auth-core.provider';
import { SuperTokensIamProvider } from './modules/auth/providers/supertokens/iam.provider';
import { SuperTokensRbacProvider } from './modules/auth/providers/supertokens/rbac.provider';
import { SuperTokensMfaProvider } from './modules/auth/providers/supertokens/mfa.provider';
import { SuperTokensSession } from './modules/auth/providers/supertokens.session';

// Auth Sub-Services
import { AuthCoreService } from './modules/auth/services/auth-core.service';
import { IamService } from './modules/auth/services/iam.service';
import { RbacService } from './modules/auth/services/rbac.service';
import { MfaService } from './modules/auth/services/mfa.service';

initSuperTokens();

// Provider & Services Init
const authCoreProvider = new SuperTokensCoreProvider();
const iamProvider = new SuperTokensIamProvider();
const rbacProvider = new SuperTokensRbacProvider();
const mfaProvider = new SuperTokensMfaProvider();

const tenantService = new TenantService();
const schemaService = new SchemaService();
const dataService = new DataService();

// Auth Sub-Services Instantiation
const authCoreService = new AuthCoreService(authCoreProvider, iamProvider, rbacProvider, mfaProvider, tenantService);
const iamService = new IamService(iamProvider, authCoreProvider, rbacProvider, mfaProvider, tenantService);
const rbacService = new RbacService(rbacProvider);
const mfaService = new MfaService(mfaProvider, authCoreProvider);

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
      origin: ['http://localhost:5173', 'https://localhost:4000'],
      allowedHeaders: ['content-type', ...SuperTokens.getAllCORSHeaders(), 'x-tenant-id'],
      credentials: true,
    }),
  );

  app.use(middleware());

  app.use(
    '/graphql',
    bodyParser.json({ limit: '15mb' }),
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
        let currentPermissions: string[] = [];

        // RBAC Logic
        if (session && tenantId) {
          const userId = session.getUserId();

          const roleName = await rbacService.getUserRoleInTenant(userId, tenantId);
          if (roleName) {
            currentUserRole = roleName;
            const permissions = await rbacService.getRolePermissions(tenantId, roleName);
            if (permissions) {
              currentPermissions = permissions;
            }
          }
        }

        return {
          req,
          res,
          session,
          authCoreService,
          iamService,
          rbacService,
          mfaService,
          schemaService,
          dataService,
          tenantService,
          tenantId,
          currentUserRole,
          currentPermissions,
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
