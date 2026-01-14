import SuperTokens from 'supertokens-node';
import Session from 'supertokens-node/recipe/session';
import EmailPassword from 'supertokens-node/recipe/emailpassword';
import Dashboard from 'supertokens-node/recipe/dashboard';
import UserMetadata from 'supertokens-node/recipe/usermetadata';
import MultiFactorAuth from 'supertokens-node/recipe/multifactorauth';
import Totp from 'supertokens-node/recipe/totp';
import Multitenancy from 'supertokens-node/recipe/multitenancy';

export const initSuperTokens = () => {
  SuperTokens.init({
    framework: 'express',
    supertokens: {
      connectionURI: process.env.SUPERTOKENS_CONNECTION_URI || 'http://localhost:3567',
    },
    appInfo: {
      appName: 'ProteusApp',
      apiDomain: 'http://localhost:4000',
      websiteDomain: 'http://localhost:5173',
      apiBasePath: '/auth',
      websiteBasePath: '/auth',
    },
    recipeList: [
      EmailPassword.init(),
      Session.init(),
      Dashboard.init(),
      UserMetadata.init(),
      MultiFactorAuth.init(),
      Totp.init(),
      Multitenancy.init(),
    ],
  });
};
