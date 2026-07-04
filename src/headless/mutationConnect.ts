import {
  apitoMutationConnectHasManyIdsField,
  apitoMutationConnectHasOneIdField,
} from "../naming/apitoGraphqlNames";
import type { ListRelationFilterKeyConnection } from "./listRelationFilters";

/**
 * Mutation `connect` / `disconnect` values are **plain document id strings** (or string
 * arrays for has_many), e.g. `{ owner_id: "01USER" }` — not `{ owner_id: { id: "01USER" } }`.
 *
 * Keys use `known_as` + `_id` / `_ids` when set (`owner_id` for alias `owner`), otherwise
 * stored target model id (`class_id`, `users_id`). List `relation` filters use the output
 * field name without `_id` — see {@link listRelationFilterKey}.
 */
export function normalizeApitoRelationConnectValue(
  value: unknown,
): string | string[] | undefined {
  if (value == null || value === "") return undefined;

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }

  if (Array.isArray(value)) {
    const ids = value
      .map((item) => normalizeApitoRelationConnectValue(item))
      .filter((item): item is string => typeof item === "string" && item.length > 0);
    return ids.length > 0 ? ids : undefined;
  }

  if (typeof value === "object" && value !== null && "id" in value) {
    const nestedId = (value as { id: unknown }).id;
    if (typeof nestedId === "string") {
      const trimmed = nestedId.trim();
      return trimmed === "" ? undefined : trimmed;
    }
  }

  return undefined;
}

/** Normalize connect/disconnect maps before mutations (flat ids, drop empty keys). */
export function normalizeApitoRelationConnectMap(
  values?: Record<string, unknown>,
): Record<string, string | string[]> | undefined {
  if (!values || typeof values !== "object") return undefined;

  const next: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(values)) {
    const normalized = normalizeApitoRelationConnectValue(value);
    if (normalized != null) next[key] = normalized;
  }

  return Object.keys(next).length > 0 ? next : undefined;
}

/** Mutation connect key for has_one — `owner_id` when `known_as` is `owner`, else `class_id`, etc. */
export function mutationConnectHasOneKey(
  connection: ListRelationFilterKeyConnection,
): string {
  const knownAs = connection.known_as?.trim();
  if (knownAs) return `${knownAs}_id`;

  const targetModel = (connection.to_model ?? connection.model)?.trim();
  if (!targetModel) {
    throw new Error(
      "mutationConnectHasOneKey: connection must include known_as or to_model/model",
    );
  }
  return apitoMutationConnectHasOneIdField(targetModel);
}

/** Mutation connect key for has_many — `chef_ids`, `class_ids`, etc. */
export function mutationConnectHasManyKey(
  connection: ListRelationFilterKeyConnection,
): string {
  const knownAs = connection.known_as?.trim();
  if (knownAs) return `${knownAs}_ids`;

  const targetModel = (connection.to_model ?? connection.model)?.trim();
  if (!targetModel) {
    throw new Error(
      "mutationConnectHasManyKey: connection must include known_as or to_model/model",
    );
  }
  return apitoMutationConnectHasManyIdsField(targetModel);
}

export function buildMutationConnectFromConnection(
  connection: ListRelationFilterKeyConnection,
  documentId: string,
): Record<string, string> {
  const id = documentId.trim();
  return { [mutationConnectHasOneKey(connection)]: id };
}

/** `connect: { class_id: "01CLASS" }` for a has_one relation to stored model `class`. */
export function buildMutationConnectHasOne(
  relatedModelRef: string,
  documentId: string,
): Record<string, string> {
  const id = documentId.trim();
  return { [apitoMutationConnectHasOneIdField(relatedModelRef)]: id };
}

/** `connect: { class_ids: ["01A", "01B"] }` for a has_many relation. */
export function buildMutationConnectHasMany(
  relatedModelRef: string,
  documentIds: string[],
): Record<string, string[]> {
  const ids = documentIds.map((id) => id.trim()).filter(Boolean);
  return { [apitoMutationConnectHasManyIdsField(relatedModelRef)]: ids };
}
