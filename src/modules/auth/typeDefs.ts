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
  }

  type RefreshResponse {
    accessToken: String!
    refreshToken: String!
  }

  type TenantUsersResponse {
    users: [User]
    nextPaginationToken: String
  }

  # ---------------------------------------------------------
  # --- Policy / RBAC Types
  # ---------------------------------------------------------
  type RolePolicy {
    description: String
    permissions: JSON
  }

  type RoleDefinition {
    name: String!
    policy: RolePolicy
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
  }

  type AuthMutations {
    # -- Authentication
    login(email: String!, password: String!): AuthResponse
    register(email: String!, password: String!): AuthResponse
    refreshToken(refreshToken: String!): RefreshResponse
    
    # -- Tenant Management
    createOwnTenant(name: String!): Tenant
    
    # -- Self Service
    updateMe(input: UpdateUserInput!): User

    # -- User Management
    inviteUser(email: String!, roleName: String!): Boolean
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