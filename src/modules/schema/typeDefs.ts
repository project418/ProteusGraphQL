const typeDefs = `#graphql
  scalar JSON

  enum DataType {
    DATA_TYPE_UNSPECIFIED
    DATA_TYPE_TEXT
    DATA_TYPE_NUMBER
    DATA_TYPE_BOOLEAN
    DATA_TYPE_RELATION
  }

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

  # --- Responses ---
  type DeleteResponse {
    success: Boolean!
    message: String
  }

  type EntitiesResponse {
    entities: [Entity]
  }

  # --- Queries ---
  type Query {
    entities: EntitiesResponse
    entity(id: ID!): Entity
    field(id: ID!): Field
  }

  # --- Mutations ---
  type Mutation {
    createEntity(display_name: String!, system_name: String): Entity
    updateEntity(id: ID!, display_name: String!): Entity
    deleteEntity(id: ID!): DeleteResponse

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
`;

export default typeDefs;