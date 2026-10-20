import { apitoGraphQLRequest } from "./graphqlRequest";
import { buildListQueryVariables } from "./filterVariables";
import type { ApitoFetcher } from "./fetcher";
import {
  getSavedRecordNode,
  type ApitoSavedMutationMeta,
} from "./recordCompat";
import {
  normalizeApitoFormSaveInput,
  prepareApitoMutationPayload,
} from "./formValues";
import type { GraphQLQueryInput } from "./serializeGraphQLQuery";
import type { CrudFilter, CrudSort, ListPagePagination } from "./types";

export type ApitoResourceRegistry = {
  getListDocument: (resource: string) => GraphQLQueryInput | undefined;
  getOneDocument?: (resource: string) => GraphQLQueryInput | undefined;
  getCreateDocument: (resource: string) => GraphQLQueryInput | undefined;
  getUpdateDocument: (resource: string) => GraphQLQueryInput | undefined;
  getDeleteDocument?: (resource: string) => GraphQLQueryInput | undefined;
  getListKey: (resource: string) => string;
  getCountKey: (resource: string) => string;
  getOneKey?: (resource: string) => string;
  supportsConnection?: (resource: string) => boolean;
};

export type ApitoResourceListParams = {
  resource: string;
  pagination?: { current?: number; pageSize?: number };
  filters?: CrudFilter[];
  sorters?: CrudSort[];
  meta?: {
    gqlQuery?: GraphQLQueryInput;
    fields?: readonly string[];
    connectionFields?: Record<string, string>;
  };
};

export type ApitoResourceMutationParams = {
  resource: string;
  id?: string;
  variables?: Record<string, unknown>;
  meta?: {
    gqlMutation?: GraphQLQueryInput;
    fields?: readonly string[];
    deltaUpdate?: boolean;
  };
};

export type ApitoResourceClient = {
  getList: <TRecord = Record<string, unknown>>(
    params: ApitoResourceListParams,
  ) => Promise<{ data: TRecord[]; total: number }>;
  getOne: <TRecord = Record<string, unknown>>(
    params: { resource: string; id: string; meta?: { gqlQuery?: GraphQLQueryInput } },
  ) => Promise<{ data: TRecord | undefined }>;
  create: (
    params: ApitoResourceMutationParams,
  ) => Promise<{ data: Record<string, unknown> }>;
  update: (
    params: ApitoResourceMutationParams & { id: string },
  ) => Promise<{ data: Record<string, unknown> }>;
  deleteOne: (params: { resource: string; id: string }) => Promise<{ data: Record<string, unknown> }>;
  listAllPages: <TRecord = Record<string, unknown>>(
    params: ApitoResourceListParams & { pageSize?: number },
  ) => Promise<TRecord[]>;
};

function resolveMutationInput(
  variables: Record<string, unknown> | undefined,
  fields?: readonly string[],
): {
  payload: Record<string, unknown>;
  connect?: Record<string, unknown>;
  disconnect?: Record<string, unknown>;
} {
  if (!variables) {
    return { payload: {} };
  }
  if (variables.data && typeof variables.data === "object") {
    const nested = variables.data as Record<string, unknown>;
    const { payload, connect, disconnect } = normalizeApitoFormSaveInput({
      payload: prepareApitoMutationPayload(nested, fields),
      connect: variables.connect as Record<string, unknown> | undefined,
      disconnect: variables.disconnect as Record<string, unknown> | undefined,
    });
    return { payload, connect, disconnect };
  }
  return normalizeApitoFormSaveInput(variables);
}

