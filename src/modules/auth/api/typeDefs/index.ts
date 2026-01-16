import { mergeTypeDefs } from '@graphql-tools/merge';
import coreTypeDefs from './core.typeDefs';
import iamTypeDefs from './iam.typeDefs';
import rbacTypeDefs from './rbac.typeDefs';
import mfaTypeDefs from './mfa.typeDefs';

const typeDefs = mergeTypeDefs([
  coreTypeDefs,
  iamTypeDefs,
  rbacTypeDefs,
  mfaTypeDefs
]);

export default typeDefs;