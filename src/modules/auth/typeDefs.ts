const typeDefs = `#graphql
  type User {
    id: ID!
    email: String!
    timeJoined: Float
  }

  type AuthResponse {
    user: User
    accessToken: String!
    refreshToken: String!
  }

  type RefreshResponse {
    accessToken: String!
    refreshToken: String!
  }

  extend type Mutation {
    login(email: String!, password: String!): AuthResponse
    register(email: String!, password: String!, tenantName: String!): AuthResponse
    refreshToken(refreshToken: String!): RefreshResponse
  }
`;

export default typeDefs;