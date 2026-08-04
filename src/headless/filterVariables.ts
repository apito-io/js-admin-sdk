import type { CrudFilter, CrudSort } from "./types";
import type { ApitoListConnection } from "./types";
import type { ApitoListRelationFilter } from "./listRelationFilters";
import {
  apitoListCountSortInputType,
  apitoListCountWhereInputType,
  apitoSortInputType,
  apitoWhereInputType,
} from "../naming/apitoGraphqlNames";
import { transformRelationFilters } from "./listRelationFilters";

export type { CrudLogicalCrudFilter } from "./types";

export function isLogicalCrudFilter(
  filter: CrudFilter,
): filter is import("./types").CrudLogicalCrudFilter {
  return (
    "operator" in filter &&
    (filter.operator === "or" || filter.operator === "and") &&
    Array.isArray(filter.value)
  );
}

/** Build a Refine-style OR filter group for Apito GraphQL `where.OR`. */
export function orCrudFilter(
  ...branches: Array<{ field: string; operator: string; value?: unknown }>
): CrudFilter {
  return { operator: "or", value: branches };
}

/** Build a Refine-style AND filter group for Apito GraphQL `where.AND`. */
export function andCrudFilter(
  ...branches: Array<{ field: string; operator: string; value?: unknown }>
): CrudFilter {
  return { operator: "and", value: branches };
}

function buildFieldWhereCondition(
  field: string,
  operator: string,
  value: unknown,
): Record<string, unknown> {
  const op = mapOperator(operator);
  return { [field]: { [op]: value } };
}

function buildLogicalWhereCondition(
  operator: "or" | "and",
  branches: Array<{ field: string; operator: string; value?: unknown }>,
): Record<string, unknown> | undefined {
  const logicalKey = operator.toUpperCase() as "OR" | "AND";
  const logicalObj: Record<string, unknown> = {};
  for (const branch of branches) {
    if (!branch.field) continue;
    Object.assign(
      logicalObj,
      buildFieldWhereCondition(branch.field, branch.operator, branch.value),
    );
  }
  if (!Object.keys(logicalObj).length) return undefined;
  return { [logicalKey]: logicalObj };
}

export type { ApitoListRelationFilter } from "./listRelationFilters";
export {
  buildListRelationFilter,
  isRelationCrudFilter,
  listRelationFilterKey,
  mergeListRelationFilters,
  mergePermanentListFilters,
  relationEqFilter,
  relationEqFilterFromConnection,
  transformRelationFilters,
} from "./listRelationFilters";
export type { ListRelationFilterKeyConnection } from "./listRelationFilters";
export { buildListConnectionScope } from "./listConnectionFilters";

export type ApitoFilterVariables = {
  where?: Record<string, unknown>;
  whereCount?: Record<string, unknown>;
  sort?: Record<string, unknown>;
  /** List root `_key` (TAGLIST_KEY_CONDITION / …). */
  _key?: Record<string, unknown>;
  /** ListCount root `_key` (TAG_LIST_COUNT_KEY_CONDITION / …) — mirrors whereCount. */
  _keyCount?: Record<string, unknown>;
  limit?: number;
  page?: number;
  skip?: number;
  /** GraphQL list `relation` — preferred for has_one / has_many / many_to_many filters. */
  relation?: ApitoListRelationFilter;
  /**
   * GraphQL list `connection` — parent-document scoped lists only.
   * Prefer `relation` via {@link transformRelationFilters}.
   */
  connection?: ApitoListConnection;
};

export type BuildFilterVariablesOptions = {
  resource: string;
  filters?: CrudFilter[];
  sorters?: CrudSort[];
  pagination?: { current?: number; pageSize?: number };
  /** When true, use ListCount where/sort types (for count-only queries). */
  forCount?: boolean;
};

export type BuildListQueryVariablesOptions = {
  resource: string;
  filters?: CrudFilter[];
  sorters?: CrudSort[];
  pagination?: { current?: number; pageSize?: number };
  /** When false, omit GraphQL `relation` even if relation filters are present. */
  supportsRelation?: boolean;
};

