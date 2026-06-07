/**
 * Apito model naming aligned with `open-core/utility/apito_naming.go`.
 * Store canonical model ids as snake_case (e.g. `food_order`); derive GraphQL names with pure string ops.
 */

import { singularize } from 'inflection';

const singularKeepAsIs = new Set([
  'news',
  'data',
  'media',
  'analytics',
  'series',
  'species',
]);

const canonicalIDRe = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;

/** Same boundary rule as Go `rejectRunOnLowercaseConcat` (len >= 9, all a-z). */
function rejectRunOnLowercaseConcat(raw: string): void {
  if (/[\s_\-]/.test(raw)) return;
  if (/[a-z][A-Z]/.test(raw)) return;
  if (!/^[a-z]+$/.test(raw)) return;
  if (raw.length >= 9) {
    throw new Error(
      'model name needs a word boundary between words: use food_order, food-order, foodOrder, or "food order"'
    );
  }
}

function splitCamelPieces(piece: string): string[] {
  const spaced = piece.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return spaced
    .split(/\s+/)
    .filter(Boolean)
    .map((s) => s.replace(/[^a-zA-Z0-9]/g, '').toLowerCase())
    .filter(Boolean);
}

function splitIntoWordSegments(raw: string): string[] {
  const normalized = raw.trim().replace(/-/g, '_');
  const chunks = normalized.split(/[\s_]+/).filter((c) => c.length > 0);
  const segments: string[] = [];
  for (const chunk of chunks) {
    const lettersOnly = chunk.replace(/[^a-zA-Z0-9]/g, '');
    const pieces =
      lettersOnly === chunk ? splitCamelPieces(chunk) : [lettersOnly.toLowerCase()];
    for (const p of pieces) {
      const s = p.replace(/[^a-z0-9]/gi, '').toLowerCase();
      if (s) segments.push(s);
    }
  }
  return segments;
}

function singularizeSegment(seg: string): string {
  if (singularKeepAsIs.has(seg)) return seg;
  return singularize(seg);
}

/**
 * Normalizes admin input to canonical snake_case singular model id (matches Go `CanonicalizeModelName`).
 */
export function canonicalizeModelName(raw: string): string {
  const t = raw.trim();
  if (!t) throw new Error('model name is required');
  rejectRunOnLowercaseConcat(t);
  const segments = splitIntoWordSegments(t);
  if (segments.length === 0) throw new Error('invalid model name');
  segments[segments.length - 1] = singularizeSegment(
    segments[segments.length - 1]!
  );
  const out = segments.join('_');
  if (!canonicalIDRe.test(out)) throw new Error('invalid model name');
  reservedCheck(out);
  return out;
}

function reservedCheck(canonical: string): void {
  switch (canonical) {
    case 'list':
      throw new Error(
        'naming a Model `List` is not allowed. Apito uses List for plural resources.'
      );
    case 'user':
      throw new Error(
        'naming a Model `User` is protected. Add the Authentication module from Settings.'
      );
    case 'system':
      throw new Error('naming a Model `System` is not allowed.');
    case 'function':
      throw new Error('naming a Model `Function` is not allowed.');
  }
}

/** lowerCamel from canonical snake (`food_order` → `foodOrder`). */
export function camelFromCanonical(canonical: string): string {
  const parts = canonical.split('_').filter(Boolean);
  return parts
    .map((p, i) =>
      i === 0
        ? p.toLowerCase()
        : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()
    )
    .join('');
}

/** PascalCase without underscores (`food_order` → `FoodOrder`). */
export function pascalFromCanonical(canonical: string): string {
  return canonical
    .split('_')
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join('');
}

/** Legacy camel id → Pascal (`foodCategory` → `FoodCategory`). */
export function pascalFromAnyModelId(modelId: string): string {
  if (!modelId) return '';
  if (modelId.includes('_')) return pascalFromCanonical(modelId);
  const segs = splitCamelPieces(modelId);
  return segs
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join('');
}

export function listGraphQLTypeName(modelId: string): string {
  return `${pascalFromAnyModelId(apitoSingularResourceName(modelId))}List`;
}

/** Matches Go `GraphQLComposedTypeName` (e.g. `Create_Payload`, `List_Upsert_Payload`). */
export function apitoGraphQLComposedTypeName(modelId: string, suffix: string): string {
  const singular = apitoSingularResourceName(modelId);
  const suf = suffix.replace(/^_/, '').split('_').filter(Boolean);
  const modelSegs = singular.includes('_')
    ? singular.split('_').filter(Boolean)
    : splitCamelPieces(singular).map((s) => s.toLowerCase());
  const extra = suf.flatMap((chunk) =>
    splitCamelPieces(chunk).map((x) => x.toLowerCase())
  );
  const all = [...modelSegs, ...extra];
  return all
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join('_');
}

