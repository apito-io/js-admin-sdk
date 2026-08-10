"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useQueries, useQuery } from "@tanstack/react-query";

import {
  createApitoCasbinEnforcer,
  type ApitoCasbinEnforcer,
  type CasbinCanParams,
  type CreateApitoCasbinEnforcerOptions,
} from "../access/casbin-enforcer";
import type { EffectivePermissionsSnapshot } from "../access/permissions.types";
import { atLeast, type PlanTier } from "../access/plan";

const CasbinContext = createContext<ApitoCasbinEnforcer | null>(null);

export type CasbinProviderProps = CreateApitoCasbinEnforcerOptions & {
  children: ReactNode;
  /** Optional initial snapshot; call enforcer.resetFromSnapshot later as data loads. */
  initialSnapshot?: EffectivePermissionsSnapshot | null;
};

export function CasbinProvider({
  children,
  initialSnapshot = null,
  ...options
}: CasbinProviderProps) {
  const enforcer = useMemo(() => {
    const e = createApitoCasbinEnforcer(options);
    e.resetFromSnapshot(initialSnapshot);
    return e;
    // Intentional: factory options are stable app config.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <CasbinContext.Provider value={enforcer}>{children}</CasbinContext.Provider>
  );
}

export function useApitoCasbinEnforcer(): ApitoCasbinEnforcer {
  const ctx = useContext(CasbinContext);
  if (!ctx) {
    throw new Error("useApitoCasbinEnforcer requires CasbinProvider");
  }
  return ctx;
}

export function useCan(
  params: CasbinCanParams & { queryOptions?: { enabled?: boolean } },
) {
  const enforcer = useContext(CasbinContext);
  const { resource, action, params: p, queryOptions } = params;
  const query = useQuery({
    queryKey: ["apito-can", resource, action, p],
    queryFn: async () => {
      if (!enforcer) return false;
      return enforcer.can({ resource, action, params: p });
    },
    enabled: queryOptions?.enabled !== false && Boolean(resource && action),
    staleTime: 5 * 60 * 1000,
  });
  return { data: { can: query.data ?? false }, isLoading: query.isLoading };
}

/** Batch Casbin checks for sidebar menu resources. */
export function useMenuAccessMap(resourceNames: string[]) {
  const enforcer = useContext(CasbinContext);
  const names = useMemo(
    () => [...new Set(resourceNames.filter(Boolean))],
    [resourceNames],
  );
  const queries = useQueries({
    queries: names.map((name) => ({
      queryKey: ["apito-can", name, "list"],
      queryFn: async () => {
        if (!enforcer) return false;
        return enforcer.can({ resource: name, action: "list" });
      },
      staleTime: 5 * 60 * 1000,
    })),
  });
  return useMemo(() => {
    const map: Record<string, boolean> = {};
    names.forEach((name, index) => {
      map[name] = queries[index]?.data ?? false;
    });
    return map;
  }, [names, queries]);
}

export function CanAccess({
  resource,
  action,
  params,
  children,
  fallback = null,
}: CasbinCanParams & { children: ReactNode; fallback?: ReactNode }) {
  const { data } = useCan({ resource, action, params });
  if (!data?.can) return fallback;
  return children;
}

type PlanGateProps = {
  tier: string | null | undefined;
  min: PlanTier | string;
  children: ReactNode;
  fallback?: ReactNode;
};

/** Render children only when the tenant plan meets `min`. */
export function PlanGate({
  tier,
  min,
  children,
  fallback = null,
}: PlanGateProps) {
  if (!atLeast(tier, min)) return fallback;
  return children;
}

/** Hook to reset enforcer when snapshot changes (call from tenant bootstrap). */
export function useResetCasbinFromSnapshot(
  snap: EffectivePermissionsSnapshot | null | undefined,
) {
  const enforcer = useContext(CasbinContext);
  const reset = useCallback(() => {
    enforcer?.resetFromSnapshot(snap);
  }, [enforcer, snap]);
  return reset;
}
