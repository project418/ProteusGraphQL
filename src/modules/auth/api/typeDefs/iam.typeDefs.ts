const typeDefs = `#graphql
  # ---------------------------------------------------------
  # --- IAM Types & Inputs
  # ---------------------------------------------------------
  type UpdateUserResponse {
    user: User!
    accessToken: String
    refreshToken: String
  }

  type TenantUsersResponse {
    users: [User]
    nextPaginationToken: String
  }

  input UpdateUserInput {
    email: String
    password: String
    currentPassword: String
    firstName: String
    lastName: String
    title: String
    phone: String
    countryCode: String
    timezone: String
    language: String
    avatar: String
  }

  # ---------------------------------------------------------
  # --- Extensions
  # ---------------------------------------------------------
  extend type AuthQueries {
    # -- User Management
    tenantUsers(limit: Int, paginationToken: String): TenantUsersResponse
  }

  extend type AuthMutations {
    # -- Self Service
    updateMe(input: UpdateUserInput!): UpdateUserResponse

    # -- Tenant Management
    createOwnTenant(name: String!): Tenant
    updateTenant(name: String!): Tenant

    # -- User Management
    inviteUser(email: String!, roleName: String!): Boolean
    acceptInvite(token: String!): Boolean
    assignRole(userId: String!, roleName: String!): Boolean
    removeUserFromTenant(userId: String!): Boolean
  }
`;

export default typeDefs;
