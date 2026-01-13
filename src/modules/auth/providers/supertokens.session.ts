import { SessionContainer } from 'supertokens-node/recipe/session';
import { ISession } from '../interfaces/session.interface';

export class SuperTokensSession implements ISession {
  constructor(private session: SessionContainer) {}

  getUserId(): string {
    return this.session.getUserId();
  }

  getAccessTokenPayload(): any {
    return this.session.getAccessTokenPayload();
  }

  async mergeIntoAccessTokenPayload(payload: any): Promise<void> {
    await this.session.mergeIntoAccessTokenPayload(payload);
  }

  async revoke(): Promise<void> {
    await this.session.revokeSession();
  }
}
