/** Per-model CRUD scopes from `myEffectivePermissions.api_permissions`. */
export type EffectiveModelPermission = {
  read?: string;
  create?: string;
  update?: string;
  delete?: string;
  grace?: boolean;
};

/** Engine public query `myEffectivePermissions` payload. */
export type EffectivePermissionsSnapshot = {
  plan_slug?: string | null;
  role_id?: string | null;
  plan_clamped?: boolean | null;
  api_permissions?: Record<string, EffectiveModelPermission> | null;
  logic_executions?: Array<string | null> | null;
  quotas?: Record<string, number> | null;
  usage?: Record<string, number> | null;
  grace_models?: Array<string | null> | null;
  is_admin?: boolean | null;
};

export const MY_EFFECTIVE_PERMISSIONS_QUERY = `
  query MyEffectivePermissions {
    myEffectivePermissions {
      plan_slug
      role_id
      plan_clamped
      api_permissions
      logic_executions
      quotas
      usage
      grace_models
      is_admin
    }
  }
`;
