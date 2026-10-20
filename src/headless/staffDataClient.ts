import { ApitoClient } from "../client";
import type {
  CreateAndUpdateRequest,
  DefaultDocumentStructure,
  SearchResult,
} from "../types";
import {
  createApitoResourceClient,
  type ApitoResourceClient,
  type ApitoResourceRegistry,
} from "./resourceClient";
import type { CrudFilter, CrudSort } from "./types";
import { createVerifiedStaffApitoFetcher } from "./fetcher";

type UnknownRecord = Record<string, unknown>;

export type ApitoStaffDataClientOptions = {
  graphqlUrl: string;
  projectId: string;
  tenantId: string;
  bearerToken: string;
  registry: ApitoResourceRegistry;
  timeout?: number;
  fetcher?: typeof fetch;
};

function asRecord(value: unknown): UnknownRecord | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined;
}

function nonEmptyString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function positiveInteger(value: unknown, fallback: number): number {
  const numberValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;
  return Number.isInteger(numberValue) && numberValue > 0
    ? numberValue
    : fallback;
}

function relationFieldCandidates(model: string): string[] {
  const normalized = model.trim();
  const withoutListSuffix = normalized.replace(/_list$/, "");
  return [
    ...new Set([
      normalized,
      withoutListSuffix,
      `${withoutListSuffix}_list`,
    ]),
  ];
}

function relatedIdsFromValue(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];
  const ids: string[] = [];

  for (const item of values) {
    if (typeof item === "string" && item.trim()) {
      ids.push(item.trim());
      continue;
    }
    const record = asRecord(item);
    if (!record) continue;

    const id = nonEmptyString(record.id) || nonEmptyString(record._id);
    if (id) {
      ids.push(id);
      continue;
    }

    const nestedData = asRecord(record.data);
    const nestedId =
      nonEmptyString(nestedData?.id) || nonEmptyString(nestedData?._id);
    if (nestedId) ids.push(nestedId);
  }

  return [...new Set(ids)];
}

function readRelationIds(
  document: UnknownRecord,
  relatedModel: string,
): { found: boolean; ids: string[] } {
  const ids: string[] = [];
  let found = false;

  for (const field of relationFieldCandidates(relatedModel)) {
    if (!Object.prototype.hasOwnProperty.call(document, field)) continue;
    found = true;
    ids.push(...relatedIdsFromValue(document[field]));
  }

  return { found, ids: [...new Set(ids)] };
}

function conditionFilters(field: string, value: unknown): CrudFilter[] {
  const condition = asRecord(value);
  if (!condition) {
    return [{ field, operator: "eq", value }];
  }

  const entries = Object.entries(condition);
  if (entries.length !== 1) {
    throw new Error(`Unsupported secured filter for field: ${field}`);
  }

  const [operator, operatorValue] = entries[0];
  return [{ field, operator, value: operatorValue }];
}

function rawWhereToFilters(where: unknown): CrudFilter[] {
  const record = asRecord(where);
  if (!record) return [];

  const filters: CrudFilter[] = [];
  for (const [field, value] of Object.entries(record)) {
    if (field === "AND" || field === "OR") {
      throw new Error(
        `Unsupported secured logical filter: ${field}. Use model-specific filters.`,
      );
    }
    filters.push(...conditionFilters(field, value));
  }
  return filters;
}

function rawKeyToFilter(key: unknown): CrudFilter[] {
  const record = asRecord(key);
  if (!record) {
    return key === undefined
      ? []
      : [{ field: "_key", operator: "eq", value: key }];
  }
  const entries = Object.entries(record);
  if (entries.length !== 1) {
    throw new Error("Unsupported secured _key filter");
  }
  const [operator, value] = entries[0];
  return [{ field: "_key", operator, value }];
}

function rawSortToSorters(sort: unknown): CrudSort[] {
  const record = asRecord(sort);
  if (!record) return [];

  return Object.entries(record).map(([field, order]) => ({
    field,
    order: String(order).toLowerCase() === "desc" ? "desc" : "asc",
  }));
}

/**
 * Compatibility facade for server-side tenant data routes.
 *
 * All resource methods use model-specific documents against
 * `/secured/graphql`. It intentionally does not fall back to the generic
 * system GraphQL methods on ApitoClient.
 */
export class ApitoStaffDataClient extends ApitoClient {
  private readonly resourceClient: ApitoResourceClient;

