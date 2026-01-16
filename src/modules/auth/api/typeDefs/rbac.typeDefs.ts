const typeDefs = `#graphql
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
  # --- Extensions
  # ---------------------------------------------------------
  extend type AuthQueries {
    # -- Policy Management
    listPolicies: [RoleDefinition]
    getPolicy(roleName: String!): RolePolicy
  }

  extend type AuthMutations {
    # -- Policy Management
    createPolicy(roleName: String!, policy: JSON!): Boolean
    deletePolicy(roleName: String!): Boolean
  }
`;

export default typeDefs;