import { schemaClient } from '../../../clients/proteus.client';
import { structToJson } from '../../../utils/struct-helper';
import { grpcCall } from '../../../utils/grpc-helper';
import { MyContext } from '../../../context';

export class SchemaService {
  
  // --- Helpers ---
  private mapEntity(entity: any) {
    if (!entity) return null;
    const cleanFields = entity.fields ? entity.fields.map((f: any) => this.mapField(f)) : [];
    return { ...entity, fields: cleanFields };
  }

  private mapField(field: any) {
    if (!field) return null;
    return {
      ...field,
      ui_config: structToJson(field.ui_config),
      validation: structToJson(field.validation)
    };
  }

  // --- Queries ---

  async listEntities(context: MyContext) {
    const res: any = await grpcCall(schemaClient, 'ListEntities', {}, context);
    return {
      entities: res.entities.map((e: any) => this.mapEntity(e))
    };
  }

  async getEntity(id: string, context: MyContext) {
    const res = await grpcCall(schemaClient, 'GetEntity', { id }, context);
    return this.mapEntity(res);
  }

  async getField(id: string, context: MyContext) {
    const res = await grpcCall(schemaClient, 'GetField', { id }, context);
    return this.mapField(res);
  }

  // --- Mutations ---

  // -- Entity Operations
  async createEntity(data: { display_name: string; system_name?: string }, context: MyContext) {
    const res = await grpcCall(schemaClient, 'CreateEntity', data, context);
    return this.mapEntity(res);
  }

  async updateEntity(data: { id: string; display_name: string }, context: MyContext) {
    const res = await grpcCall(schemaClient, 'UpdateEntity', data, context);
    return this.mapEntity(res);
  }

  async deleteEntity(id: string, context: MyContext) {
    return await grpcCall(schemaClient, 'DeleteEntity', { id }, context);
  }

  // -- Field Operations
  async createField(data: any, context: MyContext) {
    const res = await grpcCall(schemaClient, 'CreateField', data, context);
    return this.mapField(res);
  }

  async updateField(data: any, context: MyContext) {
    const res = await grpcCall(schemaClient, 'UpdateField', data, context);
    return this.mapField(res);
  }

  async deleteField(id: string, context: MyContext) {
    return await grpcCall(schemaClient, 'DeleteField', { id }, context);
  }
}