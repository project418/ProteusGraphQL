import * as grpc from '@grpc/grpc-js';
import { SessionContainer } from "supertokens-node/recipe/session";
import { Request, Response } from 'express';

export interface MyContext {
  session?: SessionContainer;
  tenantId?: string;
  req: Request;
  res: Response;
}

export const grpcCall = <T>(
  client: any,
  methodName: string,
  request: any,
  context: MyContext
): Promise<T> => {
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
        return reject(new Error(`Method ${methodName} gRPC istemcisinde bulunamadı.`));
    }

    method.bind(client)(request, metadata, (err: any, response: T) => {
      if (err) {
        console.error(`gRPC Hatası [${methodName}]:`, err);
        reject(err);
      } else {
        resolve(response);
      }
    });
  });
};