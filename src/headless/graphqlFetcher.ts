"use client";

import { useCallback, useContext, useMemo } from "react";

import {
  GraphQLError as ApitoGraphQLError,
} from "../types";
import { ApitoContext } from "./context";
import { hasUsableGraphQLData, type ApitoFetcher } from "./fetcher";
import { apitoGraphQLRequest } from "./graphqlRequest";
import {
  serializeGraphQLQuery,
  type GraphQLQueryInput,
} from "./serializeGraphQLQuery";

/** Non-hook GraphQL request — use inside mutationFn / callbacks (not useQuery). */
export { apitoGraphQLRequest };

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
    if (res.errors?.length && !hasUsableGraphQLData(res.data)) {
      throw new ApitoGraphQLError(
        res.errors.map((e) => e.message).join(", "),
        res.errors,
        res,
      );
    }
    return res.data as TData;
  }, [ctx.fetcher, serialized, variables]);
}
