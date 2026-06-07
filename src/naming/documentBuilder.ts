import {
  apitoConnectionFilterConditionType,
  apitoGraphQLComposedTypeName,
  apitoListCountWhereInputType,
  apitoListGraphQLTypeName,
  apitoMultipleResourceName,
  apitoSingularGraphQLTypeName,
  apitoSingularResourceName,
  apitoSortInputType,
  apitoWhereInputType,
  pascalFromAnyModelId,
} from './apitoGraphqlNames';

/** Builds GraphQL operation strings (aligned with flutter_admin_sdk DocumentBuilder). */
export class DocumentBuilder {
  constructor(private readonly model: string) {}

  private get listField() {
    return apitoMultipleResourceName(this.model);
  }
  private get countField() {
    return `${this.listField}Count`;
  }
  private get singularField() {
    return apitoSingularResourceName(this.model);
  }
  private get listPascal() {
    return apitoListGraphQLTypeName(this.model);
  }
  private get singularPascal() {
    return apitoSingularGraphQLTypeName(this.model);
  }

  buildListQuery(fields: string[]): string {
    const vars = [
      `$connection: ${apitoConnectionFilterConditionType(this.model)}`,
      `$where: ${apitoWhereInputType(this.model)}`,
      `$whereCount: ${apitoListCountWhereInputType(this.model)}`,
      `$sort: ${apitoSortInputType(this.model)}`,
      `$page: Int`,
      `$limit: Int`,
    ].join('\n    ');

    return `query Get${this.listPascal}(
    ${vars}
) {
  ${this.listField}(connection: $connection, where: $where, sort: $sort, page: $page, limit: $limit) {
    id
    data {
      ${fields.join('\n      ')}
    }
    
    meta {
      created_at
      status
      updated_at
    }
  }    ${this.countField}(connection: $connection, where: $whereCount, page: $page, limit: $limit) {
      total
    }
}`;
  }

  buildGetQuery(fields: string[]): string {
    return `query Get${this.singularPascal}($id: String!) {
  ${this.singularField}(_id: $id) {
    id
    data {
      ${fields.join('\n      ')}
    }
    
    meta {
      created_at
      status
      updated_at
    }
  }
}`;
  }

  buildCreateMutation(fields: string[]): string {
    const payload = apitoGraphQLComposedTypeName(this.model, 'Create_Payload');
    const connect = apitoGraphQLComposedTypeName(this.model, 'Relation_Connect_Payload');
    return `mutation Create${this.singularPascal}($payload: ${payload}!, $connect: ${connect}) {
  create${this.singularPascal}(payload: $payload, connect: $connect, status: published) {
    id
    data {
      ${fields.join('\n      ')}
    }
    meta {
      created_at
      status
      updated_at
    }
  }
}`;
  }

  buildUpdateMutation(fields: string[]): string {
    const payload = apitoGraphQLComposedTypeName(this.model, 'Update_Payload');
    const connect = apitoGraphQLComposedTypeName(this.model, 'Relation_Connect_Payload');
    const disconnect = apitoGraphQLComposedTypeName(this.model, 'Relation_Disconnect_Payload');
    return `mutation Update${this.singularPascal}(
    $id: String!,
    $deltaUpdate: Boolean,
    $payload: ${payload}!,
    $connect: ${connect},
    $disconnect: ${disconnect}
) {
  update${this.singularPascal}(_id: $id, deltaUpdate: $deltaUpdate, payload: $payload, connect: $connect, disconnect: $disconnect, status: published) {
    id
    data {
      ${fields.join('\n      ')}
    }
    meta {
      created_at
      status
      updated_at
    }
  }
}`;
  }

  buildDeleteMutation(): string {
    return `mutation Delete${this.singularPascal}($ids: [String]!) {
  delete${this.singularPascal}(_ids: $ids) {
    response
  }
}`;
  }

  generateGraphqlFile(fieldNames: string[]): string {
    const fields = fieldNames.filter((f) => f !== 'id');
    const resolved = fields.length > 0 ? fields : ['id'];
    return [
      '# AUTO-GENERATED — DO NOT EDIT',
      `# Model: ${this.model}`,
      '',
      this.buildListQuery(resolved),
      '',
      this.buildGetQuery(resolved),
      '',
      this.buildCreateMutation(resolved),
      '',
      this.buildUpdateMutation(resolved),
      '',
      this.buildDeleteMutation(),
      '',
    ].join('\n');
  }
}
