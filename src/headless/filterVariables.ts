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

export type { ApitoListRelationFilter } from "./listRelationFilters";
export {
  buildListRelationFilter,
  isRelationCrudFilter,
  listRelationFilterKey,
  mergeListRelationFilters,
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
  _key?: Record<string, unknown>;
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

function buildWhereFromFilters(
  filters: CrudFilter[],
): Record<string, unknown> | undefined {
  if (!filters.length) return undefined;
  const and: Record<string, unknown>[] = [];
  for (const f of filters) {
    if (!("field" in f) || !f.field) continue;
    const op = mapOperator(f.operator);
    and.push({ [f.field]: { [op]: f.value } });
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
    sort[s.field] = s.order === "desc" ? "desc" : "asc";
  }
  return sort;
}

/** Build GraphQL list variables from Refine-style filters/sorters/pagination. */
export function buildApitoFilterVariables(
  options: BuildFilterVariablesOptions,
): ApitoFilterVariables {
  const { filters = [], sorters = [], pagination, forCount } = options;
  const where = buildWhereFromFilters(filters);
  const sort = buildSortFromSorters(sorters);
  const pageSize = pagination?.pageSize ?? 10;
  const current = pagination?.current ?? 1;

  const vars: ApitoFilterVariables = {};
  if (where) vars.where = where;
  if (forCount && where) vars.whereCount = where;
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
