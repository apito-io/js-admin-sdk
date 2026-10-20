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
  TenantCatalogPartnerOptions,
  GetTenantsResponse,
  SearchTenantsResponse,
  ProjectPlan,
  CreateTenantParams,
  UpdateTenantParams,
  MyTenant,
  LoginUserParams,
  CreateUserParams,
  UpdateUserParams,
  GoogleOAuthStateResponse,
  ClientRuntime,
  File,
  FilesListResponse,
  UploadFileParams,
  DeleteFilesResponse,
  ProjectTenantSubscription,
  ProjectTenantInvoice,
  ProjectPaymentProviders,
  SubmitCustomPaymentParams,
  UpdateProjectPaymentProvidersParams,
  ListTenantSubscribersResponse,
  ListTenantInvoicesResponse,
  CreateTenantSubscriptionParams,
  UpdateTenantSubscriptionParams,
  CreateTenantInvoiceParams,
  VerifyProjectPaymentParams,
  CancelTenantSubscriptionParams,
  CancelTenantSubscriptionGraphQLParams,
  ProPartner,
  PartnerProjectRate,
  InvoiceProfile,
  SearchPartnersResponse,
  CreatePartnerParams,
  UpdatePartnerParams,
} from './types';
import {
  FILES_DELETE_PATH,
  FILES_LIST_PATH,
  FILES_UPLOAD_PATH,
} from './filesPaths';
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

