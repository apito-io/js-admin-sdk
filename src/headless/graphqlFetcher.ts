"use client";

import { useCallback, useContext, useMemo } from "react";

import { ApitoContext } from "./context";
import type { ApitoFetcher } from "./fetcher";
import {
  serializeGraphQLQuery,
  type GraphQLQueryInput,
} from "./serializeGraphQLQuery";

/** Non-hook GraphQL request — use inside mutationFn / callbacks (not useQuery). */
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
  return res.data as TData;
}

/** GraphQL-codegen react-query fetcher: returns a queryFn for useQuery. */
export function useApitoGraphQLFetcher<
  TData,
  TVariables extends Record<string, unknown> = Record<string, unknown>,
>(
  document: GraphQLQueryInput,
  variables?: TVariables,
  _headers?: RequestInit["headers"],
): () => Promise<TData> {
  const ctx = useContext(ApitoContext);
  if (!ctx) {
    throw new Error("useApitoGraphQLFetcher must be used within ApitoProvider");
  }

  const serialized = useMemo(
    () => serializeGraphQLQuery(document),
    [document],
  );

  return useCallback(async () => {
    const res = await ctx.fetcher(
      serialized,
      variables as Record<string, unknown> | undefined,
    );
    return res.data as TData;
  }, [ctx.fetcher, serialized, variables]);
}
