import { Request, Response } from 'express';
import { ISession } from './modules/auth/interfaces/session.interface';
import { SchemaService } from './modules/schema/services/schema.service';
import { DataService } from './modules/data/services/data.service';
import { TenantService } from './modules/tenant/services/tenant.service';

import { AuthCoreService } from './modules/auth/services/auth-core.service';
import { IamService } from './modules/auth/services/iam.service';
import { RbacService } from './modules/auth/services/rbac.service';
import { MfaService } from './modules/auth/services/mfa.service';

export interface MyContext {
  req: Request;
  res: Response;
  session?: ISession;

  authCoreService: AuthCoreService;
  iamService: IamService;
  rbacService: RbacService;
  mfaService: MfaService;

  schemaService: SchemaService;
  dataService: DataService;
  tenantService: TenantService;

  tenantId?: string;
  currentUserRole?: string;
  currentPermissions?: string[];
}
