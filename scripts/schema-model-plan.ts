import {
  apitoGraphQLComposedTypeName,
  apitoSingularGraphQLTypeName,
} from '../src/naming/apitoGraphqlNames';
import { boundedRelationSelections } from './relation-policy';

export const defaultCodegenUiPackage = '@apito-io/js-admin-ui-antd';

export type PlannedModel = {
  name: string;
  fields: string[];
  supportsConnection?: boolean;
  connectionFields?: Record<string, string>;
};

export type PlannedCodegenConfig = {
  schema: string;
  uiPackage?: string;
  models: PlannedModel[];
};

export type SchemaModelPlanOptions = {
  schemaPath: string;
  models?: string[];
  includeRelations?: boolean;
  uiPackage?: string;
};

type TypeRef = {
  kind?: string;
  name?: string | null;
  ofType?: TypeRef | null;
};

type IntroField = {
  name: string;
  args?: Array<{ name: string }>;
  type?: TypeRef;
};

type IntroType = {
  name?: string;
  fields?: IntroField[] | null;
  inputFields?: Array<{ name: string }> | null;
};

function schemaTypes(raw: unknown): { queryFields: IntroField[]; types: IntroType[] } {
  if (!raw || typeof raw !== 'object') {
    throw new Error('published schema introspection is empty');
  }
  const root = raw as {
    data?: { __schema?: { queryType?: { name?: string; fields?: IntroField[] }; types?: IntroType[] } };
    __schema?: { queryType?: { name?: string; fields?: IntroField[] }; types?: IntroType[] };
  };
  const schema = root.data?.__schema ?? root.__schema;
  if (!schema?.types?.length) {
    throw new Error('published schema introspection did not contain a schema');
  }
  const byName = new Map(schema.types.filter((t) => t.name).map((t) => [t.name as string, t]));
  const inline = schema.queryType?.fields;
  if (inline?.length) {
    return { queryFields: inline, types: schema.types };
  }
  const queryName = schema.queryType?.name || 'Query';
  const queryType = byName.get(queryName);
  return { queryFields: queryType?.fields ?? [], types: schema.types };
}

function snakeFromListField(listFieldName: string): string {
  const camel = listFieldName.slice(0, -'List'.length);
  return camel.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

function snakeFromRawModel(typeName: string): string {
  return typeName
    .slice(0, -'_Raw_Model'.length)
    .split('_')
    .filter(Boolean)
    .map((part) => part.toLowerCase())
    .join('_');
}

function singularQueryName(model: string): string {
  return model
    .split('_')
    .filter(Boolean)
    .map((part, index) => (index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('');
}

function unwrap(type: TypeRef | null | undefined): TypeRef {
  let current = type;
  while (current?.ofType) current = current.ofType;
  return current ?? {};
}

function selectFields(
  byName: Map<string, IntroType>,
  typeName: string,
  depth = 0,
  seen: ReadonlySet<string> = new Set(),
): string[] {
  if (depth > 4 || seen.has(typeName)) return [];
  const typeDef = byName.get(typeName);
  if (!typeDef?.fields?.length) return [];
  const nextSeen = new Set(seen);
  nextSeen.add(typeName);
  const out: string[] = [];
  for (const field of typeDef.fields) {
    if (field.name === '__typename') continue;
    const named = unwrap(field.type);
    if (named.kind === 'SCALAR' || named.kind === 'ENUM') {
      out.push(field.name);
    } else if (named.kind === 'OBJECT' && named.name) {
      const nested = selectFields(byName, named.name, depth + 1, nextSeen);
      out.push(nested.length ? `${field.name} { ${nested.join(' ')} }` : field.name);
    }
  }
  return out;
}

function liveFieldNames(byName: Map<string, IntroType>, model: string): Set<string> | null {
  const typeName = apitoSingularGraphQLTypeName(model);
  const typeDef = byName.get(typeName);
  if (!typeDef?.fields?.length) return null;
  return new Set(typeDef.fields.map((field) => field.name));
}

function connectionFieldsFor(
  byName: Map<string, IntroType>,
  model: string,
): Record<string, string> | undefined {
  const policy = boundedRelationSelections[model];
  if (!policy) return undefined;
  const live = liveFieldNames(byName, model);
  if (!live) return undefined;
  const next: Record<string, string> = {};
  for (const [key, selection] of Object.entries(policy)) {
    if (!live.has(key) || !selection.trim()) continue;
    next[key] = selection;
  }
  return Object.keys(next).length ? next : undefined;
}

export function buildCodegenConfigFromSchema(
  raw: unknown,
  options: SchemaModelPlanOptions,
): PlannedCodegenConfig {
  const schemaPath = options.schemaPath?.trim();
  if (!schemaPath) {
    throw new Error('a published schema path is required');
  }
  const { queryFields, types } = schemaTypes(raw);
  const byName = new Map(types.filter((t) => t.name).map((t) => [t.name as string, t]));
  const requested = (options.models ?? []).map((name) => name.trim()).filter(Boolean);
  const includeRelations = options.includeRelations !== false;
  const models: PlannedModel[] = [];
  const seen = new Set<string>();

  for (const field of queryFields) {
    if (!field.name.endsWith('List') || field.name.endsWith('ListCount')) continue;
    const name = snakeFromListField(field.name);
    if (!name || seen.has(name)) continue;
    if (requested.length && !requested.includes(name)) continue;
    seen.add(name);

    const rawName = apitoGraphQLComposedTypeName(name, 'Raw_Model');
    const fields = selectFields(byName, rawName);
    if (!fields.length) {
      continue;
    }
    const planned: PlannedModel = {
      name,
      fields,
      supportsConnection: (field.args ?? []).some((arg) => arg.name === 'relation'),
    };
    if (includeRelations) {
      const connections = connectionFieldsFor(byName, name);
      if (connections) planned.connectionFields = connections;
    }
    models.push(planned);
  }

  for (const typeDef of types) {
    if (!typeDef.name?.endsWith('_Raw_Model')) continue;
    const name = snakeFromRawModel(typeDef.name);
    if (!name || seen.has(name)) continue;
    const singular = singularQueryName(name);
    const hasQuery = queryFields.some((field) => field.name === singular || field.name === `${singular}List`);
    if (!hasQuery) continue;
    if (requested.length && !requested.includes(name)) continue;
    const fields = selectFields(byName, typeDef.name);
    if (!fields.length) continue;
    seen.add(name);
    const planned: PlannedModel = { name, fields, supportsConnection: false };
    if (includeRelations) {
      const connections = connectionFieldsFor(byName, name);
      if (connections) planned.connectionFields = connections;
    }
    models.push(planned);
  }

  models.sort((a, b) => a.name.localeCompare(b.name));
  if (requested.length) {
    const found = new Set(models.map((model) => model.name));
    const missing = requested.filter((name) => !found.has(name));
    if (missing.length) {
      throw new Error(`published schema has no model: ${missing.join(', ')}`);
    }
  }
  if (!models.length) {
    throw new Error('published schema did not contain any models');
  }

  return {
    schema: schemaPath,
    uiPackage: options.uiPackage?.trim() || defaultCodegenUiPackage,
    models,
  };
}
