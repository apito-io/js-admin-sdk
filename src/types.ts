/**
 * Type definitions for the Apito JavaScript SDK
 */

export interface MetaField {
  created_at: string;
  updated_at: string;
  status: string;
  revision?: string;
  revision_at?: string;
  root_revision_id?: string;
}

export interface DefaultDocumentStructure {
  _key?: string;
  _id?: string;
  data: any;
  meta?: MetaField;
  id: string;
  expire_at?: string | number;
  relation_doc_id?: string;
  last_revision_doc_id?: string;
  type?: string;
  tenant_id?: string;
  tenant_model?: string;
}

export interface SearchResult {
  results: DefaultDocumentStructure[];
  count: number;
}

export interface TypedDocumentStructure<T> {
  _key?: string;
  _id?: string;
  data: T;
  meta?: MetaField;
  id: string;
  expire_at?: string | number;
  relation_doc_id?: string;
  last_revision_doc_id?: string;
  type?: string;
  tenant_id?: string;
  tenant_model?: string;
}

export interface TypedSearchResult<T> {
  results: TypedDocumentStructure<T>[];
  count: number;
}

export interface Filter {
  page?: number;
  offset?: number;
  limit?: number;
  order?: string;
  min?: number;
  max?: number;
  category?: string;
}

export interface GraphQLErrorLocation {
  line: number;
  column: number;
}

export interface GraphQLError {
  message: string;
  locations?: GraphQLErrorLocation[];
  path?: (string | number)[];
  extensions?: Record<string, any>;
}

export interface GraphQLResponse {
  data?: any;
  errors?: GraphQLError[];
}

export interface CreateAndUpdateRequest {
  id?: string;
  model: string;
  payload: any;
  connect?: Record<string, any>;
  disconnect?: Record<string, any>;
  singlePageData?: boolean;
  forceUpdate?: boolean;
}

