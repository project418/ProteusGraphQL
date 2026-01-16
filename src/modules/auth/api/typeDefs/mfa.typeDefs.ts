const typeDefs = `#graphql
  # ---------------------------------------------------------
  # --- MFA Types
  # ---------------------------------------------------------
  type TotpDeviceResponse {
    deviceName: String!
    secret: String!
    qrCode: String!
  }

  type TotpVerifyResponse {
    verified: Boolean!
    accessToken: String
    refreshToken: String
  }

  type RegisteredDevice {
    name: String!
    verified: Boolean!
  }

  # ---------------------------------------------------------
  # --- Extensions
  # ---------------------------------------------------------
  extend type AuthQueries {
    # -- MFA Management
    listTotpDevices: [RegisteredDevice]
  }

  extend type AuthMutations {
    # -- MFA Operations
    createTotpDevice(deviceName: String!): TotpDeviceResponse
    verifyTotpDevice(deviceName: String!, totp: String!): TotpVerifyResponse
    verifyMfa(totp: String!): TotpVerifyResponse
    removeTotpDevice(deviceName: String!): Boolean
  }
`;

export default typeDefs;