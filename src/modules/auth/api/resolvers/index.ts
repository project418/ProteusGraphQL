import { mergeResolvers } from '@graphql-tools/merge';
import coreResolvers from './core.resolvers';
import iamResolvers from './iam.resolvers';
import rbacResolvers from './rbac.resolvers';
import mfaResolvers from './mfa.resolvers';

const resolvers = {
  Query: {
    auth: () => ({}),
  },
  Mutation: {
    auth: () => ({}),
  },
};

const mergedResolvers = mergeResolvers([
  resolvers,
  coreResolvers,
  iamResolvers,
  rbacResolvers,
  mfaResolvers
]);

export default mergedResolvers;