/**
 * lowerCamel field id for GraphQL root fields — matches Go `utility.SingularResourceName`:
 * trim `List` / `ListCount`, then camel-case the remainder (`CamelFromAny`), **without**
 * English plural→singular inflection (that diverged from the engine and broke variable types).
 */
export function apitoSingularResourceName(name: string): string {
  let t = name.trim();
  if (t.endsWith('ListCount')) t = t.slice(0, -'ListCount'.length);
  else if (t.endsWith('List')) t = t.slice(0, -'List'.length);
  t = t.trim();
  if (!t) return '';
  if (t.includes('_')) {
    return camelFromCanonical(t);
  }
  const segs = splitCamelPieces(t);
  if (segs.length === 0) return t.toLowerCase();
  return segs
    .map((s, i) =>
      i === 0
        ? s.toLowerCase()
        : s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
    )
    .join('');
}

export const apitoModelName = apitoSingularResourceName;

export function apitoMultipleResourceName(name: string): string {
  return `${apitoSingularResourceName(name)}List`;
}

/**
 * Public GraphQL field name for a **relation** on list/getOne rows (matches engine `attachConnectionFields`):
 * - **has_many** → `{singular}List` (e.g. model `food` → `foodList`), **not** `food`.
 * - **has_one** → lowerCamel singular (e.g. `customer`, `foodCategory`).
 *
 * Use this for `meta.connectionFields` **keys** so the generated selection matches the schema.
 */
export function apitoConnectionFieldNameForRelation(
  relatedModelRef: string,
  relation: 'has_one' | 'has_many'
): string {
  if (relation === 'has_many') {
    return apitoMultipleResourceName(relatedModelRef);
  }
  return apitoSingularResourceName(relatedModelRef);
}

/**
 * Maps `meta.connectionFields` / `aliasFields` keys and targets to engine GraphQL field names.
 * Unlike {@link apitoSingularResourceName} alone, this does **not** strip a trailing `List` from
 * connection field ids such as **`foodList`** (that strip is for list *operation* names like `foodOrderList` → `foodOrder`).
 */
export function apitoGraphqlConnectionFieldFromMetaKey(key: string): string {
  const k = key.trim();
  if (!k) return k;
  if (k.includes('_')) {
    return apitoSingularResourceName(k);
  }
  if (/List$/i.test(k) && !/ListCount$/i.test(k)) {
    return k.charAt(0).toLowerCase() + k.slice(1);
  }
  return apitoSingularResourceName(k);
}

export function apitoGraphQLTypeNameForFilterArg(modelId: string): string {
  return listGraphQLTypeName(modelId);
}

export function apitoListGraphQLTypeName(resource: string): string {
  return listGraphQLTypeName(resource);
}

export function apitoListCountGraphQLTypeName(resource: string): string {
  return apitoGraphQLComposedTypeName(resource, 'List_Count');
}

export function apitoSingularGraphQLTypeName(resource: string): string {
  return pascalFromAnyModelId(apitoSingularResourceName(resource));
}

/**
 * Stored model id as snake_case (matches engine `Connection.Model` / filter `definedModel.Name`).
 * Use this when building mutation `connect` / `disconnect` keys: `{storedId}_id` / `{storedId}_ids`.
 */
export function apitoStoredSnakeModelId(resource: string): string {
  const singular = apitoSingularResourceName(resource);
  if (singular.includes('_')) return singular;
  return splitCamelPieces(singular).join('_');
}

/** `connect` / `disconnect` field for a has_one relation: `{stored_model_id}_id` (e.g. `food_category_id`). */
export function apitoMutationConnectHasOneIdField(relatedModelRef: string): string {
  return `${apitoStoredSnakeModelId(relatedModelRef)}_id`;
}

/** `connect` / `disconnect` field for a has_many relation: `{stored_model_id}_ids`. */
export function apitoMutationConnectHasManyIdsField(
  relatedModelRef: string
): string {
  return `${apitoStoredSnakeModelId(relatedModelRef)}_ids`;
}

export function apitoConnectionFilterConditionType(resource: string): string {
  return `${apitoStoredSnakeModelId(resource)}_Connection_Filter_Condition`.toUpperCase();
}

