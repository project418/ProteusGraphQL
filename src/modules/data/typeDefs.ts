const typeDefs = `#graphql
  # ---------------------------------------------------------
  # --- Output Types
  # ---------------------------------------------------------
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

  # ---------------------------------------------------------
  # --- Input Types
  # ---------------------------------------------------------
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

  # ---------------------------------------------------------
  # --- Nested Data Types (Namespace)
  # ---------------------------------------------------------
  type DataQueries {
    getRecord(entity_id: String!, record_id: String!): Record
    
    queryRecords(
      entity_id: String!
      filters: [FilterInput]
      sort: SortInput
      pagination: PaginationInput
    ): QueryResponse
  }

  type DataMutations {
    createRecord(entity_id: String!, data: JSON!): Record
    
    updateRecord(
      entity_id: String!
      record_id: String!
      data: JSON!
    ): Record
    
    deleteRecord(entity_id: String!, record_id: String!): DeleteResponse
  }

  # ---------------------------------------------------------
  # --- Root Extensions
  # ---------------------------------------------------------
  extend type Query {
    data: DataQueries
  }

  extend type Mutation {
    data: DataMutations
  }
`;

export default typeDefs;