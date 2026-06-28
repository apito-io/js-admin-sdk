import type { CrudFilter, CrudSort, ApitoListConnection } from "./types";
import {
  apitoListCountSortInputType,
  apitoListCountWhereInputType,
  apitoSortInputType,
  apitoWhereInputType,
} from "../naming/apitoGraphqlNames";

export type ApitoFilterVariables = {
  where?: Record<string, unknown>;
  whereCount?: Record<string, unknown>;
  sort?: Record<string, unknown>;
  _key?: Record<string, unknown>;
  limit?: number;
  page?: number;
  skip?: number;
  connection?: ApitoListConnection;
};

const SYSTEM_RELATION_FILTER_FIELDS = new Set([
  "system_class_id",
  "system_exam_id",
  "system_student_id",
  "system_teacher_id",
  "system_section_id",
  "system_institute_id",
  "system_tenant_id",
  "system_grade_config_id",
  "system_mark_config_id",
  "system_fee_config_id",
  "system_category_id",
]);

const CONNECTION_PRIORITY = [
  "system_exam_id",
  "system_class_id",
  "system_student_id",
  "system_teacher_id",
  "system_grade_config_id",
  "system_mark_config_id",
  "system_fee_config_id",
] as const;

function isFieldFilter(filter: CrudFilter): boolean {
  return typeof filter.field === "string";
}

function buildConnection(field: string, parentId: string): ApitoListConnection {
  return {
    _id: parentId,
    connection_type: "forward",
    relation_type: "has_many",
  };
}

/** Move system_* relation filters from `where` into GraphQL `connection`. */
export function transformRelationFilters(filters: CrudFilter[] | undefined): {
  filters: CrudFilter[];
  connection?: ApitoListConnection;
} {
  if (!filters?.length) {
    return { filters: [] };
  }

  const relationCandidates: Array<{ field: string; value: string }> = [];
  const kept: CrudFilter[] = [];

  for (const filter of filters) {
    if (
      isFieldFilter(filter) &&
      SYSTEM_RELATION_FILTER_FIELDS.has(filter.field) &&
      filter.value != null &&
      filter.value !== ""
    ) {
      relationCandidates.push({
        field: filter.field,
        value: String(filter.value),
      });
      continue;
    }

    kept.push(filter);
  }

  const chosen = CONNECTION_PRIORITY.map((field) =>
    relationCandidates.find((candidate) => candidate.field === field),
  ).find(Boolean);

  if (!chosen) {
    return { filters: kept };
  }

  return {
    filters: kept,
    connection: buildConnection(chosen.field, chosen.value),
  };
}

export type BuildFilterVariablesOptions = {
  resource: string;
  filters?: CrudFilter[];
  sorters?: CrudSort[];
  pagination?: { current?: number; pageSize?: number };
  /** When true, use ListCount where/sort types (for count-only queries). */
  forCount?: boolean;
};

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
    if (!f.field) continue;
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
