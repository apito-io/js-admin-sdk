"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";

import { useApitoFetcher } from "./context";
import {
  apitoRecordToFormValues,
  normalizeApitoFormSaveInput,
} from "./formValues";
import { apitoGraphQLRequest } from "./graphqlFetcher";
import { buildApitoFilterVariables, transformRelationFilters } from "./filterVariables";
import {
  invalidateApitoDataQueries,
  invalidateApitoQueriesAfterMutation,
} from "./queryInvalidation";
import {
  serializeGraphQLQuery,
  type GraphQLQueryInput,
} from "./serializeGraphQLQuery";
import type {
  ApitoRecord,
  CrudFilter,
  CrudSort,
  ListPagePagination,
} from "./types";

export type UseListPageOptions<TRecord extends ApitoRecord = ApitoRecord> = {
  resource: string;
  /** Generated hook: (fetcher, vars, options) => useQuery result */
  useListQuery: (
    fetcher: ReturnType<typeof useApitoFetcher>,
    variables: Record<string, unknown>,
    options?: { enabled?: boolean },
  ) => {
    data?: Record<string, unknown>;
    isLoading: boolean;
    isFetching: boolean;
    error: Error | null;
    refetch: () => void;
  };
  listKey: string;
  countKey: string;
  initialFilters?: CrudFilter[];
  initialSorters?: CrudSort[];
  initialPagination?: ListPagePagination;
  supportsConnection?: boolean;
  connection?: unknown[];
  enabled?: boolean;
};

export type UseListPageResult<TRecord extends ApitoRecord = ApitoRecord> = {
  dataSource: TRecord[];
  total: number;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  filters: CrudFilter[];
  setFilters: (filters: CrudFilter[]) => void;
  sorters: CrudSort[];
  setSorters: (sorters: CrudSort[]) => void;
  pagination: ListPagePagination;
  setPagination: (pagination: ListPagePagination) => void;
  refetch: () => void;
};

export function useListPage<TRecord extends ApitoRecord = ApitoRecord>(
  options: UseListPageOptions<TRecord>,
): UseListPageResult<TRecord> {
  const fetcher = useApitoFetcher();
  const [filters, setFilters] = useState<CrudFilter[]>(
    options.initialFilters ?? [],
  );
  const [sorters, setSorters] = useState<CrudSort[]>(
    options.initialSorters ?? [],
  );
  const [pagination, setPagination] = useState<ListPagePagination>(
    options.initialPagination ?? { current: 1, pageSize: 10 },
  );

  const variables = useMemo(() => {
    const { filters: resolvedFilters, connection: relationConnection } =
      transformRelationFilters(filters);
    const base = buildApitoFilterVariables({
      resource: options.resource,
      filters: resolvedFilters,
      sorters,
      pagination,
    });
    const countVars = buildApitoFilterVariables({
      resource: options.resource,
      filters: resolvedFilters,
      sorters,
      pagination,
      forCount: true,
    });
    const vars = {
      ...base,
      ...(countVars.where ? { whereCount: countVars.where } : {}),
    };
    if (options.supportsConnection !== false) {
      if (relationConnection) {
        return { ...vars, connection: relationConnection };
      }
      if (options.connection?.length) {
        return { ...vars, connection: options.connection };
      }
    }
    return vars;
  }, [
    options.resource,
    options.supportsConnection,
    options.connection,
    filters,
    sorters,
    pagination,
  ]);

  const query = options.useListQuery(fetcher, variables, {
    enabled: options.enabled !== false,
  });

  const list = (query.data?.[options.listKey] as TRecord[] | undefined) ?? [];
  const countRaw = query.data?.[options.countKey];
  const total =
    typeof countRaw === "number"
      ? countRaw
      : typeof countRaw === "object" &&
          countRaw !== null &&
          "total" in (countRaw as object)
        ? Number((countRaw as { total: number }).total)
        : list.length;

  return {
    dataSource: list,
    total,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    filters,
    setFilters,
    sorters,
    setSorters,
    pagination,
    setPagination,
    refetch: query.refetch,
  };
}

