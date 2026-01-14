const typeDefs = `#graphql
  # ---------------------------------------------------------
  # --- Core Entities
  # ---------------------------------------------------------
  type User {
    id: ID!
    email: String!
    timeJoined: Float
  }

  type Tenant {
    id: ID!
    name: String!
    created_at: String
    updated_at: String
  }

  # ---------------------------------------------------------
  # --- Auth & Response Types
  # ---------------------------------------------------------
  type AuthResponse {
    user: User
    tenant: Tenant
    availableTenants: [Tenant]
    accessToken: String!
    refreshToken: String!
    permissions: JSON
    requiresPasswordChange: Boolean
    requiresMfa: Boolean
    mfaEnforced: Boolean
    mfaEnabled: Boolean
  }

  type RefreshResponse {
    accessToken: String!
    refreshToken: String!
  }

  type TenantUsersResponse {
    users: [User]
    nextPaginationToken: String
  }

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

  # ---------------------------------------------------------
  # --- Policy / RBAC Types
  # ---------------------------------------------------------
  type RolePolicy {
    description: String
    mfa_required: Boolean
    permissions: JSON
  }

  type RoleDefinition {
    name: String!
    policy: RolePolicy
  }

  # ---------------------------------------------------------
  # --- MFA Types
  # ---------------------------------------------------------
  type RegisteredDevice {
    name: String!
    verified: Boolean!
  }

  # ---------------------------------------------------------
  # --- Inputs
  # ---------------------------------------------------------
  input UpdateUserInput {
    email: String
    password: String
  }

  # ---------------------------------------------------------
  # --- Nested Auth Types (Namespace)
  # ---------------------------------------------------------
  type AuthQueries {
    # -- Self Service
    me: User
    myPermissions: JSON

    # -- User Management
    tenantUsers(limit: Int, paginationToken: String): TenantUsersResponse

    # -- Policy Management
    listPolicies: [RoleDefinition]
    getPolicy(roleName: String!): RolePolicy

    # -- MFA Management
    listTotpDevices: [RegisteredDevice]
  }

  type AuthMutations {
    # -- Authentication
    login(email: String!, password: String!): AuthResponse
    register(email: String!, password: String!): AuthResponse
    refreshToken(refreshToken: String!): RefreshResponse
    logout: Boolean

    createTotpDevice(deviceName: String!): TotpDeviceResponse
    verifyTotpDevice(deviceName: String!, totp: String!): TotpVerifyResponse
    verifyMfa(totp: String!): TotpVerifyResponse
    removeTotpDevice(deviceName: String!): Boolean

    # -- Password Reset
    sendPasswordResetEmail(email: String!): Boolean
    resetPassword(token: String!, password: String!): Boolean
    
    # -- Tenant Management
    createOwnTenant(name: String!): Tenant
    
    
    # -- Self Service
    updateMe(input: UpdateUserInput!): User

    # -- User Management
    inviteUser(email: String!, roleName: String!): Boolean
    acceptInvite(token: String!): Boolean
    assignRole(userId: String!, roleName: String!): Boolean
    removeUserFromTenant(userId: String!): Boolean
    updateUser(userId: String!, input: UpdateUserInput!): User

    # -- Policy Management
    createPolicy(roleName: String!, policy: JSON!): Boolean
    deletePolicy(roleName: String!): Boolean
  }

  # ---------------------------------------------------------
  # --- Root Extensions
  # ---------------------------------------------------------
  extend type Query {
    auth: AuthQueries
  }

  extend type Mutation {
    auth: AuthMutations
  }
`;

export default typeDefs;
