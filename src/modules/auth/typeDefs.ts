const typeDefs = `#graphql
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

  type AuthResponse {
    user: User
    tenant: Tenant
    availableTenants: [Tenant]
    accessToken: String!
    refreshToken: String!
  }

  type RefreshResponse {
    accessToken: String!
    refreshToken: String!
  }

  extend type Mutation {
    login(email: String!, password: String!): AuthResponse
    register(email: String!, password: String!): AuthResponse
    refreshToken(refreshToken: String!): RefreshResponse
    
    createOwnTenant(name: String!): Tenant
    switchTenant(tenantId: String!): AuthResponse
  }
`;

export default typeDefs;