import {
  GraphQLError as ApitoGraphQLError,
  type GraphQLResponse,
} from "../types";
import {
  serializeGraphQLQuery,
  type GraphQLQueryInput,
} from "./serializeGraphQLQuery";

export type ApitoFetcher = (
  query: GraphQLQueryInput,
  variables?: Record<string, unknown>,
) => Promise<GraphQLResponse>;

/**
 * True when at least one top-level `data` field is non-null.
 * Mutations often return HTTP 200 with `{ createX: null }` + `errors` — that is
 * not usable. Queries may return a non-null root with nested field errors.
 */
export function hasUsableGraphQLData(data: unknown): boolean {
  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    return false;
  }
  return Object.values(data as Record<string, unknown>).some((v) => v != null);
}

/** Match ApitoClient.authHeaders: ak_ → X-Apito-Key; apt_/JWT → Bearer. */
function buildHeadlessAuthHeaders(token: string): Record<string, string> {
  const trimmed = token.trim();
  if (trimmed.startsWith("ak_")) {
    return { "X-Apito-Key": trimmed };
  }
  return {
    Authorization: `Bearer ${trimmed}`,
    "X-Use-Cookies": "false",
  };
}

export function createBearerApitoFetcher(options: {
  graphqlUrl: string;
  token: string;
  projectId?: string;
  tenantId?: string;
  onTokenExpired?: () => void;
  onError?: (error: Error) => void;
}): ApitoFetcher {
  return async (query, variables) => {
    let response: Response;
    try {
      const headers: Record<string, string> = {
        ...buildHeadlessAuthHeaders(options.token),
        "Content-Type": "application/json",
      };
      const projectId = options.projectId?.trim();
      if (projectId) {
        headers["X-Apito-Project-Id"] = projectId;
      }
      const tenantId = options.tenantId?.trim();
      if (tenantId) {
        headers["X-Apito-Tenant-ID"] = tenantId;
      }
      response = await fetch(options.graphqlUrl, {
        method: "POST",
        headers,
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
    if (json.errors?.length && !hasUsableGraphQLData(json.data)) {
      // Failed mutation (`{ createX: null }` + errors) or null data — throw.
      // Partial query roots with nested errors still return so forms can hydrate.
      const message = json.errors.map((e) => e.message).join(", ");
      const err = new ApitoGraphQLError(message, json.errors, json);
      options.onError?.(err);
      throw err;
    }
    return json;
  };
}
