import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';

const PROTO_PATH = path.resolve(__dirname, './protos/user.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const userProto = grpc.loadPackageDefinition(packageDefinition) as any;

// --- Mock Veri Mantığı ---
const usersDB = [
  { id: '1', name: 'Ahmet Yılmaz', email: 'ahmet@ornek.com' },
  { id: '2', name: 'Ayşe Demir', email: 'ayse@ornek.com' },
];

function getUser(call: any, callback: any) {
  const requestedId = call.request.id;
  const user = usersDB.find((u) => u.id === requestedId);

  if (user) {
    // Başarılı cevap (null hata, user veri)
    callback(null, user);
  } else {
    // Hata cevabı (gRPC Status Code: NOT_FOUND)
    callback({
      code: grpc.status.NOT_FOUND,
      details: 'Kullanıcı bulunamadı',
    });
  }
}

// --- Sunucuyu Başlatma ---
function main() {
  const server = new grpc.Server();

  // Servis tanımını ve fonksiyonunu eşleştiriyoruz
  server.addService(userProto.userpackage.UserService.service, {
    GetUser: getUser,
  });

  server.bindAsync(
    '0.0.0.0:50051',
    grpc.ServerCredentials.createInsecure(),
    (error, port) => {
      if (error) {
        console.error(error);
        return;
      }
      console.log(`🏁 Mock gRPC Sunucusu çalışıyor: 0.0.0.0:${port}`);
    }
  );
}

main();