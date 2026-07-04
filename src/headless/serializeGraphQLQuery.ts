import { print, type DocumentNode } from "graphql";

export type GraphQLQueryInput = string | DocumentNode;

/** Codegen `TypedDocumentString` and similar String subclasses. */
function coerceStringDocument(query: unknown): string | null {
  if (query == null || typeof query !== "object") return null;
  const coerced = String(query).trim();
  if (!coerced || coerced === "[object Object]") return null;
  return coerced;
}

export function serializeGraphQLQuery(query: GraphQLQueryInput): string {
  if (typeof query === "string") return query;
  if (query && typeof query === "object" && query.kind === "Document") {
    return print(query);
  }
  const body = (query as { loc?: { source?: { body?: string } } })?.loc?.source
    ?.body;
  if (typeof body === "string" && body.trim()) return body;
  const coerced = coerceStringDocument(query);
  if (coerced) return coerced;
  throw new Error("Invalid GraphQL query: expected string or Document node");
}
