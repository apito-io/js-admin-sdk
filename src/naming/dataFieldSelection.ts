import type { ApitoSchemaField, ApitoSchemaModel } from './schemaReader';

/** GraphQL selection lines for model `data { ... }` from schema field metadata. */
export function resolveModelDataFields(model: ApitoSchemaModel): string[] {
  return model.fields.map((f) => f.name);
}

export function resolveModelDataFieldNames(model: ApitoSchemaModel): string[] {
  return model.fields.map((f) => f.name);
}
