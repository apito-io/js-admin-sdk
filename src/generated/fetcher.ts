import type { ApitoClient } from '../client';
import type { GraphQLResponse } from '../types';
import { serializeGraphQLQuery, type GraphQLQueryInput } from '../headless/serializeGraphQLQuery';

export type ApitoFetcher = (
  query: GraphQLQueryInput,
  variables?: Record<string, unknown>,
) => Promise<GraphQLResponse>;

/** Build a fetcher that delegates to ApitoClient.executeGraphQL. */
export function createApitoFetcher(client: ApitoClient): ApitoFetcher {
  return (query, variables) =>
    client.executeGraphQL(serializeGraphQLQuery(query), variables);
}

/** React Query fetcher — reads ApitoProvider context (used by generated hooks). */
export { useApitoFetcher } from '../headless/context';
