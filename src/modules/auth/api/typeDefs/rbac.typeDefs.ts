const typeDefs = `#graphql
  type RoleDefinition {
    name: String!
    permissions: [String]
  }

  extend type AuthQueries {
    listRoles: [RoleDefinition]
    getRolePermissions(roleName: String!): [String]
  }

  extend type AuthMutations {
    createRole(roleName: String!, permissions: [String]!): Boolean
    updateRole(roleName: String!, permissions: [String]!): Boolean
    deleteRole(roleName: String!): Boolean
  }
`;

export default typeDefs;
