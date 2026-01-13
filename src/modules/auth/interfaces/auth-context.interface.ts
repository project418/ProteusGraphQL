import { Request, Response } from 'express';
import { ISession } from './session.interface';

export interface IAuthContext {
  req: Request;
  res: Response;
  session?: ISession;
  tenantId?: string;
}
