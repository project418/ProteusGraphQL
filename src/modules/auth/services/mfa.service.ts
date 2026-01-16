import { IMfaProvider } from '../interfaces/providers/mfa.provider.interface';
import { IAuthCoreProvider } from '../interfaces/providers/auth-core.provider.interface'
import { TotpDevice } from '../interfaces/auth.entities';
import { MfaVerificationResult } from '../interfaces/auth.dtos';
import { IAuthContext } from '../interfaces/auth-context.interface';

export class MfaService {
  constructor(
    private provider: IMfaProvider,
    private coreProvider: IAuthCoreProvider
  ) {}

  async createTotpDevice(userId: string, deviceName: string): Promise<TotpDevice> {
    return await this.provider.createTotpDevice(userId, deviceName);
  }

  async verifyTotpDevice(
    userId: string,
    deviceName: string,
    totp: string,
    context: IAuthContext,
  ): Promise<MfaVerificationResult> {
    const result = await this.provider.verifyTotpDevice(userId, deviceName, totp);

    if (result.verified && context.session) {
      // Elevate session trust: Mark MFA as verified in the session
      const currentPayload = context.session.getAccessTokenPayload();
      const newPayload = {
        ...currentPayload,
        mfaEnabled: true,
        mfaVerified: true,
      };

      const sessionResult = await this.coreProvider.createNewSession(userId, newPayload);
      await context.session.revoke();

      return {
        verified: true,
        accessToken: sessionResult.tokens.accessToken,
        refreshToken: sessionResult.tokens.refreshToken,
      };
    }
    return result;
  }

  async verifyMfa(userId: string, totp: string, context: IAuthContext): Promise<MfaVerificationResult> {
    const result = await this.provider.verifyMfaCode(userId, totp);

    if (result.verified && context.session) {
      // Elevate session trust
      const currentPayload = context.session.getAccessTokenPayload();
      const newPayload = {
        ...currentPayload,
        mfaVerified: true,
      };

      const sessionResult = await this.coreProvider.createNewSession(userId, newPayload);
      await context.session.revoke();

      return {
        verified: true,
        accessToken: sessionResult.tokens.accessToken,
        refreshToken: sessionResult.tokens.refreshToken,
      };
    }
    return result;
  }

  async removeTotpDevice(userId: string, deviceName: string, context: IAuthContext): Promise<boolean> {
    await this.provider.removeTotpDevice(userId, deviceName);

    const devices = await this.provider.listTotpDevices(userId);
    const hasRemaining = devices.length > 0;

    if (context.session) {
      await context.session.mergeIntoAccessTokenPayload({
        mfaEnabled: hasRemaining,
        mfaVerified: hasRemaining,
      });
    }
    return true;
  }

  async listTotpDevices(userId: string): Promise<{ name: string, verified: boolean }[]> {
    return await this.provider.listTotpDevices(userId);
  }
}