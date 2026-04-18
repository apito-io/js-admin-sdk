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
        'X-Apito-Key': this.apiKey,
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
        'X-Apito-Key': this.apiKey,
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
   * Generate a tenant-scoped API key for {@link tenantId}.
   *
   * `token` is legacy and ignored; the engine authenticates via `X-Apito-Key` (client `apiKey`).
   * Expiry is sent as a calendar day `YYYY-MM-DD`; defaults to one year ahead in UTC (same default as Go admin/internal SDK).
   */
  async generateTenantToken(token: string, tenantId: string): Promise<string> {
    void token;

    const d = new Date();
    const duration = `${d.getUTCFullYear() + 1}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
      d.getUTCDate()
    ).padStart(2, '0')}`;

    const query = `
      mutation GenerateTenantToken($tenantId: String!, $duration: String!) {
        generateTenantToken(tenant_id: $tenantId, duration: $duration) {
          token
        }
      }
    `;

    const variables = { tenantId, duration };
    const response = await this.executeGraphQL(query, variables, { tenantId });

    const data = response.data?.generateTenantToken;
    if (!data?.token) {
      throw new ValidationError('Invalid response format for tenant token');
    }

    return data.token;
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
