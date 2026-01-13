import { dataClient } from '../../../clients/proteus.client';
import { structToJson } from '../../../utils/struct-helper';
import { grpcCall } from '../../../utils/grpc-helper';
import { MyContext } from '../../../context';
import { sanitizeRecord, sanitizeRecords } from '../../auth/utils/rbac-helper';

export class DataService {
  // --- Helpers ---
  private mapRecord(record: any) {
    if (!record) return null;
    return {
      ...record,
      data: structToJson(record.data),
    };
  }

  // --- Queries ---

  async getRecord(entityId: string, recordId: string, context: MyContext) {
    const args = { entity_id: entityId, record_id: recordId };
    const res = await grpcCall(dataClient, 'GetRecord', args, context);
    const mapped = this.mapRecord(res);

    return sanitizeRecord(mapped, entityId, context);
  }

  async queryRecords(entityId: string, filters: any[], sort: any, pagination: any, context: MyContext) {
    const args = { entity_id: entityId, filters, sort, pagination };
    const res: any = await grpcCall(dataClient, 'Query', args, context);
    const mappedList = res.data ? res.data.map((r: any) => this.mapRecord(r)) : [];

    return {
      ...res,
      data: sanitizeRecords(mappedList, entityId, context),
    };
  }

  // --- Mutations ---

  async createRecord(entityId: string, data: any, context: MyContext) {
    const args = { entity_id: entityId, data };
    const res = await grpcCall(dataClient, 'CreateRecord', args, context);
    const mapped = this.mapRecord(res);

    return sanitizeRecord(mapped, entityId, context);
  }

  async updateRecord(entityId: string, recordId: string, data: any, context: MyContext) {
    const args = { entity_id: entityId, record_id: recordId, data };
    const res = await grpcCall(dataClient, 'UpdateRecord', args, context);
    const mapped = this.mapRecord(res);

    return sanitizeRecord(mapped, entityId, context);
  }

  async deleteRecord(entityId: string, recordId: string, context: MyContext) {
    const args = { entity_id: entityId, record_id: recordId };
    return await grpcCall(dataClient, 'DeleteRecord', args, context);
  }
}