export function apitoWhereRelationFilterConditionType(resource: string): string {
  return `${apitoStoredSnakeModelId(resource)}_Where_Relation_Filter_Condition`.toUpperCase();
}

/**
 * List query `where` / sort / `_key` payload types for `*List` fields (e.g. `FOODORDERLIST_INPUT_WHERE_PAYLOAD`).
 * Do **not** use this for `*ListCount` — use {@link apitoListCountWhereInputType} / {@link apitoListCountSortInputType}.
 */
export function apitoWhereInputType(resource: string): string {
  return `${listGraphQLTypeName(resource)}_Input_Where_Payload`.toUpperCase();
}

export function apitoSortInputType(resource: string): string {
  return `${listGraphQLTypeName(resource)}_Input_Sort_Payload`.toUpperCase();
}

export function apitoListKeyConditionType(resource: string): string {
  return `${listGraphQLTypeName(resource)}_Key_Condition`.toUpperCase();
}

export function apitoListCountKeyConditionType(resource: string): string {
  return `${apitoGraphQLComposedTypeName(resource, 'List_Count')}_Key_Condition`.toUpperCase();
}

/**
 * `*ListCount` query `where` argument type (e.g. `FOOD_ORDER_LIST_COUNT_INPUT_WHERE_PAYLOAD`).
 * This is **not** `FoodOrderList` + `_Count_*` (wrong: `FOODORDERLIST_COUNT_*`); the engine uses
 * {@link apitoGraphQLComposedTypeName} with suffix `List_Count` (underscores between word segments).
 */
export function apitoListCountWhereInputType(resource: string): string {
  return `${apitoGraphQLComposedTypeName(resource, 'List_Count')}_Input_Where_Payload`.toUpperCase();
}

/** `*ListCount` query `sort` argument type (e.g. `FOOD_ORDER_LIST_COUNT_INPUT_SORT_PAYLOAD`). */
export function apitoListCountSortInputType(resource: string): string {
  return `${apitoGraphQLComposedTypeName(resource, 'List_Count')}_Input_Sort_Payload`.toUpperCase();
}

/**
 * Builds nested relation field lines for list/getOne GraphQL selection sets.
 * Normalizes stored snake_case ids and legacy names to the same lowerCamel field names as the Apito engine
 * (`apitoSingularResourceName`), so `aliasFields: { foodCategory: "food_category" }` still resolves to `foodCategory`.
 *
 * - `connectionFields` keys are the **client/response key** when `aliasFields` is set; otherwise the key is
 *   normalized to the schema field name.
 * - `aliasFields[key]` when present is the **schema field name** (may be legacy `food_category`); it is normalized.
 * - **has_many** relations use **`{model}List`** on the parent type (e.g. `foodList`), not the singular `food`.
 *   Use {@link apitoConnectionFieldNameForRelation}(..., `'has_many'`) or {@link apitoMultipleResourceName} for keys.
 *   Keys like `foodList` are preserved (see {@link apitoGraphqlConnectionFieldFromMetaKey}).
 */
export function formatApitoConnectionSubselections(
  connectionFields: Record<string, string>,
  aliasFields: Record<string, string> = {}
): string {
  return Object.keys(connectionFields)
    .map((key) => {
      const selection = connectionFields[key];
      const rawTarget = aliasFields[key];
      const hasExplicitAlias =
        rawTarget !== undefined &&
        rawTarget !== null &&
        String(rawTarget).trim() !== '';

      const targetField = apitoGraphqlConnectionFieldFromMetaKey(
        hasExplicitAlias ? String(rawTarget).trim() : key
      );

      if (hasExplicitAlias) {
        const responseKey = key;
        if (responseKey === targetField) {
          return `${targetField} { ${selection} }`;
        }
        return `${responseKey}: ${targetField} { ${selection} }`;
      }

      return `${targetField} { ${selection} }`;
    })
    .join('\n');
}

export function buildApitoCreateMutation(
  resource: string,
  fields: string[]
): string {
  const id = apitoSingularResourceName(resource);
  const pascal = pascalFromAnyModelId(id);
  const payload = apitoGraphQLComposedTypeName(id, 'Create_Payload');
  const rel = apitoGraphQLComposedTypeName(id, 'Relation_Connect_Payload');
  return `                  mutation Create${pascal}($payload: ${payload}!, $connect: ${rel}) {
                      create${pascal}(payload: $payload, connect: $connect, status: published) {
                          id
                          data {
                              ${fields.join('\n')}
                          }
                          meta {
                              created_at
                              status
                              updated_at
                          }
                      }
                  }`;
}
