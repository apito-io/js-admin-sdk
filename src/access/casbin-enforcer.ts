import type { Enforcer } from "casbin";
import { newEnforcer, newModel, StringAdapter } from "casbin";

import {
  buildCasbinPolicyFromSnapshot,
  type BuildCasbinPolicyOptions,
} from "./permissions";
import type { EffectivePermissionsSnapshot } from "./permissions.types";

/** Refine-shaped Casbin model used by Apito admin shells. */
export const APITO_REFINE_CASBIN_MODEL = `
[request_definition]
r = sub, obj, act

[policy_definition]
p = sub, obj, act, eft

[role_definition]
g = _, _

[policy_effect]
e = some(where (p.eft == allow)) && !some(where (p.eft == deny))

[matchers]
m = g(r.sub, p.sub) && keyMatch(r.obj, p.obj) && regexMatch(r.act, p.act)
`;

export type CasbinCanParams = {
  resource?: string;
  action?: string;
  params?: { id?: string; field?: string };
};

export type CreateApitoCasbinEnforcerOptions = BuildCasbinPolicyOptions & {
  /** Override role resolution for enforce() (defaults to snapshot.role_id / getStoredRole). */
  getUserRole?: () => string;
};

/**
 * Create a Casbin enforcer factory bound to effective-permission snapshots.
 * Call `resetFromSnapshot` whenever `myEffectivePermissions` updates.
 */
export function createApitoCasbinEnforcer(
  options: CreateApitoCasbinEnforcerOptions = {},
) {
  const model = newModel(APITO_REFINE_CASBIN_MODEL);
  let enforcerPromise: Promise<Enforcer> | null = null;
  let lastPolicyKey = "";

  function policyKey(csv: string, role: string): string {
    return `${role}::${csv.length}::${csv.slice(0, 64)}`;
  }

  function resolveRole(
    snap?: EffectivePermissionsSnapshot | null,
  ): string {
    return (
      (snap?.role_id || "").trim().toLowerCase() ||
      (options.roleFallback || "").trim().toLowerCase() ||
      (options.getUserRole?.() || options.getStoredRole?.() || "")
        .trim()
        .toLowerCase()
    );
  }

  function resetFromSnapshot(
    snap: EffectivePermissionsSnapshot | null | undefined,
  ): void {
    const role = resolveRole(snap);
    const csv = buildCasbinPolicyFromSnapshot(snap, {
      ...options,
      roleFallback: role,
    });
    const key = policyKey(csv, role);
    if (key === lastPolicyKey && enforcerPromise) return;
    lastPolicyKey = key;
    const adapter = new StringAdapter(csv);
    enforcerPromise = newEnforcer(model, adapter);
  }

  async function getEnforcer(): Promise<Enforcer> {
    if (!enforcerPromise) {
      resetFromSnapshot(null);
    }
    return enforcerPromise!;
  }

  async function can(params: CasbinCanParams): Promise<boolean> {
    const { resource, action, params: p } = params;
    if (!resource || !action) return false;
    const role = (options.getUserRole?.() || options.getStoredRole?.() || "")
      .trim()
      .toLowerCase();
    if (!role) return false;
    const enforcer = await getEnforcer();
    if (action === "delete" || action === "edit" || action === "show") {
      const id = p?.id ?? "";
      return enforcer.enforce(role, `${resource}/${id}`, action);
    }
    if (action === "field") {
      const field = p?.field ?? "";
      return enforcer.enforce(role, `${resource}/${field}`, action);
    }
    return enforcer.enforce(role, resource, action);
  }

  return {
    resetFromSnapshot,
    getEnforcer,
    can,
    resolveRole,
  };
}

export type ApitoCasbinEnforcer = ReturnType<typeof createApitoCasbinEnforcer>;
