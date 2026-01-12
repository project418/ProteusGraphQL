const typeDefs = `#graphql
  # ---------------------------------------------------------
  # --- Scalars & Enums
  # ---------------------------------------------------------
  scalar JSON

  enum DataType {
    DATA_TYPE_UNSPECIFIED
    DATA_TYPE_TEXT
    DATA_TYPE_NUMBER
    DATA_TYPE_BOOLEAN
    DATA_TYPE_RELATION
  }

  # ---------------------------------------------------------
  # --- Core Entities
  # ---------------------------------------------------------
  type Field {
    id: ID!
    display_name: String
    system_name: String
    data_type: DataType
    entity_id: String
    relation_target_id: String
    ui_config: JSON
    validation: JSON
    is_system: Boolean
  }

  type Entity {
    id: ID!
    display_name: String
    system_name: String
    is_system: Boolean
    fields: [Field]
  }

  # ---------------------------------------------------------
  # --- Responses
  # ---------------------------------------------------------
  type DeleteResponse {
    success: Boolean!
    message: String
  }

  type EntitiesResponse {
    entities: [Entity]
  }

  # ---------------------------------------------------------
  # --- Nested Schema Types (Namespace)
  # ---------------------------------------------------------
  type SchemaQueries {
    entities: EntitiesResponse
    entity(id: ID!): Entity
    field(id: ID!): Field
  }

  type SchemaMutations {
    # -- Entity Operations
    createEntity(display_name: String!, system_name: String): Entity
    updateEntity(id: ID!, display_name: String!): Entity
    deleteEntity(id: ID!): DeleteResponse

    # -- Field Operations
    createField(
      entity_id: ID!
      display_name: String!
      system_name: String
      data_type: DataType!
      relation_target_id: String
      ui_config: JSON
      validation: JSON
    ): Field

    updateField(
      id: ID!
      display_name: String
      ui_config: JSON
      validation: JSON
    ): Field
    
    deleteField(id: ID!): DeleteResponse
  }

  # ---------------------------------------------------------
  # --- Root Extensions
  # ---------------------------------------------------------
  extend type Query {
    schema: SchemaQueries
  }

  extend type Mutation {
    schema: SchemaMutations
  }
`;

export default typeDefs;