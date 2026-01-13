import * as grpc from '@grpc/grpc-js';
import { Request, Response } from 'express';
import { RolePolicy } from '../modules/auth/interfaces/rbac.interface';
import { ISession } from '../modules/auth/interfaces/session.interface';
import { AuthService } from '../modules/auth/services/auth.service';

export interface MyContext {
  session?: ISession;
  authService: AuthService;
  tenantId?: string;
  currentUserRole?: string;
  currentPermissions?: RolePolicy['permissions'];
  req: Request;
  res: Response;
}

export const grpcCall = <T>(
  client: any,
  methodName: string,
  request: any,
  context: MyContext,
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
