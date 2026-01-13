import * as grpc from '@grpc/grpc-js';
import { MyContext } from '../context';

export const grpcCall = <T>(client: any, methodName: string, request: any, context: MyContext): Promise<T> => {
  return new Promise((resolve, reject) => {
    const metadata = new grpc.Metadata();

    if (context.tenantId) {
      metadata.add('x-tenant-id', context.tenantId);
    }

    if (context.session) {
      metadata.add('x-user-id', context.session.getUserId());
    }

    const method = client[methodName];
    if (!method) {
      return reject(new Error(`Method ${methodName} gRPC client does not exist.`));
    }

    method.bind(client)(request, metadata, (err: any, response: T) => {
      if (err) {
        console.error(`gRPC Error [${methodName}]:`, err);
        reject(err);
      } else {
        resolve(response);
      }
    });
  });
};
