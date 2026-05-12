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
  TenantLoginResponse,
  TenantUser,
  TenantUsersResponse,
  TenantByDomainResponse,
  TenantCatalogSearchRow,
} from './types';

/**
 * Apito SDK Client - JavaScript implementation matching the Go SDK
 */
export class ApitoClient implements InjectedDBOperationInterface {
  private httpClient: AxiosInstance;
  private baseURL: string;
  private apiKey: string;
  private tenantId?: string;

  constructor(config: ClientConfig) {
    this.baseURL = config.baseURL;
    this.apiKey = config.apiKey;
    this.tenantId = config.tenantId;

    // Create axios instance with default configuration
    this.httpClient = axios.create({
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey.startsWith('cli-') || this.apiKey.startsWith('sdk-')
          ? { 'X-Apito-Sync-Key': this.apiKey }
          : { 'X-Apito-Key': this.apiKey }),
      },
      ...config.httpClient,
    });

    // Add tenant ID to headers if provided
    if (this.tenantId) {
      this.httpClient.defaults.headers['X-Apito-Tenant-ID'] = this.tenantId;
    }
  }

  /**
   * Execute an arbitrary GraphQL query or mutation against the Apito admin (system) endpoint.
   * Use for plugin-registered operations (e.g. processLedger, plg_closeOrder) when not wrapped by dedicated SDK methods.
   */
  async executeGraphQL(
    query: string,
    variables?: Record<string, any>,
    options?: { tenantId?: string }
  ): Promise<GraphQLResponse> {
    try {
      const payload = {
        query,
        variables: variables || {},
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(this.apiKey.startsWith('cli-') || this.apiKey.startsWith('sdk-')
          ? { 'X-Apito-Sync-Key': this.apiKey }
          : { 'X-Apito-Key': this.apiKey }),
      };

      if (options?.tenantId || this.tenantId) {
        headers['X-Apito-Tenant-ID'] = options?.tenantId || this.tenantId!;
      }

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
   * Auth uses `X-Apito-Key` (client `apiKey`).
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

  /**
   * Tenant catalog login (system GraphQL). Returns a tenant-scoped `ak_` API token on success.
   */
  async loginTenantUser(
    username: string,
    password: string,
    projectId: string
  ): Promise<TenantLoginResponse> {
    const query = `
      query LoginTenantUser($project_id: String!, $username: String!, $password: String!) {
        loginTenantUser(project_id: $project_id, username: $username, password: $password) {
          token
          user {
            id
            username
            email
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
    const variables: Record<string, any> = { project_id: projectId, username, password };
    const response = await this.executeGraphQL(query, variables);
    const raw = response.data?.loginTenantUser;
    if (!raw?.token) {
      throw new ValidationError('Invalid response format for loginTenantUser');
    }
    return {
      token: raw.token as string,
      user: raw.user as TenantUser | undefined,
    };
  }

  /**
   * Google ID token login for tenant users (project must have google_client_id set).
   */
  async loginTenantUserGoogle(projectId: string, idToken: string): Promise<TenantLoginResponse> {
    const query = `
      mutation LoginTenantUserGoogle($project_id: String!, $id_token: String!) {
        loginTenantUserGoogle(project_id: $project_id, id_token: $id_token) {
          token
          user {
            id
            username
            email
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
    const variables = { project_id: projectId, id_token: idToken };
    const response = await this.executeGraphQL(query, variables);
    const raw = response.data?.loginTenantUserGoogle;
    if (!raw?.token) {
      throw new ValidationError('Invalid response format for loginTenantUserGoogle');
    }
    return {
      token: raw.token as string,
      user: raw.user as TenantUser | undefined,
    };
  }

  /**
   * Search tenant users for a project.
   */
  async searchTenantUsers(
    projectId: string,
    limit?: number,
    offset?: number
  ): Promise<TenantUsersResponse> {
    const query = `
      query SearchTenantUsers($project_id: String!, $limit: Int, $offset: Int) {
        searchTenantUsers(project_id: $project_id, limit: $limit, offset: $offset) {
          count
          users {
            id
            username
            email
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
    const response = await this.executeGraphQL(query, variables);
    const raw = response.data?.searchTenantUsers;
    if (!raw) {
      throw new ValidationError('Invalid response format for searchTenantUsers');
    }
    let count = 0;
    if (typeof raw.count === 'number') {
      count = raw.count;
    }
    const users = (raw.users ?? []) as TenantUser[];
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
            data
          }
        }
      }
    `;
    const variables: Record<string, any> = {
      project_id: projectId,
      domain,
    };
    const response = await this.executeGraphQL(query, variables);
    const raw = response.data?.searchTenantsByDomain;
    if (!raw) {
      throw new ValidationError('Invalid response format for searchTenantsByDomain');
    }
    const tenant = (raw.tenant ?? null) as TenantCatalogSearchRow | null;
    return { tenant };
  }

  /**
   * Create a tenant catalog user (local password).
   */
  async createTenantUser(
    projectId: string,
    username: string,
    email: string,
    password: string,
    role: string
  ): Promise<TenantUser> {
    const query = `
      mutation CreateTenantUser($project_id: String!, $username: String!, $password: String!, $role: String, $email: String) {
        createTenantUser(project_id: $project_id, username: $username, password: $password, role: $role, email: $email) {
          id
          username
          email
          role
          provider
          tenant_id
          status
          created_at
          updated_at
        }
      }
    `;
    const variables = { project_id: projectId, username, password, email, role };
    const response = await this.executeGraphQL(query, variables);
    const u = response.data?.createTenantUser;
    if (!u?.id) {
      throw new ValidationError('Invalid response format for createTenantUser');
    }
    return u as TenantUser;
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
