import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';

const PROTO_PATH = path.resolve(__dirname, '../protos/proteus.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
  includeDirs: [path.join(__dirname, '../../node_modules/google-proto-files')] 
});

const grpcObject = grpc.loadPackageDefinition(packageDefinition) as any;
const proteusPackage = grpcObject.proteus.v1;

const CREDENTIALS = grpc.credentials.createInsecure();
const ADDRESS = process.env.GRPC_URL || 'localhost:50051';

export const schemaClient = new proteusPackage.SchemaService(ADDRESS, CREDENTIALS);
export const dataClient = new proteusPackage.DataService(ADDRESS, CREDENTIALS);
export const eventClient = new proteusPackage.EventService(ADDRESS, CREDENTIALS);
export const tenantClient = new proteusPackage.TenantService(ADDRESS, CREDENTIALS);