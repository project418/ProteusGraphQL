import { GraphQLError } from 'graphql';
import { MyContext } from './grpc-helper';

type ResolverFn = (parent: any, args: any, context: MyContext, info: any) => any;

export const protect = (resolver: ResolverFn): ResolverFn => {
  return async (parent, args, context, info) => {
    if (!context.session) {
      throw new GraphQLError('Unauthenticated. Please log in.', {
        extensions: {
          code: 'UNAUTHENTICATED',
          http: { status: 401 },
        },
      });
    }

    return resolver(parent, args, context, info);
  };
};