import type { ApitoRelationCrudFilter, CrudFilter } from "./types";

/** GraphQL `relation` arg on `*List` / `*ListCount`. */
export type ApitoListRelationFilter = Record<string, Record<string, unknown>>;

export function isRelationCrudFilter(
  filter: CrudFilter,
): filter is ApitoRelationCrudFilter {
  return (
    "relation" in filter &&
    typeof filter.relation === "string" &&
    filter.relation.trim().length > 0
  );
}

/** List filter: scope rows by related document id (`relation: { class: { _id: { eq } } }`). */
export function relationEqFilter(
  relation: string,
  id: string,
): ApitoRelationCrudFilter {
  return {
    relation: relation.trim(),
    operator: "eq",
    value: id.trim(),
  };
}

export function buildListRelationFilter(
  relationGraphQLName: string,
  parentId: string,
): ApitoListRelationFilter {
  return {
    [relationGraphQLName]: { _id: { eq: parentId } },
  };
}

export function mergeListRelationFilters(
  ...parts: ApitoListRelationFilter[]
): ApitoListRelationFilter {
  return Object.assign({}, ...parts);
}

/**
 * Split Refine-style filters into `where` field filters and GraphQL list `relation`.
 *
 * Use {@link relationEqFilter} for has_one / has_many / many_to_many scoping:
 * `relationEqFilter("class", classId)` → `relation: { class: { _id: { eq: classId } } }`
 *
 * Do **not** use `connection` for this — that is a separate parent-document scope API.
 */
export function transformRelationFilters(filters: CrudFilter[] | undefined): {
  filters: CrudFilter[];
  relation?: ApitoListRelationFilter;
} {
  if (!filters?.length) {
    return { filters: [] };
  }

  const kept: CrudFilter[] = [];
  const relationParts: ApitoListRelationFilter[] = [];

  for (const filter of filters) {
    if (isRelationCrudFilter(filter) && filter.value) {
      relationParts.push(
        buildListRelationFilter(filter.relation, String(filter.value)),
      );
      continue;
    }
    kept.push(filter);
  }

  return {
    filters: kept,
    relation: relationParts.length
      ? mergeListRelationFilters(...relationParts)
      : undefined,
  };
}
