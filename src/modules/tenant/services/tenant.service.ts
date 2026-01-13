import { tenantClient } from '../../../clients/proteus.client';
import { grpcCall } from '../../../utils/grpc-helper';
import { MyContext } from '../../../context';

export class TenantService {
  
  // --- Mutations ---
  
  async createTenant(name: string, context?: MyContext) {
    return await grpcCall(tenantClient, 'CreateTenant', { name }, context || ({} as MyContext));
  }

  async updateTenant(id: string, name: string, context: MyContext) {
    return await grpcCall(tenantClient, 'UpdateTenant', { id, name }, context);
  }

  async deleteTenant(id: string, context: MyContext) {
    return await grpcCall(tenantClient, 'DeleteTenant', { id }, context);
  }

  // --- Queries ---

  async getTenant(id: string, context: MyContext) {
    return await grpcCall(tenantClient, 'GetTenant', { id }, context);
  }

  async listTenants(context: MyContext) {
    return await grpcCall(tenantClient, 'ListTenants', {}, context);
  }
}