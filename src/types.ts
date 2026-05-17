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
  role: string;
  tenant_id?: string;
  provider?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

/** Login via system GraphQL `loginUser`. Password path: use `email` or `phone` per project settings. Google OAuth code path: `authMethod: 'google'`, `code`, `state` from redirect (get `state` first via `googleOAuthState`). */
export interface LoginUserParams {
  projectId: string;
  password?: string;
  email?: string;
  phone?: string;
  authMethod?: string;
  code?: string;
  state?: string;
}

export interface GoogleOAuthStateResponse {
  state: string;
}

export interface CreateUserParams {
  password: string;
  role?: string;
  email?: string;
  phone?: string;
}

/** Optional fields for `updateUser`; omitted keys are not sent. */
export interface UpdateUserParams {
  email?: string;
  phone?: string;
  role?: string;
}

export interface LoginUserResponse {
  token: string;
  user?: User;
}

export interface UsersResponse {
  users: User[];
  count: number;
}

export interface ProjectStorageSettings {
  use_free_cloud_storage: boolean;
  endpoint?: string | null;
  region?: string | null;
  bucket?: string | null;
  access_key_id?: string | null;
  has_secret_access_key: boolean;
  public_base_url?: string | null;
  force_path_style?: boolean | null;
}

export interface UpdateProjectStorageInput {
  use_free_cloud_storage?: boolean;
  endpoint?: string;
  region?: string;
  bucket?: string;
  access_key_id?: string;
  secret_access_key?: string;
  public_base_url?: string;
  force_path_style?: boolean;
}

export interface SystemFile {
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

export interface SystemFilesListResponse {
  files: SystemFile[];
  total: number;
}

export interface SystemFileUploadParams {
  fileName: string;
  content: Uint8Array | ArrayBuffer;
  fileType?: string;
}

export interface DeleteSystemFilesResponse {
  success: boolean;
  deleted_ids: string[];
  storage_failed?: string[];
  message?: string;
}

/** One SaaS catalog tenant row from searchTenantsByDomain. */
export interface TenantCatalogSearchRow {
  id: string;
  name: string;
  status?: string;
  domain?: string;
  data?: string;
}

export interface TenantByDomainResponse {
  tenant: TenantCatalogSearchRow | null;
}

export interface ClientConfig {
  baseURL: string;
  /** REST base (e.g. http://host:5050/system); derived from baseURL when omitted */
  restBaseURL?: string;
  apiKey: string;
  timeout?: number;
  httpClient?: any;
  tenantId?: string;
}

export interface RequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
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
    options?: { tenantId?: string }
  ): Promise<GraphQLResponse>;
  /** @param token Legacy; ignored. Auth uses client API key. */
  generateTenantToken(tenantId: string, duration?: string, role?: string): Promise<string>;
  loginUser(params: LoginUserParams): Promise<LoginUserResponse>;
  googleOAuthState(projectId: string): Promise<GoogleOAuthStateResponse>;
  searchUsers(projectId: string, limit?: number, offset?: number): Promise<UsersResponse>;
  searchTenantsByDomain(projectId: string, domain: string): Promise<TenantByDomainResponse>;
  createUser(projectId: string, params: CreateUserParams): Promise<User>;
  updateUser(userId: string, params: UpdateUserParams): Promise<User>;
  resetUserPassword(userId: string, password: string): Promise<boolean>;
  deleteUser(userId: string): Promise<boolean>;
  getProjectStorageSettings(projectId: string): Promise<ProjectStorageSettings>;
  updateProjectStorageSettings(input: UpdateProjectStorageInput): Promise<ProjectStorageSettings>;
  uploadSystemFile(params: SystemFileUploadParams): Promise<SystemFile>;
  listSystemFiles(fileType?: string, limit?: number, offset?: number): Promise<SystemFilesListResponse>;
  deleteSystemFiles(ids: string[]): Promise<DeleteSystemFilesResponse>;
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
