export interface ISession {
  getUserId(): string;
  getAccessTokenPayload(): any;
  getAccessToken(): Promise<string>;
  mergeIntoAccessTokenPayload(payload: any): Promise<void>;
  revoke(): Promise<void>;
}
