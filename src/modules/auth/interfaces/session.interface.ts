export interface ISession {
  getUserId(): string;
  getAccessTokenPayload(): any;
  mergeIntoAccessTokenPayload(payload: any): Promise<void>;
  revoke(): Promise<void>;
}
