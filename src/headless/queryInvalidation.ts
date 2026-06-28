import type { Query } from "@tanstack/react-query";

/** React Query key prefix for institute/tenant bootstrap (see TenantContext). */
export const APITO_TENANT_QUERY_KEY = "tenant";

type InvalidateClient = {
  invalidateQueries: (filters?: {
    predicate?: (query: Query) => boolean;
    queryKey?: unknown[];
  }) => Promise<void>;
};

export function isApitoTenantQuery(query: Query): boolean {
  return query.queryKey[0] === APITO_TENANT_QUERY_KEY;
}

/** Invalidate list/form queries but keep tenant bootstrap cached. */
export function invalidateApitoDataQueries(queryClient: InvalidateClient): Promise<void> {
  return queryClient.invalidateQueries({
    predicate: (query) => !isApitoTenantQuery(query),
  });
}

/**
 * After a CRUD mutation: refresh resource queries; only refresh tenant when
 * the mutated resource is `tenant` (institute settings).
 */
export function invalidateApitoQueriesAfterMutation(
  queryClient: InvalidateClient,
  resource?: string,
): Promise<void> {
  const shouldRefreshTenant = resource === "tenant";
  return queryClient.invalidateQueries({
    predicate: (query) =>
      isApitoTenantQuery(query) ? shouldRefreshTenant : true,
  });
}
