import Totp from 'supertokens-node/recipe/totp';
import Session from 'supertokens-node/recipe/session';
import SuperTokens from 'supertokens-node';
import { GraphQLError } from 'graphql';

import { IMfaProvider } from '../../interfaces/providers/mfa.provider.interface';
import { TotpDevice } from '../../interfaces/auth.entities';
import { MfaVerificationResult } from '../../interfaces/auth.dtos';

export class SuperTokensMfaProvider implements IMfaProvider {
  async createTotpDevice(userId: string, deviceName: string): Promise<TotpDevice> {
    const response = await Totp.createDevice(userId, undefined, deviceName);

    if (response.status === 'DEVICE_ALREADY_EXISTS_ERROR') {
      throw new GraphQLError('Device name already exists.', { extensions: { code: 'BAD_REQUEST' } });
    }
    if (response.status === 'UNKNOWN_USER_ID_ERROR') {
      throw new GraphQLError('User not found.', { extensions: { code: 'UNAUTHENTICATED' } });
    }

    return {
      deviceName: response.deviceName,
      secret: response.secret,
      qrCode: response.qrCodeString,
    };
  }

  async verifyTotpDevice(userId: string, deviceName: string, code: string): Promise<MfaVerificationResult> {
    const response = await Totp.verifyDevice('public', userId, deviceName, code);

    if (response.status === 'UNKNOWN_DEVICE_ERROR') throw new GraphQLError('Device not found.');
    if (response.status === 'INVALID_TOTP_ERROR') throw new GraphQLError('Invalid TOTP code.');

    return { verified: true };
  }

  async verifyMfaCode(userId: string, code: string): Promise<MfaVerificationResult> {
    const response = await Totp.verifyTOTP('public', userId, code);

    if (response.status === 'UNKNOWN_USER_ID_ERROR') throw new GraphQLError('User not found.');
    if (response.status === 'INVALID_TOTP_ERROR') throw new GraphQLError('Invalid TOTP code.');

    return { verified: true };
  }

  async removeTotpDevice(userId: string, deviceName: string): Promise<void> {
    await Totp.removeDevice(userId, deviceName);
  }

  async listTotpDevices(userId: string): Promise<{ name: string; verified: boolean }[]> {
    const res = await Totp.listDevices(userId);

    return res.devices.map((device: any) => ({
      name: device.name,
      verified: device.verified ?? false,
    }));
  }
}
