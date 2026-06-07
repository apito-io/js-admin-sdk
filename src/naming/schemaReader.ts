import { apitoGraphQLComposedTypeName } from './apitoGraphqlNames';

export interface ApitoSchemaField {
  name: string;
}

export interface ApitoSchemaModel {
  name: string;
  fields: ApitoSchemaField[];
}

export interface ApitoSchema {
  models: ApitoSchemaModel[];
}

function listFieldToModelName(listFieldName: string): string {
  if (listFieldName.endsWith('List')) {
    const camel = listFieldName.slice(0, -4);
    return camel.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
  }
  return listFieldName;
}

function findCreatePayloadType(
  types: Array<{ name?: string }>,
  modelName: string
): string | null {
  const expected = apitoGraphQLComposedTypeName(modelName, 'Create_Payload');
  for (const t of types) {
    if (t.name === expected) return expected;
  }
  return null;
}

function fieldsFromInputType(
  types: Array<{ name?: string; inputFields?: Array<{ name: string }> }>,
  typeName: string
): ApitoSchemaField[] {
  const typeDef = types.find((t) => t.name === typeName);
  const inputFields = typeDef?.inputFields ?? [];
  const fields = inputFields
    .filter((f) => !f.name.startsWith('_'))
    .map((f) => ({ name: f.name }));
  return fields.length > 0 ? fields : [{ name: 'id' }];
}

export function parseIntrospection(
  introspection: Record<string, unknown>,
  modelFilter?: string[]
): ApitoSchema {
  const schema = (introspection as { data?: { __schema?: Record<string, unknown> } }).data
    ?.__schema;
  if (!schema) {
    throw new Error('Invalid introspection JSON');
  }

  const types = (schema.types as Array<Record<string, unknown>>) ?? [];
  const queryTypeBlock = (schema.queryType as Record<string, unknown>) ?? {};
  const queryFields = (queryTypeBlock.fields as Array<{ name: string }>) ?? [];

  const listFields = queryFields.filter(
    (f) => f.name.endsWith('List') && !f.name.endsWith('ListCount')
  );

  const models: ApitoSchemaModel[] = [];
  for (const listField of listFields) {
    const modelName = listFieldToModelName(listField.name);
    if (modelFilter?.length && !modelFilter.includes(modelName)) continue;

    const createPayload = findCreatePayloadType(types as Array<{ name?: string }>, modelName);
    const fields = createPayload
      ? fieldsFromInputType(
          types as Array<{ name?: string; inputFields?: Array<{ name: string }> }>,
          createPayload
        )
      : [{ name: 'id' }];

    models.push({ name: modelName, fields });
  }

  models.sort((a, b) => a.name.localeCompare(b.name));
  return { models };
}

/** Minimal SDL from introspection types (OBJECT + INPUT_OBJECT + ENUM). */
export function introspectionToSdl(introspection: Record<string, unknown>): string {
  const schema = (introspection as { data?: { __schema?: { types?: Array<Record<string, unknown>> } } })
    .data?.__schema;
  if (!schema?.types) return '# empty schema\n';

  const lines: string[] = ['# AUTO-GENERATED — DO NOT EDIT', ''];
  for (const t of schema.types) {
    const kind = t.kind as string;
    const name = t.name as string;
    if (!name || name.startsWith('__')) continue;
    if (kind === 'OBJECT') {
      const fields = (t.fields as Array<{ name: string; type?: Record<string, unknown> }>) ?? [];
      lines.push(`type ${name} {`);
      for (const f of fields) {
        lines.push(`  ${f.name}: ${unwrapTypeName(f.type)}`);
      }
      lines.push('}', '');
    } else if (kind === 'INPUT_OBJECT') {
      const fields = (t.inputFields as Array<{ name: string; type?: Record<string, unknown> }>) ?? [];
      lines.push(`input ${name} {`);
      for (const f of fields) {
        lines.push(`  ${f.name}: ${unwrapTypeName(f.type)}`);
      }
      lines.push('}', '');
    } else if (kind === 'ENUM') {
      const values = (t.enumValues as Array<{ name: string }>) ?? [];
      lines.push(`enum ${name} {`);
      for (const v of values) lines.push(`  ${v.name}`);
      lines.push('}', '');
    } else if (kind === 'SCALAR') {
      lines.push(`scalar ${name}`, '');
    }
  }
  return lines.join('\n');
}

function unwrapTypeName(type?: Record<string, unknown>): string {
  if (!type) return 'String';
  const kind = type.kind as string;
  if (kind === 'NON_NULL') return `${unwrapTypeName(type.ofType as Record<string, unknown>)}!`;
  if (kind === 'LIST') return `[${unwrapTypeName(type.ofType as Record<string, unknown>)}]`;
  return (type.name as string) ?? 'String';
}
