import type {
  EffectiveModelPermission,
  EffectivePermissionsSnapshot,
} from "./permissions.types";

export function scopeAllows(scope: string | undefined | null): boolean {
  const s = (scope || "none").trim().toLowerCase();
  return s !== "" && s !== "none";
}

/** Map Refine-style actions to server CRUD scopes. */
export function scopeForAction(action: string): keyof EffectiveModelPermission {
  switch (action.trim().toLowerCase()) {
    case "list":
    case "show":
    case "read":
      return "read";
    case "create":
      return "create";
    case "edit":
    case "update":
      return "update";
    case "delete":
      return "delete";
    default:
      return "read";
  }
}

/**
 * Check snapshot scopes for a resource + Refine-style action.
 * Unclamped admin (`is_admin` and not `plan_clamped`) always allows.
 */
export function canFromSnapshot(
  snap: EffectivePermissionsSnapshot | null | undefined,
  resource: string,
  action: string,
): boolean {
  if (!snap) return false;
  if (snap.is_admin === true && snap.plan_clamped !== true) return true;
  const perms = snap.api_permissions || {};
  const model =
    perms[resource] ||
    perms[resource.replace(/-/g, "_")] ||
    null;
  if (!model) return false;
  const key = scopeForAction(action);
  return scopeAllows(model[key] as string | undefined);
}

export function graceModelsFromSnapshot(
  snap: EffectivePermissionsSnapshot | null | undefined,
): string[] {
  const fromList = (snap?.grace_models || []).filter(
    (m): m is string => typeof m === "string" && m.trim().length > 0,
  );
  if (fromList.length) return fromList;
  const fromPerms: string[] = [];
  for (const [model, perm] of Object.entries(snap?.api_permissions || {})) {
    if (perm?.grace) fromPerms.push(model);
  }
  return fromPerms;
}

export type BuildCasbinPolicyOptions = {
  roleFallback?: string | null;
  /** Pseudo menu resources that always get `list` (e.g. students_menu). */
  extraListResources?: string[];
  /** Resolve stored role when snapshot.role_id empty (e.g. localStorage). */
  getStoredRole?: () => string;
  /**
   * Roles that get a Casbin field wildcard (`p, role, * / *, field` without spaces).
   * Udbhabon shop staff: pass `["manager"]` — highest role, no tenant admin.
   */
  allFieldRoles?: string[];
};

/** Build Casbin CSV from myEffectivePermissions snapshot. */
export function buildCasbinPolicyFromSnapshot(
  snap: EffectivePermissionsSnapshot | null | undefined,
  options: BuildCasbinPolicyOptions = {},
): string {
  const stored =
    typeof options.getStoredRole === "function"
      ? options.getStoredRole().trim().toLowerCase()
      : "";
  const role =
    (snap?.role_id || "").trim().toLowerCase() ||
    (options.roleFallback || "").trim().toLowerCase() ||
    stored;
  if (!role) {
    return "# no role\n";
  }

  const lines: string[] = [`# generated from myEffectivePermissions for ${role}`];
  lines.push(`p, ${role}, dashboard, list`);

  const perms = snap?.api_permissions || {};
  for (const [model, raw] of Object.entries(perms)) {
    if (!model || model === "*") continue;
    const perm = raw || {};
    if (scopeAllows(perm.read)) {
      lines.push(`p, ${role}, ${model}, list`);
      lines.push(`p, ${role}, ${model}/*, show`);
    }
    if (scopeAllows(perm.create)) {
      lines.push(`p, ${role}, ${model}, create`);
    }
    if (scopeAllows(perm.update)) {
      lines.push(`p, ${role}, ${model}/*, edit`);
    }
    if (scopeAllows(perm.delete)) {
      lines.push(`p, ${role}, ${model}/*, delete`);
    }
  }

  for (const group of options.extraListResources || []) {
    if (group) lines.push(`p, ${role}, ${group}, list`);
  }

  const allFieldRoles = (options.allFieldRoles || [])
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean);
  if (allFieldRoles.includes(role)) {
    lines.push(`p, ${role}, */*, field`);
  }

  return `${lines.join("\n")}\n`;
}
