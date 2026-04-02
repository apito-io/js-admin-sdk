import {
  DefaultDocumentStructure,
  TypedDocumentStructure,
  TypedSearchResult,
  CreateAndUpdateRequest,
} from './types';
import { ApitoClient } from './client';

/**
 * Typed operations wrapper for the Apito SDK
 * Provides type-safe methods for working with typed data
 */
export class TypedOperations {
  constructor(private client: ApitoClient) {}

  private static toTypedDocument<T>(raw: DefaultDocumentStructure): TypedDocumentStructure<T> {
    const data = JSON.parse(JSON.stringify(raw.data)) as T;
    return {
      _key: raw._key,
      _id: raw._id,
      data,
      meta: raw.meta,
      id: raw.id,
      expire_at: raw.expire_at,
      relation_doc_id: raw.relation_doc_id,
      last_revision_doc_id: raw.last_revision_doc_id,
      type: raw.type,
      tenant_id: raw.tenant_id,
      tenant_model: raw.tenant_model,
    };
  }

  /**
   * Get a single resource with type safety
   */
  async getSingleResourceTyped<T>(
    model: string,
    id: string,
    singlePageData: boolean = false
  ): Promise<TypedDocumentStructure<T>> {
    const result = await this.client.getSingleResource(model, id, singlePageData);
    return TypedOperations.toTypedDocument<T>(result);
  }

  /**
   * Search resources with type safety
   */
  async searchResourcesTyped<T>(
    model: string,
    filter: Record<string, any> = {},
    aggregate: boolean = false
  ): Promise<TypedSearchResult<T>> {
    const result = await this.client.searchResources(model, filter, aggregate);
    return {
      results: result.results.map((doc) => TypedOperations.toTypedDocument<T>(doc)),
      count: result.count,
    };
  }

  /**
   * Get related documents with type safety
   */
  async getRelationDocumentsTyped<T>(
    id: string,
    connection: Record<string, any>
  ): Promise<TypedSearchResult<T>> {
    const result = await this.client.getRelationDocuments(id, connection);
    return {
      results: result.results.map((doc) => TypedOperations.toTypedDocument<T>(doc)),
      count: result.count,
    };
  }

  /**
   * Create a new resource with type safety
   */
  async createNewResourceTyped<T>(
    request: CreateAndUpdateRequest
  ): Promise<TypedDocumentStructure<T>> {
    const result = await this.client.createNewResource(request);
    return TypedOperations.toTypedDocument<T>(result);
  }

  /**
   * Update a resource with type safety
   */
  async updateResourceTyped<T>(
    request: CreateAndUpdateRequest
  ): Promise<TypedDocumentStructure<T>> {
    const result = await this.client.updateResource(request);
    return TypedOperations.toTypedDocument<T>(result);
  }
}
