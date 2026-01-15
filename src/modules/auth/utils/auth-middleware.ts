import { GraphQLError } from 'graphql';
import { MyContext } from '../../../context';

type ResolverFn = (parent: any, args: any, context: MyContext, info: any) => any;

interface ProtectOptions {
  requireMfaVerification?: boolean;
  allowMfaSetup?: boolean;
  allowPasswordChange?: boolean;
}

const GLOBAL_MFA_ENFORCED = false;

export const protect = (
  resolver: ResolverFn,
  options: ProtectOptions = { requireMfaVerification: true, allowMfaSetup: false, allowPasswordChange: false },
): ResolverFn => {
  return async (parent, args, context, info) => {
    if (!context.session) {
      throw new GraphQLError('Unauthenticated. Please log in.', {
        extensions: {
          code: 'UNAUTHENTICATED',
          http: { status: 401 },
        },
      });
    }

    const payload = context.session.getAccessTokenPayload();

    // Check for password change requirement
    const requiresPasswordChange = payload.requiresPasswordChange === true;

    if (requiresPasswordChange && !options.allowPasswordChange) {
      throw new GraphQLError('Password change required. Please update your password.', {
        extensions: { code: 'PASSWORD_CHANGE_REQUIRED', http: { status: 403 } },
      });
    }

    // Check for MFA enforcement and verification
    const mfaEnforced = payload.mfaEnforced === true || GLOBAL_MFA_ENFORCED;
    const hasMfaDevice = payload.mfaEnabled === true;
    const isMfaVerified = payload.mfaVerified === true;

    if (mfaEnforced && !hasMfaDevice) {
      if (!options.allowMfaSetup) {
        throw new GraphQLError('MFA setup is mandatory. Please set up a TOTP device first.', {
          extensions: { code: 'MFA_SETUP_REQUIRED', http: { status: 403 } },
        });
      }
    } else if (hasMfaDevice && !isMfaVerified) {
      if (options.requireMfaVerification) {
        throw new GraphQLError('MFA verification required. Please verify your code.', {
          extensions: { code: 'MFA_VERIFY_REQUIRED', http: { status: 403 } },
        });
      }
    }

    return resolver(parent, args, context, info);
  };
};
