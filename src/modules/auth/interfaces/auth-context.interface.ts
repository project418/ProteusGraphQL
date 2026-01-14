import { ISession } from './session.interface';

export interface IAuthContext {
  session?: ISession;
  tenantId?: string;
}
