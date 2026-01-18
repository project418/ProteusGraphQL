import { tenantClient } from '../../../clients/proteus.client';
import { grpcCall } from '../../../utils/grpc-helper';
import { MyContext } from '../../../context';

export class TenantService {
  // --- Helper: Mapped Tenant ---

  private mapTenant(tenant: any) {
    if (!tenant) return null;
    return {
      id: tenant.id,
      name: tenant.name,
      createdAt: tenant.created_at,
      updatedAt: tenant.updated_at,
    };
  }

  // --- Mutations ---

  async createTenant(name: string, context?: MyContext) {
    const res: any = await grpcCall(tenantClient, 'CreateTenant', { name }, context || ({} as MyContext));
    return this.mapTenant(res);
  }

  async updateTenant(id: string, name: string, context: MyContext) {
    const res: any = await grpcCall(tenantClient, 'UpdateTenant', { id, name }, context);
    return this.mapTenant(res);
  }

  async deleteTenant(id: string, context: MyContext) {
    return await grpcCall(tenantClient, 'DeleteTenant', { id }, context);
  }

  // --- Queries ---

  async getTenant(id: string, context: MyContext) {
    const res: any = await grpcCall(tenantClient, 'GetTenant', { id }, context);
    return this.mapTenant(res);
  }

  async listTenants(context: MyContext) {
    const res: any = await grpcCall(tenantClient, 'ListTenants', {}, context);

    const tenants = res.tenants ? res.tenants.map((t: any) => this.mapTenant(t)) : [];
    return {
      tenants,
    };
  }
}
