import { apitoConnectionFieldNameForRelation } from "../naming/apitoGraphqlNames";
import type {
  ApitoListConnection,
  ApitoRelationCrudFilter,
  CrudFilter,
} from "./types";

/** Connection metadata needed to resolve a list `relation` filter key. */
export type ListRelationFilterKeyConnection = Pick<
  ApitoListConnection,
  "known_as" | "to_model" | "model" | "relation_type"
>;

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

/**
 * GraphQL key for `*List(relation: …)` — must match the **output relation field** on each row,
 * not the mutation `connect` key (`{stored_model}_id`).
 *
 * Engine (open-core) builds `*_Where_Relation_Filter_Condition` with the same names as list/getOne
 * relation fields: `known_as` when set (`owner`, `chef`, …), otherwise the public target model name
 * (`foodCategory`, `users`, …). Before that fix the explorer could show `users` while the row field
 * was `owner`; runtime SQL accepted both, but schema and clients should use the output field name.
 * Use this helper when you have connection meta so apps do not guess the target model name.
 */
export function listRelationFilterKey(
  connection: ListRelationFilterKeyConnection,
): string {
  const knownAs = connection.known_as?.trim();
  if (knownAs) return knownAs;

  const targetModel = (connection.to_model ?? connection.model)?.trim();
  if (!targetModel) {
    throw new Error(
      "listRelationFilterKey: connection must include known_as or to_model/model",
    );
  }

  return apitoConnectionFieldNameForRelation(
    targetModel,
    connection.relation_type === "has_many" ? "has_many" : "has_one",
  );
}

/** List filter: scope rows by related document id. */
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

/** {@link relationEqFilter} using {@link listRelationFilterKey} from connection metadata. */
export function relationEqFilterFromConnection(
  connection: ListRelationFilterKeyConnection,
  id: string,
): ApitoRelationCrudFilter {
  return relationEqFilter(listRelationFilterKey(connection), id);
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
 * Merge updated permanent filters into the current list filter state.
 *
 * Permanent filters may be field filters (`field`) or relation filters
 * (`relation` via {@link relationEqFilter}). Previous permanent entries for the
 * same field/relation are replaced; other (search/user) filters are kept.
 *
 * Pass `previousPermanent` when the permanent set changes shape (e.g. field
 * filter → relation filter) so stale permanent entries are still removed.
 */
export function mergePermanentListFilters(
  prev: CrudFilter[],
  nextPermanent: CrudFilter[],
  previousPermanent: CrudFilter[] = [],
): CrudFilter[] {
  const permanentFields = new Set(
    [...previousPermanent, ...nextPermanent]
      .filter((f): f is CrudFilter & { field: string } => "field" in f)
      .map((f) => f.field),
  );
  const permanentRelations = new Set(
    [...previousPermanent, ...nextPermanent]
      .filter(isRelationCrudFilter)
      .map((f) => f.relation.trim()),
  );
  const rest = prev.filter((f) => {
    if (isRelationCrudFilter(f)) {
      return !permanentRelations.has(f.relation.trim());
    }
    if ("field" in f && typeof f.field === "string") {
      return !permanentFields.has(f.field);
    }
    return true;
  });
  return [...nextPermanent, ...rest];
}

/**
 * Split Refine-style filters into `where` field filters and GraphQL list `relation`.
 *
 * Use {@link relationEqFilter} for has_one / has_many / many_to_many scoping.
 * The relation key must match the output relation field name (`known_as` when set,
 * otherwise the public target model name), e.g. `owner` not `users`.
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
