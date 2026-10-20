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

export type VerifiedStaffFetcherOptions = {
  graphqlUrl: string;
  /** The already verified project-user credential, never an operator token. */
  bearerToken: string;
  projectId: string;
  /** Tenant scope returned by server-side identity verification. */
  tenantId: string;
  fetcher?: typeof fetch;
  onTokenExpired?: () => void;
  onError?: (error: Error) => void;
};

/**
 * Build the data-plane fetcher for a verified staff request.
 *
 * Unlike the general credential-aware fetcher, this function deliberately
 * never changes the credential class based on its prefix: a verified
 * project-user token is always sent as `Authorization: Bearer`. Operator
 * `apt_` credentials are rejected before a request is made so a route cannot
 * accidentally turn a data-plane client into a system client.
 */
export function createVerifiedStaffApitoFetcher(
  options: VerifiedStaffFetcherOptions,
): ApitoFetcher {
  const bearerToken = options.bearerToken.trim();
  const projectId = options.projectId.trim();
  const tenantId = options.tenantId.trim();

  if (!bearerToken) {
    throw new Error("Verified staff bearer token is required");
  }
  if (bearerToken.startsWith("apt_")) {
    throw new Error(
      "Verified staff client rejects operator apt_ credentials; use a project-user bearer",
    );
  }
  if (!projectId) {
    throw new Error("Verified staff project id is required");
  }
  if (!tenantId) {
    throw new Error("Verified staff tenant id is required");
  }

  const request = options.fetcher ?? globalThis.fetch.bind(globalThis);

  return async (query, variables) => {
    let response: Response;
    try {
      response = await request(options.graphqlUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          "X-Use-Cookies": "false",
          "X-Apito-Project-Id": projectId,
          "X-Apito-Tenant-ID": tenantId,
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
    }

    let json: GraphQLResponse;
    try {
      json = (await response.json()) as GraphQLResponse;
    } catch {
      const err = new Error(
        `Secured GraphQL request failed with status ${response.status}`,
      );
      options.onError?.(err);
      throw err;
    }

    if (!response.ok) {
      const message =
        json.errors?.map((error) => error.message).join(", ") ||
        `Secured GraphQL request failed with status ${response.status}`;
      const err = new Error(message);
      options.onError?.(err);
      throw err;
    }

    if (json.errors?.length && !hasUsableGraphQLData(json.data)) {
      const err = new ApitoGraphQLError(
        json.errors.map((error) => error.message).join(", "),
        json.errors,
        json,
      );
      options.onError?.(err);
      throw err;
    }
    return json;
  };
}

/**
 * Creates a browser fetcher for a same-origin BFF session. The Apito token is
 * intentionally absent from this API: the BFF reads its HttpOnly session
 * cookie, verifies the identity/action, and forwards the request with the
 * verified app-user bearer.
 */
export function createCookieApitoFetcher(options: {
  graphqlUrl: string;
  projectId?: string;
  tenantId?: string;
  onTokenExpired?: () => void;
  onError?: (error: Error) => void;
}): ApitoFetcher {
  return async (query, variables) => {
    let response: Response;
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      const projectId = options.projectId?.trim();
      if (projectId) headers["X-Apito-Project-Id"] = projectId;
      const tenantId = options.tenantId?.trim();
      if (tenantId) headers["X-Apito-Tenant-ID"] = tenantId;
      response = await fetch(options.graphqlUrl, {
        method: "POST",
        credentials: "include",
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
      throw new Error("Staff session expired. Please login again.");
    }
    const json = (await response.json()) as GraphQLResponse;
    if (json.errors?.length && !hasUsableGraphQLData(json.data)) {
      const message = json.errors.map((e) => e.message).join(", ");
      const err = new ApitoGraphQLError(message, json.errors, json);
      options.onError?.(err);
      throw err;
    }
    return json;
  };
}
