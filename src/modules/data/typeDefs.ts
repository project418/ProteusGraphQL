const typeDefs = `#graphql
  # --- Output Types ---
  type Record {
    id: ID!
    data: JSON
  }

  type QueryResponse {
    data: [Record]
    total_count: Int
    page: Int
    limit: Int
  }

  type DeleteResponse {
    success: Boolean
    message: String
  }

  # --- Input Types ---
  input FilterInput {
    field: String!
    operator: String!
    value: JSON
  }

  input SortInput {
    field: String!
    desc: Boolean
  }

  input PaginationInput {
    page: Int
    limit: Int
  }

  # --- Extensions ---
  extend type Query {
    getRecord(entity_id: String!, record_id: String!): Record
    queryRecords(
      entity_id: String!
      filters: [FilterInput]
      sort: SortInput
      pagination: PaginationInput
    ): QueryResponse
  }

  extend type Mutation {
    createRecord(entity_id: String!, data: JSON!): Record
    updateRecord(
      entity_id: String!
      record_id: String!
      data: JSON!
    ): Record
    deleteRecord(entity_id: String!, record_id: String!): DeleteResponse
  }
`;

export default typeDefs;