export type UseFormPageOptions = {
  resource: string;
  id?: string;
  /** Preferred over useCreateMutation — avoids calling hooks inside mutationFn. */
  createDocument?: GraphQLQueryInput;
  /** Preferred over useUpdateMutation — avoids calling hooks inside mutationFn. */
  updateDocument?: GraphQLQueryInput;
  /** Pass true for partial Apito updates (recommended for edit forms). */
  deltaUpdate?: boolean;
  useOneQuery?: (
    fetcher: ReturnType<typeof useApitoFetcher>,
    variables: { id: string },
    options?: { enabled?: boolean },
  ) => {
    data?: Record<string, unknown>;
    isLoading: boolean;
    error: Error | null;
  };
  oneKey?: string;
  useCreateMutation?: (
    fetcher: ReturnType<typeof useApitoFetcher>,
  ) => {
    mutateAsync: (vars: Record<string, unknown>) => Promise<unknown>;
    isPending: boolean;
  };
  useUpdateMutation?: (
    fetcher: ReturnType<typeof useApitoFetcher>,
  ) => {
    mutateAsync: (vars: Record<string, unknown>) => Promise<unknown>;
    isPending: boolean;
  };
};

export function useFormPage(options: UseFormPageOptions) {
  const fetcher = useApitoFetcher();
  const queryClient = useQueryClient();
  const isEdit = Boolean(options.id);
  const oneQuery =
    isEdit && options.useOneQuery && options.oneKey
      ? options.useOneQuery(fetcher, { id: options.id! })
      : null;
  const legacyCreateMutation = !isEdit
    ? options.useCreateMutation?.(fetcher)
    : null;
  const legacyUpdateMutation = isEdit
    ? options.useUpdateMutation?.(fetcher)
    : null;

  const createMutation = useMutation({
    mutationKey: ["apito-form-create", options.resource],
    mutationFn: (input: Record<string, unknown>) => {
      if (!options.createDocument) {
        throw new Error("No create document configured for useFormPage");
      }
      const { payload, connect } = normalizeApitoFormSaveInput(input);
      return apitoGraphQLRequest(fetcher, options.createDocument, {
        payload,
        ...(connect ? { connect } : {}),
      });
    },
    onSuccess: () =>
      void invalidateApitoQueriesAfterMutation(queryClient, options.resource),
  });

  const updateMutation = useMutation({
    mutationKey: ["apito-form-update", options.resource, options.id],
    mutationFn: (input: Record<string, unknown>) => {
      if (!options.updateDocument || !options.id) {
        throw new Error("No update document configured for useFormPage");
      }
      const { payload, connect, disconnect } = normalizeApitoFormSaveInput(input);
      return apitoGraphQLRequest(fetcher, options.updateDocument, {
        id: options.id,
        deltaUpdate: options.deltaUpdate ?? true,
        payload,
        ...(connect ? { connect } : {}),
        ...(disconnect ? { disconnect } : {}),
      });
    },
    onSuccess: () =>
      void invalidateApitoQueriesAfterMutation(queryClient, options.resource),
  });

  const record = oneQuery?.data?.[options.oneKey!] as ApitoRecord | undefined;

  const save = useCallback(
    async (values: Record<string, unknown>) => {
      const { payload, connect, disconnect } = normalizeApitoFormSaveInput(values);
      if (isEdit) {
        if (options.updateDocument) {
          return updateMutation.mutateAsync({ payload, connect, disconnect });
        }
        if (legacyUpdateMutation) {
          return legacyUpdateMutation.mutateAsync({
            id: options.id,
            deltaUpdate: options.deltaUpdate ?? true,
            payload,
            ...(connect ? { connect } : {}),
            ...(disconnect ? { disconnect } : {}),
          });
        }
      } else {
        if (options.createDocument) {
          return createMutation.mutateAsync({ payload, connect });
        }
        if (legacyCreateMutation) {
          return legacyCreateMutation.mutateAsync({
            payload,
            ...(connect ? { connect } : {}),
          });
        }
      }
      throw new Error("No mutation configured for useFormPage");
    },
    [
      isEdit,
      options.id,
      options.createDocument,
      options.updateDocument,
      createMutation,
      updateMutation,
      legacyCreateMutation,
      legacyUpdateMutation,
    ],
  );

  const isSaving =
    createMutation.isPending ||
    updateMutation.isPending ||
    legacyCreateMutation?.isPending ||
    legacyUpdateMutation?.isPending ||
    false;

  return {
    isEdit,
    isLoading: oneQuery?.isLoading ?? false,
    error: oneQuery?.error ?? null,
    record,
    initialValues: record ? apitoRecordToFormValues(record) : {},
    save,
    isSaving,
  };
}

