const typeDefs = `#graphql
  # ---------------------------------------------------------
  # --- Core Entities
  # ---------------------------------------------------------
  type User {
    id: ID!
    email: String!
    timeJoined: Float
    firstName: String
    lastName: String
    title: String
    phone: String
    countryCode: String
    timezone: String
    language: String
    avatar: String
    role: String
  }

  type Tenant {
    id: ID!
    name: String!
    created_at: String
    updated_at: String
  }

  # ---------------------------------------------------------
  # --- Auth Responses
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

  # ---------------------------------------------------------
  # --- Auth Queries & Mutations (Core)
  # ---------------------------------------------------------
  type AuthQueries {
    # -- Self Service
    me: User
    myPermissions: JSON
    myTenants: [Tenant]
  }

  type AuthMutations {
    # -- Authentication
    login(email: String!, password: String!): AuthResponse
    register(email: String!, password: String!, firstName: String!, lastName: String!): AuthResponse
    refreshToken(refreshToken: String!): RefreshResponse
    logout: Boolean

    # -- Password Reset
    sendPasswordResetEmail(email: String!): Boolean
    resetPassword(token: String!, password: String!): Boolean
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