/** Engine origin without `/system/graphql` or `/secured/graphql` (project-payment REST). */
export function deriveSystemAPIBaseURL(graphqlURL: string): string {
  let u = graphqlURL.trim().replace(/\/$/, '');
  u = u.replace(/\/system\/graphql$/, '').replace(/\/secured\/graphql$/, '');
  return u.replace(/\/$/, '');
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
  private sessionCookie?: string;
  private projectId?: string;
  private tenantId?: string;

  constructor(config: ClientConfig) {
    this.baseURL = config.baseURL;
    this.restBaseURL =
      (config.restBaseURL ?? '').trim() || deriveRestBaseURL(config.baseURL);
    this.apiKey = (config.accessToken ?? config.apiKey ?? '').trim();
    this.bearerToken = config.bearerToken?.trim() || undefined;
    this.sessionCookie = config.sessionCookie?.trim() || undefined;
    this.projectId = config.projectId?.trim() || undefined;
    this.tenantId = config.tenantId?.trim() || undefined;

    if (!this.bearerToken && !this.apiKey && !this.sessionCookie) {
      throw new Error(
        'ClientConfig requires accessToken, apiKey, bearerToken, or sessionCookie'
      );
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
        const status = error.response?.status;
        const bodyMessage = error.response?.data?.message;
        const text =
          typeof bodyMessage === 'string' && bodyMessage.trim()
            ? bodyMessage
            : status === 401 || status === 403
              ? 'Token expired. Please login again.'
              : error.message;
        throw new ApitoError(text, 'HTTP_ERROR', status, error.response?.data);
      }
      throw error;
    }
  }

  private assertOperatorCredential(operation: string): void {
    const credential = (this.bearerToken || this.apiKey || '').trim();
    if (this.sessionCookie || credential.startsWith('apt_')) {
      return;
    }
    throw new ValidationError(
      `OPERATOR_CREDENTIAL_REQUIRED: ${operation} requires an apt_ operator token or console session`
    );
  }

  /** Project-payment REST is for the signed-in app user and for operators. Bootstrap `ak_` keys are rejected. */
  private assertProjectPaymentCredential(operation: string): void {
    const credential = (this.bearerToken || this.apiKey || '').trim();
    if (this.sessionCookie) return;
    if (credential && !credential.startsWith('ak_')) return;
    throw new ValidationError(
      `OPERATOR_CREDENTIAL_REQUIRED: ${operation} requires an app-user session or an apt_ operator token`
    );
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
  async generateTenantToken(
    tenantId: string,
    duration?: string,
    role?: string
  ): Promise<string> {
    this.assertOperatorCredential('generateTenantToken');
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

  private authHeaders(options?: {
    projectId?: string;
    tenantId?: string;
  }): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.sessionCookie) {
      headers.Cookie = this.sessionCookie;
    } else if (this.bearerToken) {
      // App-user JWT on /system/graphql: without X-Use-Cookies: false the
      // engine takes the console cookie path → "invalid Cookie header. Reload the page".
      headers.Authorization = `Bearer ${this.bearerToken}`;
      headers['X-Use-Cookies'] = 'false';
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
    const headers: Record<string, string | boolean> = {
      ...this.authHeaders(options),
    };
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
        const data = error.response?.data as {
          message?: unknown;
          error?: unknown;
        };
        const msg =
          typeof data?.message === 'string'
            ? data.message
            : typeof data?.error === 'string'
              ? data.error
              : error.message;
        throw new ApitoError(
          msg,
          'HTTP_ERROR',
          error.response?.status,
          error.response?.data
        );
      }
      throw error;
    }
  }

  /**
   * Project user login (system GraphQL `loginUser`). Password path: pass `password` and `email` or `phone` per project Authentication settings. Google OAuth path: `authMethod: 'google'` with `code` and `state` from the redirect; call `googleOAuthState(projectId)` before opening Google to obtain `state`. Native Facebook uses `authMethod: 'facebook_access_token'` with `accessToken`. Google/Facebook paths may auto-link a verified email to an existing user; handle engine errors `google email not verified`, `google account already linked to another user`, `multiple users matched this email`. On Cloudflare Workers v1, Google paths are unavailable; password login is supported.
   */
  async loginUser(params: LoginUserParams): Promise<LoginUserResponse> {
    const authMethod =
      (params.authMethod ?? 'general').trim().toLowerCase() || 'general';
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
        throw new ValidationError(
          'code and state are required for Google login'
        );
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
        throw new ValidationError(
          `code and state are required for ${authMethod} login`
        );
      }
      variables.code = code;
      variables.state = state;
    } else if (authMethod === 'google_id_token') {
      variables.auth_method = 'google_id_token';
      const idToken = (params.idToken ?? '').trim();
      if (!idToken) {
        throw new ValidationError(
          'id_token is required for google_id_token login'
        );
      }
      variables.id_token = idToken;
    } else if (authMethod === 'facebook_access_token') {
      variables.auth_method = 'facebook_access_token';
      const accessToken = (params.accessToken ?? '').trim();
      if (!accessToken) {
        throw new ValidationError(
          'access_token is required for Facebook token login'
        );
      }
      variables.access_token = accessToken;
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
      query LoginUser($project_id: String!, $tenant_id: String, $password: String, $auth_method: String, $email: String, $phone: String, $code: String, $state: String, $id_token: String, $access_token: String) {
        loginUser(project_id: $project_id, tenant_id: $tenant_id, password: $password, auth_method: $auth_method, email: $email, phone: $phone, code: $code, state: $state, id_token: $id_token, access_token: $access_token) {
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
  async oauthState(
    projectId: string,
    provider: string
  ): Promise<GoogleOAuthStateResponse> {
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
   * Pre-login project runtime for one platform. Posts `clientRuntime` only.
   * Extras are one-key objects, for example `[{ "min_corridor_m": "50" }]`.
   */
  async fetchClientRuntime(platform: string): Promise<ClientRuntime> {
    const query = `
      query ClientRuntime($platform: String!) {
        clientRuntime(platform: $platform) {
          platform
          min_version_name
          min_build_number
          force_update
          store_url
          message_en
          message_bn
          maintenance
          maintenance_hours
          extras
        }
      }
    `;
    const response = await this.executeGraphQL(query, { platform });
    const raw = response.data?.clientRuntime;
    if (!raw || typeof raw !== 'object') {
      throw new ValidationError('Invalid response format for clientRuntime');
    }
    const extras = Array.isArray(raw.extras)
      ? raw.extras.filter((item): item is Record<string, string> => !!item && typeof item === 'object')
      : [];
    return {
      platform: String(raw.platform ?? platform),
      min_version_name: String(raw.min_version_name ?? '0.0.0'),
      min_build_number: Number(raw.min_build_number ?? 0) || 0,
      force_update: raw.force_update === true,
      store_url: String(raw.store_url ?? ''),
      message_en: String(raw.message_en ?? ''),
      message_bn: String(raw.message_bn ?? ''),
      maintenance: raw.maintenance === true,
      maintenance_hours: Number(raw.maintenance_hours ?? 0) || 0,
      extras,
    };
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
    this.assertOperatorCredential('searchUsers');
    const query = `
      query SearchUsers($project_id: String!, $limit: Int, $offset: Int, $tenant_id: String, $q: String) {
        searchUsers(project_id: $project_id, limit: $limit, offset: $offset, tenant_id: $tenant_id, q: $q) {
          count
          users {
            id
            email
            phone
            username
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
   * Client apps omit `includePartner`. Console / Udbhabon Admin pass `{ includePartner: true }`.
   */
  async searchTenantsByDomain(
    projectId: string,
    domain: string,
    options?: TenantCatalogPartnerOptions
  ): Promise<TenantByDomainResponse> {
    const includePartner = Boolean(options?.includePartner);
    const query = `
      query SearchTenantsByDomain($project_id: String!, $domain: String!) {
        searchTenantsByDomain(project_id: $project_id, domain: $domain) {
          tenant {
            id
            name
            status
            domain
            plan_tier
            ${includePartner ? 'partner_id' : ''}
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
      throw new ValidationError(
        'Invalid response format for searchTenantsByDomain'
      );
    }
    const tenant = (raw.tenant ?? null) as TenantCatalogSearchRow | null;
    return { tenant };
  }

  /**
   * Search SaaS catalog tenants with optional text filter, status filter, and pagination (system GraphQL only).
   * status: active (default), deleted, or all.
   * Client apps omit `includePartner`. Console / Udbhabon Admin pass `{ includePartner: true }`.
   */
  async searchTenants(
    projectId: string,
    limit?: number,
    offset?: number,
    q?: string,
    status?: string,
    options?: TenantCatalogPartnerOptions
  ): Promise<SearchTenantsResponse> {
    this.assertOperatorCredential('searchTenants');
    const includePartner = Boolean(options?.includePartner);
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
            ${includePartner ? 'partner_id' : ''}
            suspended_at
            suspension_reason
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
    status?: string,
    options?: TenantCatalogPartnerOptions
  ): Promise<TenantCatalogSearchRow | null> {
    const pid = (projectId ?? '').trim();
    const tid = (tenantId ?? '').trim();
    if (!pid) {
      throw new ValidationError('projectId is required');
    }
    if (!tid) {
      throw new ValidationError('tenantId is required');
    }
    const { tenants } = await this.searchTenants(
      pid,
      5,
      0,
      tid,
      status ?? 'active',
      options
    );
    if (!Array.isArray(tenants)) {
      return null;
    }
    return tenants.find((row) => row?.id?.trim() === tid) ?? null;
  }

  /** List SaaS catalog tenants for the authenticated project (system GraphQL only). */
  async getTenants(
    options?: TenantCatalogPartnerOptions
  ): Promise<GetTenantsResponse> {
    this.assertOperatorCredential('getTenants');
    const includePartner = Boolean(options?.includePartner);
    const query = `
      query GetTenants {
        getTenants {
          tenants {
            id
            name
            domain
            plan_tier
            ${includePartner ? 'partner_id' : ''}
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
  async createTenant(
    params: CreateTenantParams
  ): Promise<TenantCatalogSearchRow> {
    this.assertOperatorCredential('createTenant');
    const name = (params.name ?? '').trim();
    if (!name) {
      throw new ValidationError('name is required');
    }
    const partnerId = (params.partnerId ?? '').trim();
    const includePartner = Boolean(partnerId);
    const query = includePartner
      ? `
      mutation CreateTenant($name: String!, $data: String, $domain: String, $plan_tier: String, $partner_id: String) {
        createTenant(name: $name, data: $data, domain: $domain, plan_tier: $plan_tier, partner_id: $partner_id) {
          id
          name
          status
          domain
          plan_tier
          partner_id
          data
        }
      }
    `
      : `
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
    if (includePartner) variables.partner_id = partnerId;
    const response = await this.executeGraphQL(query, variables);
    const row = response.data?.createTenant as
      TenantCatalogSearchRow | undefined;
    if (!row?.id) {
      throw new ValidationError('Invalid response format for createTenant');
    }
    return row;
  }

  /** Update catalog tenant name/data/domain (not plan_tier — ledger-driven). */
  async updateTenant(
    tenantId: string,
    params: UpdateTenantParams
  ): Promise<TenantCatalogSearchRow> {
    this.assertOperatorCredential('updateTenant');
    const tid = (tenantId ?? '').trim();
    if (!tid) {
      throw new ValidationError('tenantId is required');
    }
    if (params.planTier !== undefined) {
      throw new ValidationError(
        'planTier cannot be set via updateTenant; use createTenantSubscription / cancelTenantSubscription or Play verify'
      );
    }
    if (
      params.name === undefined &&
      params.data === undefined &&
      params.domain === undefined &&
      params.partnerId === undefined
    ) {
      throw new ValidationError('at least one field must be provided');
    }
    const includePartner = params.partnerId !== undefined;
    const query = includePartner
      ? `
      mutation UpdateTenant($tenant_id: String!, $name: String, $data: String, $domain: String, $partner_id: String) {
        updateTenant(tenant_id: $tenant_id, name: $name, data: $data, domain: $domain, partner_id: $partner_id) {
          id
          name
          status
          domain
          plan_tier
          partner_id
          data
        }
      }
    `
      : `
      mutation UpdateTenant($tenant_id: String!, $name: String, $data: String, $domain: String) {
        updateTenant(tenant_id: $tenant_id, name: $name, data: $data, domain: $domain) {
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
    if (includePartner) variables.partner_id = params.partnerId;
    const response = await this.executeGraphQL(query, variables);
    const row = response.data?.updateTenant as
      TenantCatalogSearchRow | undefined;
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
    const response = await this.executeGraphQL(
      MY_EFFECTIVE_PERMISSIONS_QUERY,
      {}
    );
    const raw = response.data?.myEffectivePermissions as
      EffectivePermissionsSnapshot | null | undefined;
    if (!raw || typeof raw !== 'object') {
      throw new ValidationError(
        'Invalid response format for myEffectivePermissions'
      );
    }
    return raw;
  }

  /** Restore a soft-deleted catalog tenant (status=active). Content, owner, and relations stay. */
  async restoreTenant(tenantId: string): Promise<boolean> {
    this.assertOperatorCredential('restoreTenant');
    const tid = (tenantId ?? '').trim();
    if (!tid) {
      throw new ValidationError('tenantId is required');
    }
    const query = `
      mutation RestoreTenant($tenant_id: String!) {
        restoreTenant(tenant_id: $tenant_id)
      }
    `;
    const response = await this.executeGraphQL(query, { tenant_id: tid });
    const ok = response.data?.restoreTenant;
    if (typeof ok !== 'boolean') {
      throw new ValidationError('Invalid response format for restoreTenant');
    }
    return ok;
  }

  /** Soft-delete a catalog tenant row (status=deleted). Content and mirror remain until Console hard delete. */
  async deleteTenant(tenantId: string): Promise<boolean> {
    this.assertOperatorCredential('deleteTenant');
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

  /** Suspend a tenant. Shop API and login treat it as not active. Reason `banned` is the ban label. */
  async suspendTenant(tenantId: string, reason?: string): Promise<boolean> {
    this.assertOperatorCredential('suspendTenant');
    const tid = (tenantId ?? '').trim();
    if (!tid) {
      throw new ValidationError('tenantId is required');
    }
    const query = `
      mutation SuspendTenant($tenant_id: String!, $reason: String) {
        suspendTenant(tenant_id: $tenant_id, reason: $reason) { id }
      }
    `;
    const response = await this.executeGraphQL(query, {
      tenant_id: tid,
      reason: (reason ?? '').trim() || 'suspended',
    });
    const row = response.data?.suspendTenant as { id?: string } | undefined;
    if (!row?.id) {
      throw new ValidationError('Invalid response format for suspendTenant');
    }
    return true;
  }

  async unsuspendTenant(tenantId: string): Promise<boolean> {
    this.assertOperatorCredential('unsuspendTenant');
    const tid = (tenantId ?? '').trim();
    if (!tid) {
      throw new ValidationError('tenantId is required');
    }
    const query = `
      mutation UnsuspendTenant($tenant_id: String!) {
        unsuspendTenant(tenant_id: $tenant_id) { id }
      }
    `;
    const response = await this.executeGraphQL(query, { tenant_id: tid });
    const row = response.data?.unsuspendTenant as { id?: string } | undefined;
    if (!row?.id) {
      throw new ValidationError('Invalid response format for unsuspendTenant');
    }
    return true;
  }

  /**
   * Create a project user (local password). Use `email` and/or `phone` per engine validation for the project identifier mode. Engine errors: `email already exists for this project`, `phone already exists for this project`.
   */
  async createUser(projectId: string, params: CreateUserParams): Promise<User> {
    this.assertOperatorCredential('createUser');
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
    this.assertOperatorCredential('updateUser');
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
    this.assertOperatorCredential('resetUserPassword');
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
    const response = await this.executeGraphQL(query, {
      user_id: uid,
      password,
    });
    const ok = response.data?.resetUserPassword;
    if (typeof ok !== 'boolean') {
      throw new ValidationError(
        'Invalid response format for resetUserPassword'
      );
    }
    return ok;
  }

  /**
   * Delete a project user by id. Project scope is implied by the API key.
   */
  async deleteUser(userId: string): Promise<boolean> {
    this.assertOperatorCredential('deleteUser');
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
      params.content instanceof ArrayBuffer
        ? new Uint8Array(params.content)
        : params.content;
    const blob = new Blob([bytes as BlobPart]);
    form.append('file', blob, fileName);
    if (params.fileType?.trim()) {
      form.append('file_type', params.fileType.trim());
    }
    const body = await this.executeREST<{ file: File }>(
      'POST',
      FILES_UPLOAD_PATH,
      {
        formData: form,
      }
    );
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
    const body = await this.executeREST<DeleteFilesResponse>(
      'POST',
      FILES_DELETE_PATH,
      {
        jsonBody: { ids },
        allowFailure: true,
      }
    );
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
    this.assertOperatorCredential('getSingleResource');
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
    this.assertOperatorCredential('searchResources');
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
    this.assertOperatorCredential('getRelationDocuments');

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
  async createNewResource(
    request: CreateAndUpdateRequest
  ): Promise<DefaultDocumentStructure> {
    if (!request.model) {
      throw new ValidationError('model is required');
    }

    if (!request.payload) {
      throw new ValidationError('payload is required');
    }
    this.assertOperatorCredential('createNewResource');

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
  async updateResource(
    request: CreateAndUpdateRequest
  ): Promise<DefaultDocumentStructure> {
    if (!request.id) {
      throw new ValidationError('id is required');
    }

    if (!request.model) {
      throw new ValidationError('model is required');
    }

    if (!request.payload) {
      throw new ValidationError('payload is required');
    }
    this.assertOperatorCredential('updateResource');

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
    this.assertOperatorCredential('deleteResource');
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
    this.assertOperatorCredential('debug');
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

  private async executeProjectPayment<T>(
    method: 'GET' | 'POST',
    path: string,
    options?: {
      jsonBody?: Record<string, unknown>;
      projectId?: string;
      tenantId?: string;
    }
  ): Promise<T> {
    this.assertProjectPaymentCredential('projectPayment');
    const base = deriveSystemAPIBaseURL(this.baseURL);
    const url = `${base.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
    const headers: Record<string, string> = {
      ...this.authHeaders(options),
      'Content-Type': 'application/json',
    };
    try {
      const response = await this.httpClient.request({
        method,
        url,
        headers,
        data: options?.jsonBody,
      });
      return response.data as T;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const data = error.response?.data as {
          message?: unknown;
          error?: unknown;
        };
        const msg =
          typeof data?.message === 'string'
            ? data.message
            : typeof data?.error === 'string'
              ? data.error
              : error.message;
        throw new ApitoError(
          msg,
          'HTTP_ERROR',
          error.response?.status,
          error.response?.data
        );
      }
      throw error;
    }
  }

  private static readonly TENANT_SUBSCRIPTION_FIELDS = `
    id project_id tenant_id plan_tier provider status
    billing_contact_user_id external_subscription_id product_id
    current_period_start current_period_end billing_interval_months cancel_at
    created_by notes partner_id manage_url created_at updated_at
  `;

  private static readonly TENANT_INVOICE_FIELDS = `
    id subscription_id project_id tenant_id amount currency status
    provider billing_purpose notes issued_at paid_at created_at
  `;

  /** Manual / cash tenant subscription (system GraphQL). Sets `plan_tier` on the catalog tenant. */
  async createTenantSubscription(
    params: CreateTenantSubscriptionParams
  ): Promise<ProjectTenantSubscription> {
    this.assertOperatorCredential('createTenantSubscription');
    const tenantId = (params.tenantId ?? '').trim();
    const planTier = (params.planTier ?? '').trim();
    if (!tenantId) {
      throw new ValidationError('tenantId is required');
    }
    if (!planTier) {
      throw new ValidationError('planTier is required');
    }
    const query = `
      mutation CreateTenantSubscription(
        $tenant_id: String!
        $plan_tier: String!
        $billing_contact_user_id: String
        $notes: String
        $issue_invoice: Boolean
        $amount: Float
        $currency: String
        $billing_purpose: String
        $partner_id: String
        $billing_interval_months: Int
      ) {
        createTenantSubscription(
          tenant_id: $tenant_id
          plan_tier: $plan_tier
          billing_contact_user_id: $billing_contact_user_id
          notes: $notes
          issue_invoice: $issue_invoice
          amount: $amount
          currency: $currency
          billing_purpose: $billing_purpose
          partner_id: $partner_id
          billing_interval_months: $billing_interval_months
        ) {
          ${ApitoClient.TENANT_SUBSCRIPTION_FIELDS}
        }
      }
    `;
    const variables: Record<string, unknown> = {
      tenant_id: tenantId,
      plan_tier: planTier,
    };
    const bc = (params.billingContactUserId ?? '').trim();
    if (bc) variables.billing_contact_user_id = bc;
    const notes = (params.notes ?? '').trim();
    if (notes) variables.notes = notes;
    if (params.issueInvoice !== undefined)
      variables.issue_invoice = params.issueInvoice;
    if (params.amount !== undefined) variables.amount = params.amount;
    const currency = (params.currency ?? '').trim();
    if (currency) variables.currency = currency;
    const purpose = (params.billingPurpose ?? '').trim();
    if (purpose) variables.billing_purpose = purpose;
    const partnerId = (params.partnerId ?? '').trim();
    if (partnerId) variables.partner_id = partnerId;
    if (params.billingIntervalMonths !== undefined) {
      variables.billing_interval_months = params.billingIntervalMonths;
    }
    const response = await this.executeGraphQL(query, variables, { tenantId });
    const row = response.data?.createTenantSubscription as
      ProjectTenantSubscription | undefined;
    if (!row?.id) {
      throw new ValidationError(
        'Invalid response format for createTenantSubscription'
      );
    }
    return row;
  }

  async updateTenantSubscription(
    params: UpdateTenantSubscriptionParams
  ): Promise<ProjectTenantSubscription> {
    this.assertOperatorCredential('updateTenantSubscription');
    const subscriptionId = (params.subscriptionId ?? '').trim();
    if (!subscriptionId) {
      throw new ValidationError('subscriptionId is required');
    }
    const query = `
      mutation UpdateTenantSubscription(
        $subscription_id: String!
        $plan_tier: String
        $status: String
        $billing_contact_user_id: String
        $notes: String
        $partner_id: String
        $current_period_end: String
        $billing_interval_months: Int
      ) {
        updateTenantSubscription(
          subscription_id: $subscription_id
          plan_tier: $plan_tier
          status: $status
          billing_contact_user_id: $billing_contact_user_id
          notes: $notes
          partner_id: $partner_id
          current_period_end: $current_period_end
          billing_interval_months: $billing_interval_months
        ) {
          ${ApitoClient.TENANT_SUBSCRIPTION_FIELDS}
        }
      }
    `;
    const variables: Record<string, unknown> = {
      subscription_id: subscriptionId,
    };
    const planTier = (params.planTier ?? '').trim();
    if (planTier) variables.plan_tier = planTier;
    const status = (params.status ?? '').trim();
    if (status) variables.status = status;
    const bc = (params.billingContactUserId ?? '').trim();
    if (bc) variables.billing_contact_user_id = bc;
    if (params.notes !== undefined) variables.notes = params.notes;
    if (params.partnerId !== undefined) {
      variables.partner_id = params.partnerId.trim();
    }
    if (params.currentPeriodEnd !== undefined) {
      variables.current_period_end = params.currentPeriodEnd.trim();
    }
    if (params.billingIntervalMonths !== undefined) {
      variables.billing_interval_months = params.billingIntervalMonths;
    }
    const response = await this.executeGraphQL(query, variables);
    const row = response.data?.updateTenantSubscription as
      ProjectTenantSubscription | undefined;
    if (!row?.id) {
      throw new ValidationError(
        'Invalid response format for updateTenantSubscription'
      );
    }
    return row;
  }

  /**
   * Cancel a tenant SaaS subscription.
   * - REST (Play/Paddle): pass `projectId` + `tenantId`.
   * - GraphQL (manual/cash ledger): pass only `subscriptionId`.
   */
  async cancelTenantSubscription(
    params:
      CancelTenantSubscriptionParams | CancelTenantSubscriptionGraphQLParams
  ): Promise<ProjectTenantSubscription> {
    this.assertOperatorCredential('cancelTenantSubscription');
    if ('projectId' in params && (params.projectId ?? '').trim()) {
      return this.cancelTenantSubscriptionRest(params);
    }
    const gql = params as CancelTenantSubscriptionGraphQLParams;
    const subscriptionId = (gql.subscriptionId ?? '').trim();
    if (!subscriptionId) {
      throw new ValidationError('subscriptionId is required');
    }
    const query = `
      mutation CancelTenantSubscription(
        $subscription_id: String!
        $mode: String
        $force_ledger_only: Boolean
      ) {
        cancelTenantSubscription(
          subscription_id: $subscription_id
          mode: $mode
          force_ledger_only: $force_ledger_only
        ) {
          ${ApitoClient.TENANT_SUBSCRIPTION_FIELDS}
        }
      }
    `;
    const variables: Record<string, unknown> = {
      subscription_id: subscriptionId,
    };
    const mode = (gql.mode ?? '').trim();
    if (mode) variables.mode = mode;
    if (gql.forceLedgerOnly !== undefined)
      variables.force_ledger_only = gql.forceLedgerOnly;
    const response = await this.executeGraphQL(query, variables);
    const row = response.data?.cancelTenantSubscription as
      ProjectTenantSubscription | undefined;
    if (!row?.id) {
      throw new ValidationError(
        'Invalid response format for cancelTenantSubscription'
      );
    }
    return row;
  }

  async createTenantInvoice(
    params: CreateTenantInvoiceParams
  ): Promise<ProjectTenantInvoice> {
    this.assertOperatorCredential('createTenantInvoice');
    const subscriptionId = (params.subscriptionId ?? '').trim();
    if (!subscriptionId) {
      throw new ValidationError('subscriptionId is required');
    }
    if (params.amount == null || Number.isNaN(params.amount)) {
      throw new ValidationError('amount is required');
    }
    const query = `
      mutation CreateTenantInvoice(
        $subscription_id: String!
        $amount: Float!
        $currency: String
        $status: String
        $provider: String
        $notes: String
        $billing_purpose: String
      ) {
        createTenantInvoice(
          subscription_id: $subscription_id
          amount: $amount
          currency: $currency
          status: $status
          provider: $provider
          notes: $notes
          billing_purpose: $billing_purpose
        ) {
          ${ApitoClient.TENANT_INVOICE_FIELDS}
        }
      }
    `;
    const variables: Record<string, unknown> = {
      subscription_id: subscriptionId,
      amount: params.amount,
    };
    const currency = (params.currency ?? '').trim();
    if (currency) variables.currency = currency;
    const status = (params.status ?? '').trim();
    if (status) variables.status = status;
    const provider = (params.provider ?? '').trim();
    if (provider) variables.provider = provider;
    const notes = (params.notes ?? '').trim();
    if (notes) variables.notes = notes;
    const purpose = (params.billingPurpose ?? '').trim();
    if (purpose) variables.billing_purpose = purpose;
    const response = await this.executeGraphQL(query, variables);
    const row = response.data?.createTenantInvoice as
      ProjectTenantInvoice | undefined;
    if (!row?.id) {
      throw new ValidationError(
        'Invalid response format for createTenantInvoice'
      );
    }
    return row;
  }

  async listTenantSubscribers(params?: {
    payingOnly?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<ListTenantSubscribersResponse> {
    this.assertOperatorCredential('listTenantSubscribers');
    const query = `
      query ListTenantSubscribers($paying_only: Boolean, $limit: Int, $offset: Int) {
        listTenantSubscribers(paying_only: $paying_only, limit: $limit, offset: $offset) {
          total
          subscriptions {
            ${ApitoClient.TENANT_SUBSCRIPTION_FIELDS}
          }
        }
      }
    `;
    const variables: Record<string, unknown> = {};
    if (params?.payingOnly !== undefined)
      variables.paying_only = params.payingOnly;
    if (params?.limit !== undefined) variables.limit = params.limit;
    if (params?.offset !== undefined) variables.offset = params.offset;
    const response = await this.executeGraphQL(query, variables);
    const raw = response.data?.listTenantSubscribers as
      | { total?: number; subscriptions?: ProjectTenantSubscription[] }
      | undefined;
    if (!raw) {
      throw new ValidationError(
        'Invalid response format for listTenantSubscribers'
      );
    }
    return {
      total: typeof raw.total === 'number' ? raw.total : 0,
      subscriptions: raw.subscriptions ?? [],
    };
  }

  async listTenantInvoices(params?: {
    subscriptionId?: string;
    limit?: number;
    offset?: number;
  }): Promise<ListTenantInvoicesResponse> {
    this.assertOperatorCredential('listTenantInvoices');
    const query = `
      query ListTenantInvoices($subscription_id: String, $limit: Int, $offset: Int) {
        listTenantInvoices(subscription_id: $subscription_id, limit: $limit, offset: $offset) {
          total
          invoices {
            ${ApitoClient.TENANT_INVOICE_FIELDS}
          }
        }
      }
    `;
    const variables: Record<string, unknown> = {};
    const sid = (params?.subscriptionId ?? '').trim();
    if (sid) variables.subscription_id = sid;
    if (params?.limit !== undefined) variables.limit = params.limit;
    if (params?.offset !== undefined) variables.offset = params.offset;
    const response = await this.executeGraphQL(query, variables);
    const raw = response.data?.listTenantInvoices as
      { total?: number; invoices?: ProjectTenantInvoice[] } | undefined;
    if (!raw) {
      throw new ValidationError(
        'Invalid response format for listTenantInvoices'
      );
    }
    return {
      total: typeof raw.total === 'number' ? raw.total : 0,
      invoices: raw.invoices ?? [],
    };
  }

  async getProjectPlans(): Promise<ProjectPlan[]> {
    this.assertOperatorCredential('getProjectPlans');
    const query = `
      query GetProjectPlans {
        getProjectPlans {
          id
          name
          description
          currency
          price_monthly
          quotas
          provider_products
        }
      }
    `;
    const response = await this.executeGraphQL(query, {});
    const rows = response.data?.getProjectPlans as ProjectPlan[] | undefined;
    return (rows ?? []).filter((row) => Boolean(row?.id));
  }

  /** Download the Apito receipt PDF. Header comes from the workspace invoice profile. */
  async downloadInvoiceReceipt(
    projectId: string,
    invoiceId: string
  ): Promise<ArrayBuffer> {
    this.assertProjectPaymentCredential('downloadInvoiceReceipt');
    const pid = (projectId ?? '').trim();
    const iid = (invoiceId ?? '').trim();
    if (!pid || !iid) {
      throw new ValidationError('projectId and invoiceId are required');
    }
    const base = deriveSystemAPIBaseURL(this.baseURL);
    const url = `${base}/system/v1/project-payment/projects/${encodeURIComponent(pid)}/invoices/${encodeURIComponent(iid)}/receipt.pdf`;
    const response = await this.httpClient.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer',
    });
    return response.data;
  }

  /** Flip an issued invoice to paid on the same row. */
  async markInvoicePaid(invoiceId: string): Promise<ProjectTenantInvoice> {
    this.assertOperatorCredential('markInvoicePaid');
    const id = (invoiceId ?? '').trim();
    if (!id) {
      throw new ValidationError('invoiceId is required');
    }
    const query = `
      mutation MarkInvoicePaid($invoice_id: String!) {
        markInvoicePaid(invoice_id: $invoice_id) {
          ${ApitoClient.TENANT_INVOICE_FIELDS}
        }
      }
    `;
    const response = await this.executeGraphQL(query, { invoice_id: id });
    const row = response.data?.markInvoicePaid as
      ProjectTenantInvoice | undefined;
    if (!row?.id) {
      throw new ValidationError('Invalid response format for markInvoicePaid');
    }
    return row;
  }

  async getInvoiceProfile(): Promise<InvoiceProfile> {
    this.assertOperatorCredential('getInvoiceProfile');
    const query = `
      query GetInvoiceProfile {
        getInvoiceProfile {
          organization_id legal_name logo_url address phone extra_lines updated_at
        }
      }
    `;
    const response = await this.executeGraphQL(query, {});
    const row = response.data?.getInvoiceProfile as InvoiceProfile | undefined;
    return row ?? {};
  }

  async updateInvoiceProfile(params: {
    legalName?: string;
    logoUrl?: string;
    address?: string;
    phone?: string;
    extraLines?: string;
  }): Promise<InvoiceProfile> {
    this.assertOperatorCredential('updateInvoiceProfile');
    const query = `
      mutation UpdateInvoiceProfile(
        $legal_name: String
        $logo_url: String
        $address: String
        $phone: String
        $extra_lines: String
      ) {
        updateInvoiceProfile(
          legal_name: $legal_name
          logo_url: $logo_url
          address: $address
          phone: $phone
          extra_lines: $extra_lines
        ) {
          organization_id legal_name logo_url address phone extra_lines updated_at
        }
      }
    `;
    const response = await this.executeGraphQL(query, {
      legal_name: params.legalName,
      logo_url: params.logoUrl,
      address: params.address,
      phone: params.phone,
      extra_lines: params.extraLines,
    });
    const row = response.data?.updateInvoiceProfile as
      InvoiceProfile | undefined;
    if (!row) {
      throw new ValidationError(
        'Invalid response format for updateInvoiceProfile'
      );
    }
    return row;
  }

  async getProjectPaymentProviders(): Promise<ProjectPaymentProviders> {
    this.assertOperatorCredential('getProjectPaymentProviders');
    const query = `
      query GetProjectPaymentProviders {
        getProjectPaymentProviders {
          project_id
          google_play
          paddle
          custom
          webhook_urls
          updated_at
        }
      }
    `;
    const response = await this.executeGraphQL(query, {});
    const raw = response.data?.getProjectPaymentProviders as
      ProjectPaymentProviders | undefined;
    if (!raw) {
      throw new ValidationError(
        'Invalid response format for getProjectPaymentProviders'
      );
    }
    return raw;
  }

  async updateProjectPaymentProviders(
    params: UpdateProjectPaymentProvidersParams
  ): Promise<ProjectPaymentProviders> {
    this.assertOperatorCredential('updateProjectPaymentProviders');
    const query = `
      mutation UpdateProjectPaymentProviders($google_play: JSON, $paddle: JSON, $custom: JSON) {
        updateProjectPaymentProviders(google_play: $google_play, paddle: $paddle, custom: $custom) {
          project_id
          google_play
          paddle
          custom
          webhook_urls
          updated_at
        }
      }
    `;
    const variables: Record<string, unknown> = {};
    if (params.googlePlay !== undefined) variables.google_play = params.googlePlay;
    if (params.paddle !== undefined) variables.paddle = params.paddle;
    if (params.custom !== undefined) variables.custom = params.custom;
    const response = await this.executeGraphQL(query, variables);
    const raw = response.data?.updateProjectPaymentProviders as
      ProjectPaymentProviders | undefined;
    if (!raw) {
      throw new ValidationError(
        'Invalid response format for updateProjectPaymentProviders'
      );
    }
    return raw;
  }

  /**
   * Signed-in Custom payment. Returns the subscription when the project creates one.
   * An accepted webhook with subscriber creation off returns null.
   */
  async submitCustomPayment(
    params: SubmitCustomPaymentParams
  ): Promise<ProjectTenantSubscription | null> {
    const projectId = params.projectId.trim();
    const tenantId = params.tenantId.trim();
    if (!projectId || !tenantId) {
      throw new ValidationError('projectId and tenantId are required');
    }
    const path = `/system/v1/project-payment/projects/${encodeURIComponent(projectId)}/providers/custom/submit`;
    const row = await this.executeProjectPayment<ProjectTenantSubscription>(
      'POST',
      path,
      {
        jsonBody: {
          email: params.email ?? '',
          plan: params.plan,
          amount: params.amount,
          currency: params.currency,
          period_months: params.periodMonths,
          tenant_id: tenantId,
          payment_reference: params.paymentReference,
        },
        projectId,
        tenantId,
      }
    );
    if (!row?.id) return null;
    return row;
  }

  /** Invoices for the signed-in tenant. Operator listing stays on `listTenantInvoices`. */
  async listSignedInTenantInvoices(
    projectId: string,
    tenantId: string
  ): Promise<ProjectTenantInvoice[]> {
    const pid = projectId.trim();
    const tid = tenantId.trim();
    if (!pid || !tid) {
      throw new ValidationError('projectId and tenantId are required');
    }
    const path = `/system/v1/project-payment/projects/${encodeURIComponent(pid)}/tenants/${encodeURIComponent(tid)}/invoices`;
    const row = await this.executeProjectPayment<{
      invoices?: ProjectTenantInvoice[];
    }>('GET', path, { projectId: pid, tenantId: tid });
    return row.invoices ?? [];
  }

  private static readonly PARTNER_FIELDS = `
    id organization_id name email phone avatar_url status is_default commission_percent created_at updated_at
  `;

  /** Workspace-global partner catalog (not per-project). */
  async searchPartners(params?: {
    q?: string;
    limit?: number;
    offset?: number;
  }): Promise<SearchPartnersResponse> {
    this.assertOperatorCredential('searchPartners');
    const query = `
      query SearchPartners($q: String, $limit: Int, $offset: Int) {
        searchPartners(q: $q, limit: $limit, offset: $offset) {
          total
          results { ${ApitoClient.PARTNER_FIELDS} }
        }
      }
    `;
    const variables: Record<string, unknown> = {};
    const q = (params?.q ?? '').trim();
    if (q) variables.q = q;
    if (params?.limit !== undefined) variables.limit = params.limit;
    if (params?.offset !== undefined) variables.offset = params.offset;
    const response = await this.executeGraphQL(query, variables);
    const raw = response.data?.searchPartners as
      SearchPartnersResponse | undefined;
    if (!raw) {
      throw new ValidationError('Invalid response format for searchPartners');
    }
    return {
      results: (raw.results ?? []) as ProPartner[],
      total: typeof raw.total === 'number' ? raw.total : 0,
    };
  }

  async createPartner(params: CreatePartnerParams): Promise<ProPartner> {
    this.assertOperatorCredential('createPartner');
    const email = (params.email ?? '').trim().toLowerCase();
    if (!email) {
      throw new ValidationError('email is required');
    }
    const name = (params.name ?? '').trim() || email;
    const query = `
      mutation CreatePartner($name: String, $email: String!, $phone: String, $avatar_url: String, $status: String, $commission_percent: Int) {
        createPartner(name: $name, email: $email, phone: $phone, avatar_url: $avatar_url, status: $status, commission_percent: $commission_percent) {
          ${ApitoClient.PARTNER_FIELDS}
        }
      }
    `;
    const variables: Record<string, unknown> = { name, email };
    if (params.phone !== undefined) variables.phone = params.phone.trim();
    if (params.avatarUrl !== undefined)
      variables.avatar_url = params.avatarUrl.trim();
    const status = (params.status ?? '').trim();
    if (status) variables.status = status;
    if (params.commissionPercent !== undefined) {
      variables.commission_percent = params.commissionPercent;
    }
    const response = await this.executeGraphQL(query, variables);
    const row = response.data?.createPartner as ProPartner | undefined;
    if (!row?.id) {
      throw new ValidationError('Invalid response format for createPartner');
    }
    return row;
  }

  async updatePartner(
    id: string,
    params: UpdatePartnerParams
  ): Promise<ProPartner> {
    this.assertOperatorCredential('updatePartner');
    const pid = (id ?? '').trim();
    if (!pid) {
      throw new ValidationError('id is required');
    }
    if (
      params.name === undefined &&
      params.email === undefined &&
      params.phone === undefined &&
      params.avatarUrl === undefined &&
      params.status === undefined &&
      params.commissionPercent === undefined
    ) {
      throw new ValidationError('at least one field must be provided');
    }
    const query = `
      mutation UpdatePartner($id: String!, $name: String, $email: String, $phone: String, $avatar_url: String, $status: String, $commission_percent: Int) {
        updatePartner(id: $id, name: $name, email: $email, phone: $phone, avatar_url: $avatar_url, status: $status, commission_percent: $commission_percent) {
          ${ApitoClient.PARTNER_FIELDS}
        }
      }
    `;
    const variables: Record<string, unknown> = { id: pid };
    if (params.name !== undefined) variables.name = params.name;
    if (params.email !== undefined) variables.email = params.email;
    if (params.phone !== undefined) variables.phone = params.phone.trim();
    if (params.avatarUrl !== undefined)
      variables.avatar_url = params.avatarUrl.trim();
    if (params.status !== undefined) variables.status = params.status;
    if (params.commissionPercent !== undefined) {
      variables.commission_percent = params.commissionPercent;
    }
    const response = await this.executeGraphQL(query, variables);
    const row = response.data?.updatePartner as ProPartner | undefined;
    if (!row?.id) {
      throw new ValidationError('Invalid response format for updatePartner');
    }
    return row;
  }

  async listPartnerProjectRates(params?: {
    partnerId?: string;
    projectId?: string;
  }): Promise<PartnerProjectRate[]> {
    this.assertOperatorCredential('listPartnerProjectRates');
    const query = `
      query ListPartnerProjectRates($partner_id: String, $project_id: String) {
        listPartnerProjectRates(partner_id: $partner_id, project_id: $project_id) {
          partner_id project_id organization_id commission_percent active
        }
      }
    `;
    const variables: Record<string, unknown> = {};
    const partnerId = (params?.partnerId ?? '').trim();
    const projectId = (params?.projectId ?? '').trim();
    if (partnerId) variables.partner_id = partnerId;
    if (projectId) variables.project_id = projectId;
    const response = await this.executeGraphQL(query, variables);
    const rows = response.data?.listPartnerProjectRates as
      PartnerProjectRate[] | undefined;
    return rows ?? [];
  }

  async upsertPartnerProjectRate(params: {
    partnerId: string;
    projectId: string;
    commissionPercent?: number;
    active?: boolean;
    clear?: boolean;
  }): Promise<PartnerProjectRate> {
    this.assertOperatorCredential('upsertPartnerProjectRate');
    const partnerId = (params.partnerId ?? '').trim();
    const projectId = (params.projectId ?? '').trim();
    if (!partnerId || !projectId) {
      throw new ValidationError('partnerId and projectId are required');
    }
    const query = `
      mutation UpsertPartnerProjectRate($partner_id: String!, $project_id: String!, $commission_percent: Int, $active: Boolean, $clear: Boolean) {
        upsertPartnerProjectRate(partner_id: $partner_id, project_id: $project_id, commission_percent: $commission_percent, active: $active, clear: $clear) {
          partner_id project_id organization_id commission_percent active
        }
      }
    `;
    const variables: Record<string, unknown> = {
      partner_id: partnerId,
      project_id: projectId,
      clear: Boolean(params.clear),
      active: Boolean(params.active),
    };
    if (params.commissionPercent !== undefined) {
      variables.commission_percent = params.commissionPercent;
    }
    const response = await this.executeGraphQL(query, variables);
    const row = response.data?.upsertPartnerProjectRate as
      PartnerProjectRate | undefined;
    if (!row?.partner_id) {
      throw new ValidationError(
        'Invalid response format for upsertPartnerProjectRate'
      );
    }
    return row;
  }

  /** Verify a store purchase and upsert the tenant subscription ledger row. */
  async verifyProjectPayment(
    params: VerifyProjectPaymentParams
  ): Promise<ProjectTenantSubscription> {
    const provider = (params.provider ?? 'google_play').trim() || 'google_play';
    const projectId = params.projectId.trim();
    const path = `/system/v1/project-payment/projects/${projectId}/providers/${provider}/verify`;
    const body: Record<string, unknown> = {
      tenant_id: params.tenantId,
      product_id: params.productId,
      purchase_token: params.purchaseToken,
      package_name: params.packageName,
    };
    const bc = params.billingContactUserId?.trim();
    if (bc) body.billing_contact_user_id = bc;
    return this.executeProjectPayment<ProjectTenantSubscription>('POST', path, {
      jsonBody: body,
      projectId,
      tenantId: params.tenantId,
    });
  }

  /** Latest subscription for a tenant (includes manage_url when Play). */
  async getTenantSubscription(
    projectId: string,
    tenantId: string
  ): Promise<ProjectTenantSubscription> {
    const pid = projectId.trim();
    const tid = tenantId.trim();
    const path = `/system/v1/project-payment/projects/${pid}/tenants/${tid}/subscription`;
    return this.executeProjectPayment<ProjectTenantSubscription>('GET', path, {
      projectId: pid,
      tenantId: tid,
    });
  }

  /** Cancel via provider (Play API first for google_play), then finalize ledger. */
  private async cancelTenantSubscriptionRest(
    params: CancelTenantSubscriptionParams
  ): Promise<ProjectTenantSubscription> {
    const projectId = params.projectId.trim();
    const tenantId = params.tenantId.trim();
    const mode = (params.mode ?? 'cancel').trim() || 'cancel';
    const path = `/system/v1/project-payment/projects/${projectId}/subscriptions/cancel`;
    const body: Record<string, unknown> = {
      tenant_id: tenantId,
      mode,
    };
    const sid = params.subscriptionId?.trim();
    if (sid) body.subscription_id = sid;
    if (params.forceLedgerOnly) body.force_ledger_only = true;
    return this.executeProjectPayment<ProjectTenantSubscription>('POST', path, {
      jsonBody: body,
      projectId,
      tenantId,
    });
  }
}

/**
 * Factory function to create a new Apito client
 */
export function createClient(config: ClientConfig): ApitoClient {
  return new ApitoClient(config);
}