/** Project end-user from engine system DB (table project_users). */
export interface User {
  id: string;
  email?: string;
  phone?: string;
  username?: string;
  role: string;
  tenant_id?: string;
  provider?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

/** Login via system GraphQL `loginUser`. Password path: use `email` or `phone` per project settings. OAuth code path: `authMethod` `google`|`facebook`|`github`|`x`|`linkedin` with `code`+`state` (get `state` via `oauthState` / `googleOAuthState`). Native mobile Google: `authMethod: 'google_id_token'`, `idToken`. SaaS per-tenant separate DB: pass `tenantId`. */
export interface LoginUserParams {
  projectId: string;
  tenantId?: string;
  password?: string;
  email?: string;
  phone?: string;
  authMethod?: string;
  code?: string;
  state?: string;
  idToken?: string;
}

export interface GoogleOAuthStateResponse {
  state: string;
}

export interface CreateUserParams {
  /** Engine rejects duplicate email project-wide: `email already exists for this project`. */
  password: string;
  role?: string;
  email?: string;
  phone?: string;
  /** Pro SaaS: catalog tenant id; sent as GraphQL `tenant_id`. Omit on general projects. */
  tenantId?: string;
}

/** Optional fields for `updateUser`; omitted keys are not sent. Engine rejects duplicate email/phone project-wide. */
export interface UpdateUserParams {
  email?: string;
  phone?: string;
  role?: string;
  /** Pro SaaS: catalog tenant scope; sent as GraphQL `tenant_id`. */
  tenantId?: string;
}

export interface LoginUserResponse {
  token: string;
  user?: User;
}

export interface UsersResponse {
  users: User[];
  count: number;
}

export interface File {
  /** Project-scoped file id (metadata in project DB files table). */
  id: string;
  file_type: string;
  file_name: string;
  file_extension?: string;
  content_type?: string;
  size: number;
  url: string;
  created_by?: string;
  created_at?: string;
}

export interface FilesListResponse {
  files: File[];
  total: number;
}

export interface UploadFileParams {
  fileName: string;
  content: Uint8Array | ArrayBuffer;
  fileType?: string;
}

export interface DeleteFilesResponse {
  success: boolean;
  deleted_ids: string[];
  storage_failed?: string[];
  message?: string;
}

/** One SaaS catalog tenant row from searchTenantsByDomain or searchTenants. */
export interface TenantCatalogSearchRow {
  id: string;
  name: string;
  status?: string;
  domain?: string;
  /** Control-plane plan: free | paid | paid_plus | ultra */
  plan_tier?: string;
  /**
   * Workspace partner id (Direct when empty). Console / Udbhabon Admin select this.
   * Client apps (Astro, Flutter) never request it — omit `includePartner`.
   */
  partner_id?: string;
  icon?: string;
  data?: string;
  created_at?: string;
}

export interface SearchTenantsResponse {
  tenants: TenantCatalogSearchRow[];
  count: number;
}

export interface TenantByDomainResponse {
  tenant: TenantCatalogSearchRow | null;
}

/** One SaaS catalog tenant row from getTenants (includes icon). */
export interface TenantCatalogListItem {
  id: string;
  name: string;
  domain?: string;
  plan_tier?: string;
  /** Console / Udbhabon Admin only. Client apps omit `includePartner`. */
  partner_id?: string;
  icon?: string;
  data?: string;
}

/** Opt-in for catalog `partner_id`. Required for Console / Udbhabon Admin; unused by client apps. */
export interface TenantCatalogPartnerOptions {
  includePartner?: boolean;
}

export interface GetTenantsResponse {
  tenants: TenantCatalogListItem[];
}

export interface CreateTenantParams {
  name: string;
  data?: string;
  domain?: string;
  /** free | paid | paid_plus | ultra (default free on engine). */
  planTier?: string;
  /** Workspace partner id. Empty defaults to Direct. Console / Udbhabon Admin only. */
  partnerId?: string;
}

export interface UpdateTenantParams {
  name?: string;
  data?: string;
  domain?: string;
  /** Workspace partner id. Empty defaults to Direct. Console / Udbhabon Admin only. */
  partnerId?: string;
  /**
   * @deprecated Engine rejects `plan_tier` on `updateTenant` (ledger-driven entitlement).
   * Passing this throws client-side; use createTenantSubscription / cancel / Play verify.
   */
  planTier?: string;
}

/** Public GraphQL `myTenant` for the authenticated app-user token. */
export interface MyTenant {
  id: string;
  name?: string;
  domain?: string;
  status?: string;
  plan_tier?: string;
}

/** ApitoProjectPayment ledger row (REST). */
export interface ProjectTenantSubscription {
  id?: string;
  project_id?: string;
  tenant_id?: string;
  plan_tier?: string;
  provider?: string;
  status?: string;
  billing_contact_user_id?: string;
  external_subscription_id?: string;
  product_id?: string;
  current_period_start?: string;
  current_period_end?: string;
  cancel_at?: string;
  created_by?: string;
  notes?: string;
  partner_id?: string;
  manage_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface VerifyProjectPaymentParams {
  projectId: string;
  tenantId: string;
  productId: string;
  purchaseToken: string;
  packageName: string;
  provider?: string;
  billingContactUserId?: string;
}

export interface CancelTenantSubscriptionParams {
  projectId: string;
  tenantId: string;
  mode?: 'cancel' | 'revoke' | string;
  subscriptionId?: string;
  forceLedgerOnly?: boolean;
}

/** System GraphQL `cancelTenantSubscription` (manual / ledger). REST cancel still uses `CancelTenantSubscriptionParams`. */
export interface CancelTenantSubscriptionGraphQLParams {
  subscriptionId: string;
  mode?: 'cancel' | 'revoke' | string;
  forceLedgerOnly?: boolean;
}

/** System GraphQL `ProjectTenantInvoice`. */
export interface ProjectTenantInvoice {
  id?: string;
  subscription_id?: string;
  project_id?: string;
  tenant_id?: string;
  amount?: number;
  currency?: string;
  status?: string;
  provider?: string;
  billing_purpose?: string;
  notes?: string;
  issued_at?: string;
  paid_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ProjectPaymentProviders {
  project_id?: string;
  google_play?: Record<string, unknown> | null;
  paddle?: Record<string, unknown> | null;
  webhook_urls?: Record<string, string> | null;
  updated_at?: string;
}

export interface ListTenantSubscribersResponse {
  total: number;
  subscriptions: ProjectTenantSubscription[];
}

export interface ListTenantInvoicesResponse {
  total: number;
  invoices: ProjectTenantInvoice[];
}

export interface CreateTenantSubscriptionParams {
  tenantId: string;
  planTier: string;
  billingContactUserId?: string;
  notes?: string;
  issueInvoice?: boolean;
  amount?: number;
  currency?: string;
  billingPurpose?: string;
  /** Workspace partner id. Empty uses tenant.partner_id or Direct. */
  partnerId?: string;
}

export interface UpdateTenantSubscriptionParams {
  subscriptionId: string;
  planTier?: string;
  status?: string;
  billingContactUserId?: string;
  notes?: string;
  /** Workspace partner id. Empty resolves to Direct on the engine. */
  partnerId?: string;
  /** RFC3339 UTC. Empty string clears the period end. */
  currentPeriodEnd?: string;
}

export interface CreateTenantInvoiceParams {
  subscriptionId: string;
  amount: number;
  currency?: string;
  status?: string;
  provider?: string;
  notes?: string;
  billingPurpose?: string;
}

/** Workspace-global sales partner (not per-project). */
export interface ProPartner {
  id?: string;
  organization_id?: string;
  name?: string;
  email?: string;
  status?: string;
  is_default?: boolean;
  /** Partner share of tenant subscription revenue (0–100). Direct is always 0. */
  commission_percent?: number;
  created_at?: string;
  updated_at?: string;
}

export interface SearchPartnersResponse {
  results: ProPartner[];
  total: number;
}

export interface CreatePartnerParams {
  /** Required. Channel partners are keyed by this Google/contact email. */
  email: string;
  /** Optional. Defaults to email when Google (or the caller) omits a name. */
  name?: string;
  status?: string;
  /** Optional partner share 0–100. Defaults to 0. */
  commissionPercent?: number;
}

export interface UpdatePartnerParams {
  name?: string;
  email?: string;
  status?: string;
  commissionPercent?: number;
}

export interface ClientConfig {
  baseURL: string;
  /** REST base (e.g. http://host:5050/system); derived from baseURL when omitted */
  restBaseURL?: string;
  /** System access token (`apt_…`) or project API key (`ak_…`). Prefer `accessToken` for automation. */
  apiKey?: string;
  /** Alias for system automation token (`apt_…`) → `Authorization: Bearer`. */
  accessToken?: string;
  /** Staff session token for `/secured/*` routes (`Authorization: Bearer`). */
  bearerToken?: string;
  timeout?: number;
  httpClient?: any;
  /** Default project scope sent as `X-Apito-Project-Id`. */
  projectId?: string;
  tenantId?: string;
}

export interface RequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
  /** Per-request project scope sent as `X-Apito-Project-Id`. */
  projectId?: string;
  tenantId?: string;
}

export interface SearchOptions {
  limit?: number;
  page?: number;
  offset?: number;
  where?: Record<string, any>;
  search?: string;
  sort?: Record<string, 1 | -1>;
}

export interface ConnectionOptions {
  model: string;
  filter?: SearchOptions;
}

// Plugin interface matching the Go SDK
export interface InjectedDBOperationInterface {
  executeGraphQL(
    query: string,
    variables?: Record<string, any>,
    options?: { projectId?: string; tenantId?: string }
  ): Promise<GraphQLResponse>;
  /** @param token Legacy; ignored. Auth uses client API key. */
  generateTenantToken(tenantId: string, duration?: string, role?: string): Promise<string>;
  loginUser(params: LoginUserParams): Promise<LoginUserResponse>;
	googleOAuthState(projectId: string): Promise<GoogleOAuthStateResponse>;
  oauthState(projectId: string, provider: string): Promise<GoogleOAuthStateResponse>;
  searchUsers(
    projectId: string,
    limit?: number,
    offset?: number,
    tenantId?: string,
    q?: string
  ): Promise<UsersResponse>;
  searchTenantsByDomain(
    projectId: string,
    domain: string,
    options?: TenantCatalogPartnerOptions
  ): Promise<TenantByDomainResponse>;
  searchTenants(
    projectId: string,
    limit?: number,
    offset?: number,
    q?: string,
    status?: string,
    options?: TenantCatalogPartnerOptions
  ): Promise<SearchTenantsResponse>;
  getTenant(
    projectId: string,
    tenantId: string,
    status?: string,
    options?: TenantCatalogPartnerOptions
  ): Promise<TenantCatalogSearchRow | null>;
  getTenants(options?: TenantCatalogPartnerOptions): Promise<GetTenantsResponse>;
  createTenant(params: CreateTenantParams): Promise<TenantCatalogSearchRow>;
  updateTenant(tenantId: string, params: UpdateTenantParams): Promise<TenantCatalogSearchRow>;
  deleteTenant(tenantId: string): Promise<boolean>;
  /** Public GraphQL: requires app-user JWT against secured/public endpoint. */
  myTenant(): Promise<MyTenant>;
  /** Public GraphQL: role ∩ plan ceiling for app-user JWT. */
  myEffectivePermissions(): Promise<import('./access/permissions.types').EffectivePermissionsSnapshot>;
  createTenantSubscription(params: CreateTenantSubscriptionParams): Promise<ProjectTenantSubscription>;
  updateTenantSubscription(params: UpdateTenantSubscriptionParams): Promise<ProjectTenantSubscription>;
  createTenantInvoice(params: CreateTenantInvoiceParams): Promise<ProjectTenantInvoice>;
  listTenantSubscribers(params?: {
    payingOnly?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<ListTenantSubscribersResponse>;
  listTenantInvoices(params?: {
    subscriptionId?: string;
    limit?: number;
    offset?: number;
  }): Promise<ListTenantInvoicesResponse>;
  getProjectPaymentProviders(): Promise<ProjectPaymentProviders>;
  searchPartners(params?: { q?: string; limit?: number; offset?: number }): Promise<SearchPartnersResponse>;
  createPartner(params: CreatePartnerParams): Promise<ProPartner>;
  updatePartner(id: string, params: UpdatePartnerParams): Promise<ProPartner>;
  createUser(projectId: string, params: CreateUserParams): Promise<User>;
  updateUser(userId: string, params: UpdateUserParams): Promise<User>;
  resetUserPassword(userId: string, password: string): Promise<boolean>;
  deleteUser(userId: string): Promise<boolean>;
  uploadFile(params: UploadFileParams): Promise<File>;
  listFiles(fileType?: string, limit?: number, offset?: number): Promise<FilesListResponse>;
  deleteFiles(ids: string[]): Promise<DeleteFilesResponse>;
  getSingleResource(model: string, id: string, singlePageData?: boolean): Promise<DefaultDocumentStructure>;
  searchResources(model: string, filter?: Record<string, any>, aggregate?: boolean): Promise<SearchResult>;
  getRelationDocuments(id: string, connection: Record<string, any>): Promise<SearchResult>;
  createNewResource(request: CreateAndUpdateRequest): Promise<DefaultDocumentStructure>;
  updateResource(request: CreateAndUpdateRequest): Promise<DefaultDocumentStructure>;
  deleteResource(model: string, id: string): Promise<void>;
  debug(stage: string, ...data: any[]): Promise<any>;
}

// Typed operations interface
export interface TypedOperations {
  getSingleResourceTyped<T>(model: string, id: string, singlePageData?: boolean): Promise<TypedDocumentStructure<T>>;
  searchResourcesTyped<T>(model: string, filter?: Record<string, any>, aggregate?: boolean): Promise<TypedSearchResult<T>>;
  getRelationDocumentsTyped<T>(id: string, connection: Record<string, any>): Promise<TypedSearchResult<T>>;
  createNewResourceTyped<T>(request: CreateAndUpdateRequest): Promise<TypedDocumentStructure<T>>;
  updateResourceTyped<T>(request: CreateAndUpdateRequest): Promise<TypedDocumentStructure<T>>;
}

// Error classes
export class ApitoError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
    public details?: any
  ) {
    super(message);
    this.name = 'ApitoError';
  }
}

export class GraphQLError extends ApitoError {
  constructor(
    message: string,
    public graphQLErrors: GraphQLError[],
    public response?: any
  ) {
    super(message, 'GRAPHQL_ERROR');
    this.name = 'GraphQLError';
  }

  get partialData(): any {
    return this.response?.data;
  }
}

export class ValidationError extends ApitoError {
  constructor(message: string, public field?: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}
