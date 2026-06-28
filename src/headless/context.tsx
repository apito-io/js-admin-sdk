"use client";

import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

import type { ApitoFetcher } from "./fetcher";

type ApitoContextValue = {
  fetcher: ApitoFetcher;
  queryClient: QueryClient;
};

export const ApitoContext = createContext<ApitoContextValue | null>(null);

export type ApitoProviderProps = {
  children: ReactNode;
  fetcher: ApitoFetcher;
  queryClient?: QueryClient;
};

export function ApitoProvider({
  children,
  fetcher,
  queryClient,
}: ApitoProviderProps) {
  const client = useMemo(
    () =>
      queryClient ??
      new QueryClient({
        defaultOptions: { queries: { retry: false } },
      }),
    [queryClient],
  );

  const value = useMemo(
    () => ({ fetcher, queryClient: client }),
    [fetcher, client],
  );

  return (
    <QueryClientProvider client={client}>
      <ApitoContext.Provider value={value}>{children}</ApitoContext.Provider>
    </QueryClientProvider>
  );
}

/** @deprecated Use ApitoProvider — v3 alias removed in v4 docs; kept briefly for grep migration */
export const ApitoHooksProvider = ApitoProvider;

export function useApitoFetcher(): ApitoFetcher {
  const ctx = useContext(ApitoContext);
  if (!ctx) {
    throw new Error("useApitoFetcher must be used within ApitoProvider");
  }
  return ctx.fetcher;
}

export function useApitoQueryClient(): QueryClient {
  const ctx = useContext(ApitoContext);
  if (!ctx) {
    throw new Error("useApitoQueryClient must be used within ApitoProvider");
  }
  return ctx.queryClient;
}
