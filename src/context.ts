import { Request, Response } from 'express';
import { ISession } from './modules/auth/interfaces/session.interface';
import { RolePolicy } from './modules/auth/interfaces/rbac.types';
import { AuthService } from './modules/auth/services/auth.service';
import { SchemaService } from './modules/schema/services/schema.service';
import { DataService } from './modules/data/services/data.service';
import { TenantService } from './modules/tenant/services/tenant.service';

export interface MyContext {
  req: Request;
  res: Response;
  session?: ISession;
  authService: AuthService;
  schemaService: SchemaService;
  dataService: DataService;
  tenantService: TenantService;
  tenantId?: string;
  currentUserRole?: string;
  currentPermissions?: RolePolicy['permissions'];
}