export function createApitoResourceClient(
  fetcher: ApitoFetcher,
  registry: ApitoResourceRegistry,
): ApitoResourceClient {
  async function getList<TRecord = Record<string, unknown>>(
    params: ApitoResourceListParams,
  ): Promise<{ data: TRecord[]; total: number }> {
    const document =
      params.meta?.gqlQuery ?? registry.getListDocument(params.resource);
    if (!document) {
      throw new Error(`No list document for resource: ${params.resource}`);
    }
    const pagination: ListPagePagination = {
      current: params.pagination?.current ?? 1,
      pageSize: params.pagination?.pageSize ?? 10,
    };
    const variables = buildListQueryVariables({
      resource: params.resource,
      filters: params.filters ?? [],
      sorters: params.sorters ?? [],
      pagination,
      supportsRelation: registry.supportsConnection?.(params.resource) !== false,
    });
    const result = (await apitoGraphQLRequest(fetcher, document, variables)) as Record<
      string,
      unknown
    >;
    const listKey = registry.getListKey(params.resource);
    const countKey = registry.getCountKey(params.resource);
    const rows = (result[listKey] as unknown[]) ?? [];
    const countRaw = result[countKey];
    const total =
      typeof countRaw === "number"
        ? countRaw
        : typeof countRaw === "object" &&
            countRaw !== null &&
            "total" in (countRaw as object)
          ? Number((countRaw as { total: number }).total)
          : rows.length;
    return { data: rows as TRecord[], total };
  }

  return {
    getList,
    async getOne<TRecord = Record<string, unknown>>(params: {
      resource: string;
      id: string;
      meta?: { gqlQuery?: GraphQLQueryInput };
    }): Promise<{ data: TRecord | undefined }> {
      const document =
        params.meta?.gqlQuery ??
        registry.getOneDocument?.(params.resource);
      if (!document) {
        throw new Error(`No one document for resource: ${params.resource}`);
      }
      const oneKey =
        registry.getOneKey?.(params.resource) ?? params.resource;
      const result = (await apitoGraphQLRequest(fetcher, document, {
        id: params.id,
      })) as Record<string, unknown>;
      return {
        data: result[oneKey] as TRecord | undefined,
      };
    },

    async create(params) {
      const document =
        params.meta?.gqlMutation ??
        registry.getCreateDocument(params.resource);
      if (!document) {
        throw new Error(`No create document for resource: ${params.resource}`);
      }
      const { payload, connect } = resolveMutationInput(
        params.variables,
        params.meta?.fields,
      );
      const result = await apitoGraphQLRequest(fetcher, document, {
        payload,
        ...(connect ? { connect } : {}),
      });
      const record = getSavedRecordNode(result, params.resource);
      return { data: (record ?? {}) as Record<string, unknown> };
    },

    async update(params) {
      const document =
        params.meta?.gqlMutation ??
        registry.getUpdateDocument(params.resource);
      if (!document) {
        throw new Error(`No update document for resource: ${params.resource}`);
      }
      const { payload, connect, disconnect } = resolveMutationInput(
        params.variables,
        params.meta?.fields,
      );
      const result = await apitoGraphQLRequest(fetcher, document, {
        id: params.id,
        deltaUpdate: params.meta?.deltaUpdate ?? true,
        payload,
        ...(connect ? { connect } : {}),
        ...(disconnect ? { disconnect } : {}),
      });
      const record = getSavedRecordNode(result, params.resource);
      return { data: (record ?? {}) as Record<string, unknown> };
    },

    async deleteOne(params) {
      const document = registry.getDeleteDocument?.(params.resource);
      if (!document) {
        throw new Error(`No delete document for resource: ${params.resource}`);
      }
      await apitoGraphQLRequest(fetcher, document, { ids: [params.id] });
      return { data: {} };
    },

    async listAllPages<TRecord = Record<string, unknown>>(
      params: ApitoResourceListParams & { pageSize?: number },
    ): Promise<TRecord[]> {
      const pageSize = params.pageSize ?? 500;
      const all: TRecord[] = [];
      let current = 1;
      let total = Infinity;

      while (all.length < total) {
        const page = await getList<TRecord>({
          ...params,
          pagination: { current, pageSize },
        });
        all.push(...page.data);
        total = page.total;
        if (page.data.length === 0) break;
        current += 1;
      }

      return all;
    },
  };
}

export type { ApitoSavedMutationMeta };
