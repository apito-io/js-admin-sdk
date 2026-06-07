import type { ApitoClient } from '../client';
import type { GraphQLResponse } from '../types';

export type ApitoFetcher = (
  query: string,
  variables?: Record<string, unknown>
) => Promise<GraphQLResponse>;

/** Build a fetcher that delegates to ApitoClient.executeGraphQL. */
export function createApitoFetcher(client: ApitoClient): ApitoFetcher {
  return (query, variables) => client.executeGraphQL(query, variables);
}

/** React Query fetcher hook factory — pass client via context in your app. */
export function useApitoFetcher(client: ApitoClient): ApitoFetcher {
  return createApitoFetcher(client);
}