/** Build full GraphQL list query variables (where, whereCount, sort, pagination, relation). */
export function buildListQueryVariables(
  options: BuildListQueryVariablesOptions,
): Record<string, unknown> {
  const { filters = [], sorters = [], pagination, supportsRelation = true } =
    options;
  const { filters: resolvedFilters, relation } = transformRelationFilters(filters);
  const base = buildApitoFilterVariables({
    resource: options.resource,
    filters: resolvedFilters,
    sorters,
    pagination,
  });
  const countVars = buildApitoFilterVariables({
    resource: options.resource,
    filters: resolvedFilters,
    sorters,
    pagination,
    forCount: true,
  });
  const vars: Record<string, unknown> = {
    ...base,
    ...(countVars.where ? { whereCount: countVars.where } : {}),
    ...(countVars._key ? { _keyCount: countVars._key } : {}),
  };
  if (supportsRelation !== false && relation) {
    vars.relation = relation;
  }
  return vars;
}

function mapOperator(op: string): string {
  const map: Record<string, string> = {
    eq: "eq",
    ne: "ne",
    lt: "lt",
    gt: "gt",
    lte: "lte",
    gte: "gte",
    in: "in",
    nin: "nin",
    contains: "contains",
    ncontains: "ncontains",
    containss: "containss",
    ncontainss: "ncontainss",
    null: "null",
    nnull: "nnull",
    between: "between",
    nbetween: "nbetween",
    startswith: "startswith",
    endswith: "endswith",
  };
  return map[op] ?? op;
}

/**
 * Document `_key` is a list/count root argument — never a `where` field.
 * Extract Refine-style `{ field: "_key", ... }` filters into a KEY_CONDITION object.
 */
function extractKeyCondition(filters: CrudFilter[]): {
  keyCondition?: Record<string, unknown>;
  remaining: CrudFilter[];
} {
  const remaining: CrudFilter[] = [];
  let keyCondition: Record<string, unknown> | undefined;
  for (const f of filters) {
    if (isLogicalCrudFilter(f)) {
      remaining.push(f);
      continue;
    }
    if (!("field" in f) || !f.field) {
      remaining.push(f);
      continue;
    }
    if (f.field === "_key") {
      const op = mapOperator(f.operator);
      keyCondition = { ...(keyCondition ?? {}), [op]: f.value ?? null };
      continue;
    }
    remaining.push(f);
  }
  return { keyCondition, remaining };
}

function buildWhereFromFilters(
  filters: CrudFilter[],
): Record<string, unknown> | undefined {
  if (!filters.length) return undefined;
  const and: Record<string, unknown>[] = [];
  for (const f of filters) {
    if (isLogicalCrudFilter(f)) {
      const logical = buildLogicalWhereCondition(f.operator, f.value);
      if (logical) and.push(logical);
      continue;
    }
    if (!("field" in f) || !f.field) continue;
    and.push(buildFieldWhereCondition(f.field, f.operator, f.value ?? null));
  }
  if (!and.length) return undefined;
  return Object.assign({}, ...and);
}

function buildSortFromSorters(
  sorters: CrudSort[],
): Record<string, unknown> | undefined {
  if (!sorters.length) return undefined;
  const sort: Record<string, unknown> = {};
  for (const s of sorters) {
    // Public GraphQL SORT_ENUM is ASC | DESC (uppercase).
    sort[s.field] = s.order === "desc" ? "DESC" : "ASC";
  }
  return sort;
}

/** Build GraphQL list variables from Refine-style filters/sorters/pagination. */
export function buildApitoFilterVariables(
  options: BuildFilterVariablesOptions,
): ApitoFilterVariables {
  const { filters = [], sorters = [], pagination, forCount } = options;
  const { keyCondition, remaining } = extractKeyCondition(filters);
  const where = buildWhereFromFilters(remaining);
  const sort = buildSortFromSorters(sorters);
  const pageSize = pagination?.pageSize ?? 10;
  const current = pagination?.current ?? 1;

  const vars: ApitoFilterVariables = {};
  if (where) vars.where = where;
  if (forCount && where) vars.whereCount = where;
  if (keyCondition) vars._key = keyCondition;
  if (sort) vars.sort = sort;
  if (!forCount) {
    vars.limit = pageSize;
    vars.page = current;
  }
  return vars;
}

export function apitoWhereTypeName(resource: string, forCount = false): string {
  return forCount
    ? apitoListCountWhereInputType(resource)
    : apitoWhereInputType(resource);
}

export function apitoSortTypeName(resource: string, forCount = false): string {
  return forCount
    ? apitoListCountSortInputType(resource)
    : apitoSortInputType(resource);
}
