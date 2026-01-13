import { GraphQLFormattedError } from 'graphql';

export const formatError = (
  formattedError: GraphQLFormattedError,
  error: unknown,
): GraphQLFormattedError => {
  console.error('🔥 GraphQL Error:', error);

  if (formattedError.extensions?.code) {
    return formattedError;
  }

  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message.includes('14 UNAVAILABLE')
  ) {
    return {
      message: 'Service is currently unavailable, please try again later.',
      extensions: { code: 'SERVICE_UNAVAILABLE' },
    };
  }

  return {
    message: formattedError.message || 'An unexpected error occurred.',
    extensions: {
      code: 'INTERNAL_SERVER_ERROR',
      stacktrace:
        process.env.NODE_ENV === 'production' ? undefined : formattedError.extensions?.stacktrace,
    },
  };
};
