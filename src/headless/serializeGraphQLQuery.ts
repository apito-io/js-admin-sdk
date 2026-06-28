import { print, type DocumentNode } from "graphql";

export type GraphQLQueryInput = string | DocumentNode;

export function serializeGraphQLQuery(query: GraphQLQueryInput): string {
  if (typeof query === "string") return query;
  if (query && typeof query === "object" && query.kind === "Document") {
    return print(query);
  }
  const body = (query as { loc?: { source?: { body?: string } } })?.loc?.source
    ?.body;
  if (typeof body === "string" && body.trim()) return body;
  throw new Error("Invalid GraphQL query: expected string or Document node");
}