export type UseShowPageOptions = {
  id: string;
  useOneQuery: (
    fetcher: ReturnType<typeof useApitoFetcher>,
    variables: { id: string },
    options?: { enabled?: boolean },
  ) => {
    data?: Record<string, unknown>;
    isLoading: boolean;
    error: Error | null;
    refetch: () => void;
  };
  oneKey: string;
};

export function useShowPage<TRecord extends ApitoRecord = ApitoRecord>(
  options: UseShowPageOptions,
) {
  const fetcher = useApitoFetcher();
  const query = options.useOneQuery(fetcher, { id: options.id });
  const record = query.data?.[options.oneKey] as TRecord | undefined;

  return {
    record,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useDeleteRecord(options: {
  deleteDocument?: GraphQLQueryInput;
  useDeleteMutation?: (
    fetcher: ReturnType<typeof useApitoFetcher>,
  ) => {
    mutateAsync: (vars: { id: string }) => Promise<unknown>;
    isPending: boolean;
  };
  listQueryKey?: unknown[];
}) {
  const fetcher = useApitoFetcher();
  const queryClient = useQueryClient();
  const legacyMutation = options.useDeleteMutation?.(fetcher);

  const mutation = useMutation({
    mutationKey: ["apito-delete", options.deleteDocument],
    mutationFn: async (id: string) => {
      if (options.deleteDocument) {
        return apitoGraphQLRequest(fetcher, options.deleteDocument, {
          ids: [id],
        });
      }
      if (legacyMutation) {
        return legacyMutation.mutateAsync({ id });
      }
      throw new Error("No delete mutation configured for useDeleteRecord");
    },
    onSuccess: () => {
      void invalidateApitoDataQueries(queryClient);
    },
  });

  const remove = useCallback(
    async (id: string) => {
      await mutation.mutateAsync(id);
    },
    [mutation],
  );

  return { remove, isDeleting: mutation.isPending };
}

/** Minimal query hook helper for custom documents in app code. */
export function useApitoQuery<TData = unknown>(
  key: unknown[],
  document: GraphQLQueryInput,
  variables?: Record<string, unknown>,
  options?: Omit<
    UseQueryOptions<TData, Error, TData, unknown[]>,
    "queryKey" | "queryFn"
  >,
) {
  const fetcher = useApitoFetcher();
  const serialized = useMemo(() => {
    try {
      return serializeGraphQLQuery(document);
    } catch {
      return "";
    }
  }, [document]);

  return useQuery({
    queryKey: [...key, variables],
    queryFn: async () => {
      const res = await fetcher(serialized, variables);
      return res.data as TData;
    },
    enabled: options?.enabled !== false && Boolean(serialized),
    ...options,
  });
}

export type UseApitoCustomQueryOptions<TData = unknown> = {
  /** GraphQL document string, gql tag result, or DocumentNode */
  document?: GraphQLQueryInput;
  variables?: Record<string, unknown>;
  queryKey?: unknown[];
  queryOptions?: Omit<
    UseQueryOptions<TData, Error, TData, unknown[]>,
    "queryKey" | "queryFn"
  >;
};

/** Refine-compatible custom query: `{ query, result }` for legacy app hooks. */
export function useApitoCustomQuery<TData = Record<string, unknown>>(
  options: UseApitoCustomQueryOptions<TData>,
) {
  const queryKey = options.queryKey ?? ["apito-custom", options.document];
  const query = useApitoQuery<TData>(
    queryKey,
    options.document ?? "",
    options.variables,
    options.queryOptions,
  );

  return {
    query: {
      isLoading: query.isLoading,
      isFetching: query.isFetching,
      isError: query.isError,
      error: query.error,
      refetch: query.refetch,
    },
    result: { data: query.data },
  };
}

export function useApitoMutation<TVariables = Record<string, unknown>>(
  document: GraphQLQueryInput,
  options?: { onSuccess?: () => void },
) {
  const fetcher = useApitoFetcher();
  const queryClient = useQueryClient();
  const serialized = useMemo(() => serializeGraphQLQuery(document), [document]);
  return useMutation({
    mutationFn: async (variables: TVariables) => {
      const res = await fetcher(serialized, variables as Record<string, unknown>);
      return res.data;
    },
    onSuccess: () => {
      options?.onSuccess?.();
      void invalidateApitoDataQueries(queryClient);
    },
  });
}
