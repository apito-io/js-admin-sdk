import axios, { AxiosInstance } from 'axios';
import {
  ClientConfig,
  DefaultDocumentStructure,
  SearchResult,
  TypedDocumentStructure,
  TypedSearchResult,
  CreateAndUpdateRequest,
  GraphQLResponse,
  GraphQLError as SDKGraphQLError,
  ApitoError,
  ValidationError,
  InjectedDBOperationInterface,
  LoginUserResponse,
  User,
  UsersResponse,
  TenantByDomainResponse,
  TenantCatalogSearchRow,
  TenantCatalogListItem,
  GetTenantsResponse,
  SearchTenantsResponse,
  CreateTenantParams,
  UpdateTenantParams,
  MyTenant,
  LoginUserParams,
  CreateUserParams,
  UpdateUserParams,
  GoogleOAuthStateResponse,
  File,
  FilesListResponse,
  UploadFileParams,
  DeleteFilesResponse,
} from './types';
import { FILES_DELETE_PATH, FILES_LIST_PATH, FILES_UPLOAD_PATH } from './filesPaths';
import { MY_EFFECTIVE_PERMISSIONS_QUERY } from './access/permissions.types';
import type { EffectivePermissionsSnapshot } from './access/permissions.types';

function deriveRestBaseURL(graphqlURL: string): string {
  const u = graphqlURL.trim().replace(/\/$/, '');
  if (u.endsWith('/graphql')) {
    const base = u.slice(0, -'/graphql'.length);
    // Project file REST lives on /secured even when GraphQL uses /system/graphql.
    if (base.endsWith('/system')) {
      return `${base.slice(0, -'/system'.length)}/secured`;
    }
    return base;
  }
  return u;
}

/**
 * Apito SDK Client - JavaScript implementation matching the Go SDK
 */
export class ApitoClient implements InjectedDBOperationInterface {
  private httpClient: AxiosInstance;
  private baseURL: string;
  private restBaseURL: string;
  private apiKey: string;
  private bearerToken?: string;
  private projectId?: string;
  private tenantId?: string;

  constructor(config: ClientConfig) {
    this.baseURL = config.baseURL;
    this.restBaseURL = (config.restBaseURL ?? '').trim() || deriveRestBaseURL(config.baseURL);
    this.apiKey = (config.accessToken ?? config.apiKey ?? '').trim();
    this.bearerToken = config.bearerToken?.trim() || undefined;
    this.projectId = config.projectId?.trim() || undefined;
    this.tenantId = config.tenantId?.trim() || undefined;

    if (!this.bearerToken && !this.apiKey) {
      throw new Error('ClientConfig requires accessToken, apiKey, or bearerToken');
    }
    if (/^(cli-|sdk-|mcp-)/.test(this.apiKey)) {
      throw new Error(
        'TOKEN_FORMAT_RETIRED: cli-/sdk-/mcp- prefixed keys are no longer accepted. ' +
          'Generate a unified apt_ access token in Console → Access Token and pass it as `accessToken`.'
      );
    }

    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.authHeaders({}),
    };

