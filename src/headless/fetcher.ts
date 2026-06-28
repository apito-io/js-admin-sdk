import type { GraphQLResponse } from "../types";
import {
  serializeGraphQLQuery,
  type GraphQLQueryInput,
} from "./serializeGraphQLQuery";

export type ApitoFetcher = (
  query: GraphQLQueryInput,
  variables?: Record<string, unknown>,
) => Promise<GraphQLResponse>;

export function createBearerApitoFetcher(options: {
  graphqlUrl: string;
  token: string;
  onTokenExpired?: () => void;
  onError?: (error: Error) => void;
}): ApitoFetcher {
  return async (query, variables) => {
    let response: Response;
    try {
      response = await fetch(options.graphqlUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: serializeGraphQLQuery(query),
          variables: variables ?? {},
        }),
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Network error");
      options.onError?.(err);
      throw err;
    }

    if (response.status === 401 || response.status === 403) {
      options.onTokenExpired?.();
      throw new Error("Token expired. Please login again.");
    }

    const json = (await response.json()) as GraphQLResponse;
    if (json.errors?.length) {
      const message = json.errors.map((e) => e.message).join(", ");
      const err = new Error(message);
      options.onError?.(err);
      throw err;
    }
    return json;
  };
}
