import { TotpDevice } from '../auth.entities';
import { MfaVerificationResult } from '../auth.dtos';

export interface IMfaProvider {
  createTotpDevice(userId: string, deviceName: string): Promise<TotpDevice>;
  verifyTotpDevice(userId: string, deviceName: string, code: string): Promise<MfaVerificationResult>;
  verifyMfaCode(userId: string, code: string): Promise<MfaVerificationResult>;
  removeTotpDevice(userId: string, deviceName: string): Promise<void>;
  listTotpDevices(userId: string): Promise<{ name: string, verified: boolean }[]>;
}