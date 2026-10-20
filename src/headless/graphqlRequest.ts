import {
  GraphQLError as ApitoGraphQLError,
  type GraphQLResponse,
} from "../types";
import { serializeGraphQLQuery, type GraphQLQueryInput } from "./serializeGraphQLQuery";
import { hasUsableGraphQLData, type ApitoFetcher } from "./fetcher";

/**
 * Execute one GraphQL document through a headless fetcher.
 *
 * This module intentionally has no React imports. It is shared by server
 * resource clients and the React hook adapter.
 */
export async function apitoGraphQLRequest<
  TData,
  TVariables extends Record<string, unknown> = Record<string, unknown>,
>(
  fetcher: ApitoFetcher,
  document: GraphQLQueryInput,
  variables?: TVariables,
): Promise<TData> {
  const res = await fetcher(
    serializeGraphQLQuery(document),
    variables as Record<string, unknown> | undefined,
  );

  // Defense in depth if a custom fetcher returns errors without throwing.
  if (res.errors?.length && !hasUsableGraphQLData(res.data)) {
    throw new ApitoGraphQLError(
      res.errors.map((error) => error.message).join(", "),
      res.errors,
      res,
    );
  }
  return res.data as TData;
}