    // Create axios instance with default configuration
    this.httpClient = axios.create({
      timeout: config.timeout || 30000,
      headers: defaultHeaders,
      ...config.httpClient,
    });
  }

  /**
   * Execute an arbitrary GraphQL query or mutation against the Apito admin (system) endpoint.
   * Use for plugin-registered operations (e.g. processLedger, plg_closeOrder) when not wrapped by dedicated SDK methods.
   */
  async executeGraphQL(
    query: string,
    variables?: Record<string, any>,
    options?: { projectId?: string; tenantId?: string }
  ): Promise<GraphQLResponse> {
    try {
      const payload = {
        query,
        variables: variables || {},
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...this.authHeaders(options),
      };

      const response = await this.httpClient.post<GraphQLResponse>(
        this.baseURL,
        payload,
        { headers }
      );

      if (response.data.errors && response.data.errors.length > 0) {
        throw new SDKGraphQLError(
          'GraphQL query failed',
          response.data.errors,
          response.data
        );
      }

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new ApitoError(
          error.response?.data?.message || error.message,
          'HTTP_ERROR',
          error.response?.status,
          error.response?.data
        );
      }
      throw error;
    }
  }

  /**
   * Generate a tenant-scoped API key. Matches engine `generateTenantToken`: `tenant_id`, `duration`, optional `role`.
   * Auth uses the client's `accessToken`/`apiKey` (unified `apt_` tokens send `Authorization: Bearer`; legacy project keys send `X-Apito-Key`).
   * Not available on Cloudflare Workers v1 (`tenant management is not available on Cloudflare Workers v1`).
   *
   * @param tenantId Catalog tenant id (`tenant_id` in the mutation).
   * @param duration Expiry calendar day `YYYY-MM-DD`. If omitted/empty, defaults to one year ahead in UTC.
   * @param role Optional token role; if omitted/empty, the engine defaults to `admin`.
   */
  async generateTenantToken(tenantId: string, duration?: string, role?: string): Promise<string> {
    let dur = (duration ?? '').trim();
    if (!dur) {
      const d = new Date();
      dur = `${d.getUTCFullYear() + 1}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
        d.getUTCDate()
      ).padStart(2, '0')}`;
    }

    const query = `
      mutation GenerateTenantToken($tenantId: String!, $duration: String!, $role: String) {
        generateTenantToken(tenant_id: $tenantId, duration: $duration, role: $role) {
          token
        }
      }
    `;

    const variables: Record<string, any> = {
      tenantId,
      duration: dur,
      role: role !== undefined && role.trim() !== '' ? role.trim() : null,
    };
    const response = await this.executeGraphQL(query, variables, { tenantId });

    const data = response.data?.generateTenantToken;
    if (!data?.token) {
      throw new ValidationError('Invalid response format for tenant token');
    }

    return data.token;
  }

  private authHeaders(options?: { projectId?: string; tenantId?: string }): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.bearerToken) {
      headers.Authorization = `Bearer ${this.bearerToken}`;
    } else if (this.apiKey.startsWith('apt_')) {
      // Unified access token: Authorization: Bearer only. X-Use-Cookies: false
      // tells the engine this is a headless API call (no browser session
      // cookies). Hard cut — no compatibility X-Apito-Key fallback.
      headers.Authorization = `Bearer ${this.apiKey}`;
      headers['X-Use-Cookies'] = 'false';
    } else {
      headers['X-Apito-Key'] = this.apiKey;
    }
    const pid = options?.projectId?.trim() || this.projectId;
    if (pid) {
      headers['X-Apito-Project-Id'] = pid;
    }
    const tid = options?.tenantId?.trim() || this.tenantId;
    if (tid) {
      headers['X-Apito-Tenant-ID'] = tid;
    }
    return headers;
  }

  private async executeREST<T>(
    method: 'GET' | 'POST',
    path: string,
    options?: {
      query?: Record<string, string | number | undefined>;
      jsonBody?: Record<string, unknown>;
      formData?: FormData;
      allowFailure?: boolean;
      projectId?: string;
      tenantId?: string;
    }
  ): Promise<T> {
    const url = new URL(`${this.restBaseURL.replace(/\/$/, '')}${path}`);
    if (options?.query) {
      for (const [k, v] of Object.entries(options.query)) {
        if (v !== undefined && v !== '') {
          url.searchParams.set(k, String(v));
        }
      }
    }
    const headers: Record<string, string | boolean> = { ...this.authHeaders(options) };
    let data: FormData | Record<string, unknown> | undefined;
    if (options?.formData) {
      data = options.formData;
      // Instance default is application/json; that prevents Echo from parsing multipart.
      headers['Content-Type'] = false;
    } else if (options?.jsonBody) {
      headers['Content-Type'] = 'application/json';
      data = options.jsonBody;
    }
    try {
      const response = await this.httpClient.request({
        method,
        url: url.toString(),
        headers: headers as Record<string, string>,
        data,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });
      const body = response.data as Record<string, unknown>;
      if (body.success === false && !options?.allowFailure) {
        throw new ValidationError(String(body.message ?? 'request failed'));
      }
      return body as T;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const data = error.response?.data as { message?: unknown; error?: unknown };
        const msg =
          typeof data?.message === 'string'
            ? data.message
            : typeof data?.error === 'string'
              ? data.error
              : error.message;
        throw new ApitoError(msg, 'HTTP_ERROR', error.response?.status, error.response?.data);
      }
      throw error;
    }
  }

  /**
   * Project user login (system GraphQL `loginUser`). Password path: pass `password` and `email` or `phone` per project Authentication settings. Google OAuth path: `authMethod: 'google'` with `code` and `state` from the redirect; call `googleOAuthState(projectId)` before opening Google to obtain `state`. Google paths may auto-link a verified email to an existing user; handle engine errors `google email not verified`, `google account already linked to another user`, `multiple users matched this email`. On Cloudflare Workers v1, Google paths are unavailable; password login is supported.
   */
  async loginUser(params: LoginUserParams): Promise<LoginUserResponse> {
    const authMethod = (params.authMethod ?? 'general').trim().toLowerCase() || 'general';
    const variables: Record<string, any> = {
      project_id: params.projectId,
    };
    const tenantId = (params.tenantId ?? '').trim();
    if (tenantId) {
      variables.tenant_id = tenantId;
    }

    if (authMethod === 'google') {
      variables.auth_method = 'google';
      const code = (params.code ?? '').trim();
      const state = (params.state ?? '').trim();
      if (!code || !state) {
        throw new ValidationError('code and state are required for Google login');
      }
      variables.code = code;
      variables.state = state;
    } else if (
      authMethod === 'facebook' ||
      authMethod === 'github' ||
      authMethod === 'x' ||
      authMethod === 'linkedin'
    ) {
      variables.auth_method = authMethod;
      const code = (params.code ?? '').trim();
      const state = (params.state ?? '').trim();
      if (!code || !state) {
        throw new ValidationError(`code and state are required for ${authMethod} login`);
      }
      variables.code = code;
      variables.state = state;
    } else if (authMethod === 'google_id_token') {
      variables.auth_method = 'google_id_token';
      const idToken = (params.idToken ?? '').trim();
      if (!idToken) {
        throw new ValidationError('id_token is required for google_id_token login');
      }
      variables.id_token = idToken;
    } else {
      const password = (params.password ?? '').trim();
      if (!password) {
        throw new ValidationError('password is required');
      }
      variables.password = password;
      const email = (params.email ?? '').trim();
      const phone = (params.phone ?? '').trim();
      if (!email && !phone) {
        throw new ValidationError('email or phone is required');
      }
      if (email) variables.email = email;
      if (phone) variables.phone = phone;
    }

    const query = `
      query LoginUser($project_id: String!, $tenant_id: String, $password: String, $auth_method: String, $email: String, $phone: String, $code: String, $state: String, $id_token: String) {
        loginUser(project_id: $project_id, tenant_id: $tenant_id, password: $password, auth_method: $auth_method, email: $email, phone: $phone, code: $code, state: $state, id_token: $id_token) {
          token
          user {
            id
            email
            phone
            role
            provider
            tenant_id
            status
            created_at
            updated_at
          }
        }
      }
    `;
    const response = await this.executeGraphQL(query, variables, {
      projectId: params.projectId,
      tenantId,
    });
    const raw = response.data?.loginUser;
    if (!raw?.token) {
      throw new ValidationError('Invalid response format for loginUser');
    }
    return {
      token: raw.token as string,
      user: raw.user as User | undefined,
    };
  }

  /**
   * Signed OAuth state for provider login (system query `oauthState`).
   * Prefer this for facebook/github/x/linkedin; `googleOAuthState` remains a Google-only alias.
   */
  async oauthState(projectId: string, provider: string): Promise<GoogleOAuthStateResponse> {
    const query = `
      query OAuthState($project_id: String!, $provider: String!) {
        oauthState(project_id: $project_id, provider: $provider) {
          state
        }
      }
    `;
    const variables = { project_id: projectId, provider };
    const response = await this.executeGraphQL(query, variables, { projectId });
    const raw = response.data?.oauthState;
    const state = typeof raw?.state === 'string' ? raw.state.trim() : '';
    if (!state) {
      throw new ValidationError('Invalid response format for oauthState');
    }
    return { state };
  }

  /**
   * Signed OAuth state for Google login (system query `googleOAuthState`). Use in the authorize URL together with project `google_client_id` and the configured redirect URI.
   */
  async googleOAuthState(projectId: string): Promise<GoogleOAuthStateResponse> {
    const query = `
      query GoogleOAuthState($project_id: String!) {
        googleOAuthState(project_id: $project_id) {
          state
        }
      }
    `;
    const variables = { project_id: projectId };
    const response = await this.executeGraphQL(query, variables, { projectId });
    const raw = response.data?.googleOAuthState;
    const state = typeof raw?.state === 'string' ? raw.state.trim() : '';
    if (!state) {
      throw new ValidationError('Invalid response format for googleOAuthState');
    }
    return { state };
  }

  /**
   * Search project end-users. On pro SaaS, pass `tenantId` to scope the list to one catalog tenant.
   * Optional `q` filters email, username, phone, or id (case-insensitive contains).
   */
  async searchUsers(
    projectId: string,
    limit?: number,
    offset?: number,
    tenantId?: string,
    q?: string
  ): Promise<UsersResponse> {
    const query = `
      query SearchUsers($project_id: String!, $limit: Int, $offset: Int, $tenant_id: String, $q: String) {
        searchUsers(project_id: $project_id, limit: $limit, offset: $offset, tenant_id: $tenant_id, q: $q) {
          count
          users {
            id
            email
            phone
            role
            provider
            tenant_id
            status
            created_at
            updated_at
          }
        }
      }
    `;
    const variables: Record<string, any> = { project_id: projectId };
    if (limit !== undefined) variables.limit = limit;
    if (offset !== undefined) variables.offset = offset;
    const tid = (tenantId ?? '').trim();
    if (tid) variables.tenant_id = tid;
    const needle = (q ?? '').trim();
    if (needle) variables.q = needle;
    const response = await this.executeGraphQL(query, variables, {
      projectId,
      tenantId: tid,
    });
    const raw = response.data?.searchUsers;
    if (!raw) {
      throw new ValidationError('Invalid response format for searchUsers');
    }
    let count = 0;
    if (typeof raw.count === 'number') {
      count = raw.count;
    }
    const users = (raw.users ?? []) as User[];
    return { users, count };
  }

  /**
   * Resolve the single SaaS catalog tenant for an exact domain match in the project (`tenant` null if none).
   */
  async searchTenantsByDomain(projectId: string, domain: string): Promise<TenantByDomainResponse> {
    const query = `
      query SearchTenantsByDomain($project_id: String!, $domain: String!) {
        searchTenantsByDomain(project_id: $project_id, domain: $domain) {
          tenant {
            id
            name
            status
            domain
            plan_tier
            data
          }
        }
      }
    `;
    const variables: Record<string, any> = {
      project_id: projectId,
      domain,
    };
    const response = await this.executeGraphQL(query, variables, { projectId });
    const raw = response.data?.searchTenantsByDomain;
    if (!raw) {
      throw new ValidationError('Invalid response format for searchTenantsByDomain');
    }
    const tenant = (raw.tenant ?? null) as TenantCatalogSearchRow | null;
    return { tenant };
  }

  /**
   * Search SaaS catalog tenants with optional text filter, status filter, and pagination (system GraphQL only).
   * status: active (default), deleted, or all.
   */
  async searchTenants(
    projectId: string,
    limit?: number,
    offset?: number,
    q?: string,
    status?: string
  ): Promise<SearchTenantsResponse> {
    const query = `
      query SearchTenants($project_id: String!, $limit: Int, $offset: Int, $q: String, $status: String) {
        searchTenants(project_id: $project_id, limit: $limit, offset: $offset, q: $q, status: $status) {
          count
          tenants {
            id
            name
            status
            domain
            plan_tier
            icon
            data
            created_at
          }
        }
      }
    `;
    const variables: Record<string, any> = { project_id: projectId };
    if (limit !== undefined) variables.limit = limit;
    if (offset !== undefined) variables.offset = offset;
    const needle = (q ?? '').trim();
    if (needle) variables.q = needle;
    const statusFilter = (status ?? '').trim();
    if (statusFilter) variables.status = statusFilter;
    const response = await this.executeGraphQL(query, variables, { projectId });
    const raw = response.data?.searchTenants;
    if (!raw) {
      throw new ValidationError('Invalid response format for searchTenants');
    }
    let count = 0;
    if (typeof raw.count === 'number') {
      count = raw.count;
    }
    const tenants = (raw.tenants ?? []) as TenantCatalogSearchRow[];
    return { tenants, count };
  }

  /**
   * Load one SaaS catalog tenant by exact id (system GraphQL only).
   * Uses `searchTenants` with `q` = tenant id and returns only an exact id match.
   */
  async getTenant(
    projectId: string,
    tenantId: string,
    status?: string
  ): Promise<TenantCatalogSearchRow | null> {
    const pid = (projectId ?? '').trim();
    const tid = (tenantId ?? '').trim();
    if (!pid) {
      throw new ValidationError('projectId is required');
    }
    if (!tid) {
      throw new ValidationError('tenantId is required');
    }
    const { tenants } = await this.searchTenants(pid, 5, 0, tid, status ?? 'active');
    if (!Array.isArray(tenants)) {
      return null;
    }
    return tenants.find((row) => row?.id?.trim() === tid) ?? null;
  }

  /** List SaaS catalog tenants for the authenticated project (system GraphQL only). */
  async getTenants(): Promise<GetTenantsResponse> {
    const query = `
      query GetTenants {
        getTenants {
          tenants {
            id
            name
            domain
            plan_tier
            icon
            data
          }
        }
      }
    `;
    const response = await this.executeGraphQL(query, {});
    const raw = response.data?.getTenants;
    if (!raw) {
      throw new ValidationError('Invalid response format for getTenants');
    }
    const tenants = (raw.tenants ?? []) as TenantCatalogListItem[];
    return { tenants };
  }

  /** Provision a SaaS catalog tenant (system GraphQL only). */
  async createTenant(params: CreateTenantParams): Promise<TenantCatalogSearchRow> {
    const name = (params.name ?? '').trim();
    if (!name) {
      throw new ValidationError('name is required');
    }
    const query = `
      mutation CreateTenant($name: String!, $data: String, $domain: String, $plan_tier: String) {
        createTenant(name: $name, data: $data, domain: $domain, plan_tier: $plan_tier) {
          id
          name
          status
          domain
          plan_tier
          data
        }
      }
    `;
    const variables: Record<string, any> = { name };
    const data = (params.data ?? '').trim();
    if (data) variables.data = data;
    const domain = (params.domain ?? '').trim();
    if (domain) variables.domain = domain;
    const planTier = (params.planTier ?? '').trim();
    if (planTier) variables.plan_tier = planTier;
    const response = await this.executeGraphQL(query, variables);
    const row = response.data?.createTenant as TenantCatalogSearchRow | undefined;
    if (!row?.id) {
      throw new ValidationError('Invalid response format for createTenant');
    }
    return row;
  }

  /** Update catalog tenant name/data/domain/plan_tier. */
  async updateTenant(tenantId: string, params: UpdateTenantParams): Promise<TenantCatalogSearchRow> {
    const tid = (tenantId ?? '').trim();
    if (!tid) {
      throw new ValidationError('tenantId is required');
    }
    if (
      params.name === undefined &&
      params.data === undefined &&
      params.domain === undefined &&
      params.planTier === undefined
    ) {
      throw new ValidationError('at least one field must be provided');
    }
    const query = `
      mutation UpdateTenant($tenant_id: String!, $name: String, $data: String, $domain: String, $plan_tier: String) {
        updateTenant(tenant_id: $tenant_id, name: $name, data: $data, domain: $domain, plan_tier: $plan_tier) {
          id
          name
          status
          domain
          plan_tier
          data
        }
      }
    `;
    const variables: Record<string, any> = { tenant_id: tid };
    if (params.name !== undefined) variables.name = params.name;
    if (params.data !== undefined) variables.data = params.data;
    if (params.domain !== undefined) variables.domain = params.domain;
    if (params.planTier !== undefined) variables.plan_tier = params.planTier;
    const response = await this.executeGraphQL(query, variables);
    const row = response.data?.updateTenant as TenantCatalogSearchRow | undefined;
    if (!row?.id) {
      throw new ValidationError('Invalid response format for updateTenant');
    }
    return row;
  }

  /**
   * Public GraphQL `myTenant` for the authenticated app-user token (includes plan_tier).
   * Use against `/secured/graphql` (or public) with the JWT from `loginUser`.
   */
  async myTenant(): Promise<MyTenant> {
    const query = `
      query MyTenant {
        myTenant {
          id
          name
          domain
          status
          plan_tier
        }
      }
    `;
    const response = await this.executeGraphQL(query, {});
    const raw = response.data?.myTenant as MyTenant | undefined;
    if (!raw?.id?.trim()) {
      throw new ValidationError('Invalid response format for myTenant');
    }
    return raw;
  }

  /**
   * Public GraphQL `myEffectivePermissions` for the authenticated app-user token
   * (role ∩ tenant plan ceiling, quotas, grace). Use against `/secured/graphql`.
   */
  async myEffectivePermissions(): Promise<EffectivePermissionsSnapshot> {
    const response = await this.executeGraphQL(MY_EFFECTIVE_PERMISSIONS_QUERY, {});
    const raw = response.data?.myEffectivePermissions as
      | EffectivePermissionsSnapshot
      | null
      | undefined;
    if (!raw || typeof raw !== 'object') {
      throw new ValidationError(
        'Invalid response format for myEffectivePermissions',
      );
    }
    return raw;
  }

  /** Soft-delete a catalog tenant row (status=deleted). Content and mirror remain until Console hard delete. */
  async deleteTenant(tenantId: string): Promise<boolean> {
    const tid = (tenantId ?? '').trim();
    if (!tid) {
      throw new ValidationError('tenantId is required');
    }
    const query = `
      mutation DeleteTenant($tenant_id: String!) {
        deleteTenant(tenant_id: $tenant_id)
      }
    `;
    const response = await this.executeGraphQL(query, { tenant_id: tid });
    const ok = response.data?.deleteTenant;
    if (typeof ok !== 'boolean') {
      throw new ValidationError('Invalid response format for deleteTenant');
    }
    return ok;
  }

  /**
   * Create a project user (local password). Use `email` and/or `phone` per engine validation for the project identifier mode. Engine errors: `email already exists for this project`, `phone already exists for this project`.
   */
  async createUser(projectId: string, params: CreateUserParams): Promise<User> {
    const password = (params.password ?? '').trim();
    if (!password) {
      throw new ValidationError('password is required');
    }
    const query = `
      mutation CreateUser($project_id: String!, $password: String!, $role: String, $email: String, $phone: String, $tenant_id: String) {
        createUser(project_id: $project_id, password: $password, role: $role, email: $email, phone: $phone, tenant_id: $tenant_id) {
          id
          email
          phone
          role
          provider
          tenant_id
          status
          created_at
          updated_at
        }
      }
    `;
    const variables: Record<string, any> = {
      project_id: projectId,
      password,
    };
    const role = (params.role ?? '').trim();
    if (role) variables.role = role;
    const email = (params.email ?? '').trim();
    if (email) variables.email = email;
    const phone = (params.phone ?? '').trim();
    if (phone) variables.phone = phone;
    const tenantId = (params.tenantId ?? '').trim();
    if (tenantId) variables.tenant_id = tenantId;
    const response = await this.executeGraphQL(query, variables, {
      projectId,
      tenantId,
    });
    const u = response.data?.createUser;
    if (!u?.id) {
      throw new ValidationError('Invalid response format for createUser');
    }
    return u as User;
  }

  /**
   * Update a project user. Project scope is implied by the API key. Only include fields to change. Engine errors: `email already exists for this project`, `phone already exists for this project`.
   */
  async updateUser(userId: string, params: UpdateUserParams): Promise<User> {
    const uid = (userId ?? '').trim();
    if (!uid) {
      throw new ValidationError('userId is required');
    }
    if (
      params.email === undefined &&
      params.phone === undefined &&
      params.role === undefined &&
      params.tenantId === undefined
    ) {
      throw new ValidationError('at least one field must be provided');
    }
    const query = `
      mutation UpdateUser($user_id: String!, $email: String, $phone: String, $role: String, $tenant_id: String) {
        updateUser(user_id: $user_id, email: $email, phone: $phone, role: $role, tenant_id: $tenant_id) {
          id
          email
          phone
          role
          provider
          tenant_id
          status
          created_at
          updated_at
        }
      }
    `;
    const variables: Record<string, any> = { user_id: uid };
    if (params.email !== undefined) variables.email = params.email;
    if (params.phone !== undefined) variables.phone = params.phone;
    if (params.role !== undefined) variables.role = params.role;
    if (params.tenantId !== undefined) variables.tenant_id = params.tenantId;
    const response = await this.executeGraphQL(query, variables);
    const u = response.data?.updateUser;
    if (!u?.id) {
      throw new ValidationError('Invalid response format for updateUser');
    }
    return u as User;
  }

  /** Set a new password for a project user (admin mutation resetUserPassword). */
  async resetUserPassword(userId: string, password: string): Promise<boolean> {
    const uid = (userId ?? '').trim();
    if (!uid) {
      throw new ValidationError('userId is required');
    }
    if (!(password ?? '').trim()) {
      throw new ValidationError('password is required');
    }
    const query = `
      mutation ResetUserPassword($user_id: String!, $password: String!) {
        resetUserPassword(user_id: $user_id, password: $password)
      }
    `;
    const response = await this.executeGraphQL(query, { user_id: uid, password });
    const ok = response.data?.resetUserPassword;
    if (typeof ok !== 'boolean') {
      throw new ValidationError('Invalid response format for resetUserPassword');
    }
    return ok;
  }

  /**
   * Delete a project user by id. Project scope is implied by the API key.
   */
  async deleteUser(userId: string): Promise<boolean> {
    const uid = (userId ?? '').trim();
    if (!uid) {
      throw new ValidationError('userId is required');
    }
    const query = `
      mutation DeleteUser($user_id: String!) {
        deleteUser(user_id: $user_id)
      }
    `;
    const response = await this.executeGraphQL(query, { user_id: uid });
    const ok = response.data?.deleteUser;
    if (typeof ok !== 'boolean') {
      throw new ValidationError('Invalid response format for deleteUser');
    }
    return ok;
  }

  /** Upload a project file via POST /secured/files/upload (metadata in project DB). */
  async uploadFile(params: UploadFileParams): Promise<File> {
    const size =
      params.content instanceof ArrayBuffer
        ? params.content.byteLength
        : params.content.byteLength;
    if (!params.content || size === 0) {
      throw new ValidationError('file content is required');
    }
    const fileName = (params.fileName ?? '').trim() || 'upload';
    const form = new FormData();
    const bytes =
      params.content instanceof ArrayBuffer ? new Uint8Array(params.content) : params.content;
    const blob = new Blob([bytes as BlobPart]);
    form.append('file', blob, fileName);
    if (params.fileType?.trim()) {
      form.append('file_type', params.fileType.trim());
    }
    const body = await this.executeREST<{ file: File }>('POST', FILES_UPLOAD_PATH, {
      formData: form,
    });
    if (!body.file?.id) {
      throw new ValidationError('Invalid response format for uploadFile');
    }
    return body.file;
  }

  /** List project files via GET /secured/files/list. */
  async listFiles(
    fileType?: string,
    limit?: number,
    offset?: number
  ): Promise<FilesListResponse> {
    const body = await this.executeREST<{
      files: File[];
      total: number;
    }>('GET', FILES_LIST_PATH, {
      query: {
        file_type: fileType,
        limit,
        offset,
      },
    });
    return {
      files: body.files ?? [],
      total: body.total ?? 0,
    };
  }

  /** Delete project files via POST /secured/files/delete. */
  async deleteFiles(ids: string[]): Promise<DeleteFilesResponse> {
    if (!ids?.length) {
      throw new ValidationError('ids are required');
    }
    const body = await this.executeREST<DeleteFilesResponse>('POST', FILES_DELETE_PATH, {
      jsonBody: { ids },
      allowFailure: true,
    });
    const result: DeleteFilesResponse = {
      success: !!body.success,
      deleted_ids: body.deleted_ids ?? [],
      storage_failed: body.storage_failed,
      message: body.message,
    };
    if (!result.success && result.message) {
      throw new ValidationError(result.message);
    }
    return result;
  }

  /**
   * Get a single resource by model and ID
   */
  async getSingleResource(
    model: string,
    id: string,
    singlePageData: boolean = false
  ): Promise<DefaultDocumentStructure> {
    const query = `
      query GetSingleData($model: String, $_id: String!, $single_page_data: Boolean) {
        getSingleData(model: $model, _id: $_id, single_page_data: $single_page_data) {
          _key
          data
          meta {
            created_at
            updated_at
            status
            revision
            revision_at
          }
          id
          expire_at
          relation_doc_id
          type
        }
      }
    `;

    const variables = {
      model,
      _id: id,
      single_page_data: singlePageData,
    };

    const response = await this.executeGraphQL(query, variables);

    if (!response.data?.getSingleData) {
      throw new ValidationError('Resource not found');
    }

    return response.data.getSingleData;
  }

  /**
   * Search resources in a model
   */
  async searchResources(
    model: string,
    filter: Record<string, any> = {},
    aggregate: boolean = false
  ): Promise<SearchResult> {
    const query = `
      query GetModelData(
        $model: String!
        $page: Int
        $limit: Int
        $_key: JSON
        $where: JSON
        $search: String
      ) {
        getModelData(
          model: $model
          page: $page
          limit: $limit
          _key: $_key
          where: $where
          search: $search
        ) {
          results {
            id
            relation_doc_id
            data
            type
            expire_at
            meta {
              created_at
              updated_at
              status
              root_revision_id
            }
          }
          count
        }
      }
    `;

    // Only forward keys declared on the GraphQL operation (matches go-internal-sdk)
    const variables: Record<string, any> = { model };
    if (filter && typeof filter === 'object') {
      if (filter._key !== undefined) {
        variables._key = filter._key;
      }
      if (filter.page !== undefined) {
        variables.page = filter.page;
      }
      if (filter.limit !== undefined) {
        variables.limit = filter.limit;
      }
      if (filter.where !== undefined) {
        variables.where = filter.where;
      }
      if (filter.search !== undefined) {
        variables.search = filter.search;
      }
    }

    const response = await this.executeGraphQL(query, variables);

    if (!response.data?.getModelData) {
      throw new ValidationError('Invalid search response format');
    }

    return response.data.getModelData;
  }

  /**
   * Get related documents
   */
  async getRelationDocuments(
    id: string,
    connection: Record<string, any>
  ): Promise<SearchResult> {
    const query = `
      query GetModelData($model: String!, $page: Int, $limit: Int, $where: JSON, $search: String, $connection : ListAllDataDetailedOfAModelConnectionPayload) {
        getModelData(model: $model, page: $page, limit: $limit, where: $where, search: $search, connection: $connection) {
          results {
            id
            relation_doc_id
            data
            type
            expire_at
            meta {
              created_at
              updated_at
              status
              root_revision_id
            }
          }
          count
        }
      }
    `;

    const variables: Record<string, any> = {
      connection,
    };

    // Extract model from connection if available
    if (connection.model) {
      variables.model = connection.model;
    } else {
      throw new ValidationError('model is required in connection parameters');
    }

    // Add filter parameters if provided in connection
    if (connection.filter) {
      const filter = connection.filter;
      if (filter.page !== undefined) {
        variables.page = filter.page;
      }
      if (filter.limit !== undefined) {
        variables.limit = filter.limit;
      }
      if (filter.where !== undefined) {
        variables.where = filter.where;
      }
      if (filter.search !== undefined) {
        variables.search = filter.search;
      }
    }

    const response = await this.executeGraphQL(query, variables);

    if (!response.data?.getModelData) {
      throw new ValidationError('Invalid relation documents response format');
    }

    return response.data.getModelData;
  }

  /**
   * Create a new resource
   */
  async createNewResource(request: CreateAndUpdateRequest): Promise<DefaultDocumentStructure> {
    if (!request.model) {
      throw new ValidationError('model is required');
    }

    if (!request.payload) {
      throw new ValidationError('payload is required');
    }

    const query = `
      mutation CreateNewData($model: String!, $single_page_data: Boolean, $payload: JSON!, $connect: JSON) {
        upsertModelData(
          connect: $connect
          model_name: $model
          single_page_data: $single_page_data
          payload: $payload
        ) {
          id
          type
          data
          meta {
            created_at
            updated_at
            status
            revision
            revision_at
          }
        }
      }
    `;

    const variables: Record<string, any> = {
      model: request.model,
      payload: request.payload,
      single_page_data: request.singlePageData || false,
    };

    if (request.connect) {
      variables.connect = request.connect;
    }

    const response = await this.executeGraphQL(query, variables);

    if (!response.data?.upsertModelData) {
      throw new ValidationError('Invalid create response format');
    }

    return response.data.upsertModelData;
  }

  /**
   * Update an existing resource
   */
  async updateResource(request: CreateAndUpdateRequest): Promise<DefaultDocumentStructure> {
    if (!request.id) {
      throw new ValidationError('id is required');
    }

    if (!request.model) {
      throw new ValidationError('model is required');
    }

    if (!request.payload) {
      throw new ValidationError('payload is required');
    }

    const query = `
      mutation UpdateModelData($_id: String!, $model: String!, $single_page_data: Boolean, $force_update: Boolean, $payload: JSON!, $connect: JSON, $disconnect: JSON) {
        upsertModelData(
          connect: $connect
          model_name: $model
          single_page_data: $single_page_data
          force_update: $force_update
          disconnect: $disconnect
          _id: $_id
          payload: $payload
        ) {
          id
          type
          data
          meta {
            created_at
            updated_at
            status
            revision
            revision_at
          }
        }
      }
    `;

    const variables: Record<string, any> = {
      _id: request.id,
      model: request.model,
      payload: request.payload,
      single_page_data: request.singlePageData || false,
      force_update: request.forceUpdate || false,
    };

    if (request.connect) {
      variables.connect = request.connect;
    }
    if (request.disconnect) {
      variables.disconnect = request.disconnect;
    }

    const response = await this.executeGraphQL(query, variables);

    if (!response.data?.upsertModelData) {
      throw new ValidationError('Invalid update response format');
    }

    return response.data.upsertModelData;
  }

  /**
   * Delete a resource by model and ID
   */
  async deleteResource(model: string, id: string): Promise<void> {
    const query = `
      mutation DeleteData($model: String!, $_id: String!) {
        deleteModelData(model_name: $model, _id: $_id) {
          id
        }
      }
    `;

    const variables = {
      model,
      _id: id,
    };

    await this.executeGraphQL(query, variables);
  }

  /**
   * Debug is used to debug the plugin, you can pass data here to debug the plugin
   */
  async debug(stage: string, ...data: any[]): Promise<any> {
    const query = `
      mutation Debug($stage: String!, $data: JSON) {
        debug(stage: $stage, data: $data) {
          message
          data
        }
      }
    `;

    const variables = {
      stage,
      data,
    };

    const response = await this.executeGraphQL(query, variables);

    return response.data?.debug;
  }
}

/**
 * Factory function to create a new Apito client
 */
export function createClient(config: ClientConfig): ApitoClient {
  return new ApitoClient(config);
}