  constructor(options: ApitoStaffDataClientOptions) {
    super({
      baseURL: options.graphqlUrl,
      bearerToken: options.bearerToken,
      projectId: options.projectId,
      tenantId: options.tenantId,
      timeout: options.timeout,
    });

    const fetcher = createVerifiedStaffApitoFetcher({
      graphqlUrl: options.graphqlUrl,
      bearerToken: options.bearerToken,
      projectId: options.projectId,
      tenantId: options.tenantId,
      fetcher: options.fetcher,
    });
    this.resourceClient = createApitoResourceClient(fetcher, options.registry);
  }

  override async getSingleResource(
    model: string,
    id: string,
    singlePageData = false,
  ): Promise<DefaultDocumentStructure> {
    void singlePageData;
    const result = await this.resourceClient.getOne<DefaultDocumentStructure>({
      resource: model,
      id,
    });
    if (!result.data?.id) {
      throw new Error("Resource not found");
    }
    return result.data;
  }

  override async searchResources(
    model: string,
    filter: Record<string, unknown> = {},
    aggregate = false,
  ): Promise<SearchResult> {
    if (aggregate) {
      throw new Error(
        "Aggregate searches are not available through secured model operations",
      );
    }
    if (filter.search !== undefined) {
      throw new Error(
        "Free-text search is not available through secured model operations",
      );
    }

    const pageSize = positiveInteger(filter.limit, 10);
    const offset = positiveInteger(filter.offset, 0);
    const page = positiveInteger(
      filter.page,
      offset > 0 ? Math.floor(offset / pageSize) + 1 : 1,
    );
    const result =
      await this.resourceClient.getList<DefaultDocumentStructure>({
        resource: model,
        pagination: { current: page, pageSize },
        filters: [
          ...rawWhereToFilters(filter.where),
          ...rawKeyToFilter(filter._key),
        ],
        sorters: rawSortToSorters(filter.sort),
      });

    return {
      results: result.data,
      count: result.total,
    };
  }

  override async getRelationDocuments(
    id: string,
    connection: Record<string, unknown>,
  ): Promise<SearchResult> {
    const sourceModel = nonEmptyString(connection.to_model);
    const relatedModel = nonEmptyString(connection.model);
    if (!sourceModel || !relatedModel) {
      throw new Error("model and to_model are required for relation lookup");
    }

    const source = await this.resourceClient.getOne<UnknownRecord>({
      resource: sourceModel,
      id,
    });
    if (!source.data?.id) {
      throw new Error("Resource not found");
    }

    const direct = readRelationIds(source.data, relatedModel);
    if (direct.found) {
      const results = await Promise.all(
        direct.ids.map(async (relatedId) => {
          const related =
            await this.resourceClient.getOne<DefaultDocumentStructure>({
              resource: relatedModel,
              id: relatedId,
            });
          return related.data;
        }),
      );
      const documents = results.filter(
        (document): document is DefaultDocumentStructure =>
          Boolean(document?.id),
      );
      return { results: documents, count: documents.length };
    }

    const relatedRows =
      await this.resourceClient.listAllPages<DefaultDocumentStructure>({
        resource: relatedModel,
        pageSize: 500,
      });
    const results = relatedRows.filter((document) => {
      const relation = readRelationIds(document.data ?? {}, sourceModel);
      return relation.ids.includes(id);
    });

    return { results, count: results.length };
  }

  override async createNewResource(
    request: CreateAndUpdateRequest,
  ): Promise<DefaultDocumentStructure> {
    if (!request.model) throw new Error("model is required");
    if (!request.payload) throw new Error("payload is required");

    const result = await this.resourceClient.create({
      resource: request.model,
      variables: {
        payload: request.payload,
        ...(request.connect ? { connect: request.connect } : {}),
      },
    });
    return result.data as unknown as DefaultDocumentStructure;
  }

  override async updateResource(
    request: CreateAndUpdateRequest,
  ): Promise<DefaultDocumentStructure> {
    if (!request.id) throw new Error("id is required");
    if (!request.model) throw new Error("model is required");
    if (!request.payload) throw new Error("payload is required");

    const result = await this.resourceClient.update({
      resource: request.model,
      id: request.id,
      variables: {
        payload: request.payload,
        ...(request.connect ? { connect: request.connect } : {}),
        ...(request.disconnect ? { disconnect: request.disconnect } : {}),
      },
    });
    return result.data as unknown as DefaultDocumentStructure;
  }

  override async deleteResource(model: string, id: string): Promise<void> {
    await this.resourceClient.deleteOne({ resource: model, id });
  }
}
