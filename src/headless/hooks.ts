"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";

import { useApitoFetcher } from "./context";
import {
  apitoRecordToFormValues,
  normalizeApitoFormSaveInput,
} from "./formValues";
import { apitoGraphQLRequest } from "./graphqlFetcher";
import { buildApitoFilterVariables, buildListQueryVariables } from "./filterVariables";
import {
  invalidateApitoDataQueries,
  invalidateApitoQueriesAfterMutation,
} from "./queryInvalidation";
import {
  serializeGraphQLQuery,
  type GraphQLQueryInput,
} from "./serializeGraphQLQuery";
import {
  buildApitoCompatOneResult,
  getSavedRecordId,
  getSavedRecordNode,
  type ApitoCompatOneResult,
  type ApitoSavedMutationMeta,
} from "./recordCompat";
import type {
  ApitoRecord,
  CrudFilter,
  CrudSort,
  ListPagePagination,
} from "./types";

export {
  buildApitoCompatOneResult,
  buildApitoCompatQueryState,
  getSavedRecordId,
  getSavedRecordNode,
  type ApitoCompatOneResult,
  type ApitoCompatQueryState,
  type ApitoSavedMutationMeta,
} from "./recordCompat";

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

  const variables = useMemo(
    () =>
      buildListQueryVariables({
        resource: options.resource,
        filters,
        sorters,
        pagination,
        supportsRelation: options.supportsConnection !== false,
      }),
    [
      options.resource,
      options.supportsConnection,
      filters,
      sorters,
      pagination,
    ],
  );

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
  /** Called after a successful create/update with parsed mutation metadata. */
  onSaved?: (meta: ApitoSavedMutationMeta) => void;
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
  const [lastSavedMeta, setLastSavedMeta] = useState<
    ApitoSavedMutationMeta | undefined
  >(undefined);
  const onSavedRef = useRef(options.onSaved);
  onSavedRef.current = options.onSaved;

  const notifySaved = useCallback(
    (result: unknown, action: "create" | "update") => {
      const record = getSavedRecordNode(result, options.resource);
      const id = record?.id != null ? String(record.id) : options.id;
      const meta: ApitoSavedMutationMeta = {
        result,
        id,
        action,
        resource: options.resource,
        record,
      };
      setLastSavedMeta(meta);
      onSavedRef.current?.(meta);
      return meta;
    },
    [options.id, options.resource],
  );

  const save = useCallback(
    async (values: Record<string, unknown>) => {
      const { payload, connect, disconnect } = normalizeApitoFormSaveInput(values);
      if (isEdit) {
        if (options.updateDocument) {
          const result = await updateMutation.mutateAsync({
            payload,
            connect,
            disconnect,
          });
          return notifySaved(result, "update");
        }
        if (legacyUpdateMutation) {
          const result = await legacyUpdateMutation.mutateAsync({
            id: options.id,
            deltaUpdate: options.deltaUpdate ?? true,
            payload,
            ...(connect ? { connect } : {}),
            ...(disconnect ? { disconnect } : {}),
          });
          return notifySaved(result, "update");
        }
      } else {
        if (options.createDocument) {
          const result = await createMutation.mutateAsync({ payload, connect });
          return notifySaved(result, "create");
        }
        if (legacyCreateMutation) {
          const result = await legacyCreateMutation.mutateAsync({
            payload,
            ...(connect ? { connect } : {}),
          });
          return notifySaved(result, "create");
        }
      }
      throw new Error("No mutation configured for useFormPage");
    },
    [
      isEdit,
      options.id,
      options.createDocument,
      options.updateDocument,
      options.deltaUpdate,
      createMutation,
      updateMutation,
      legacyCreateMutation,
      legacyUpdateMutation,
      notifySaved,
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
    lastSavedMeta,
    getSavedRecordId: (result: unknown) => getSavedRecordId(result, options.resource),
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
): ApitoCompatOneResult<TRecord> & {
  error: Error | null;
  refetch: () => void;
} {
  const fetcher = useApitoFetcher();
  const query = options.useOneQuery(fetcher, { id: options.id });
  const record = query.data?.[options.oneKey] as TRecord | undefined;

  const compat = buildApitoCompatOneResult(record, {
    isLoading: query.isLoading,
    isFetching: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  });

  return {
    ...compat,
    error: query.error,
    refetch: query.refetch,
  };
}

/** Refine-compatible alias for `useShowPage` with optional id enable gate. */
export function useOnePage<TRecord extends ApitoRecord = ApitoRecord>(
  options: UseShowPageOptions & { enabled?: boolean },
): ApitoCompatOneResult<TRecord> & {
  error: Error | null;
  refetch: () => void;
} {
  const fetcher = useApitoFetcher();
  const enabled = options.enabled !== false;
  const query = options.useOneQuery(
    fetcher,
    { id: options.id },
    { enabled },
  );
  const record = enabled
    ? (query.data?.[options.oneKey] as TRecord | undefined)
    : undefined;

  const compat = buildApitoCompatOneResult(record, {
    isLoading: enabled ? query.isLoading : false,
    isFetching: enabled ? query.isLoading : false,
    error: enabled ? query.error : null,
    refetch: query.refetch,
  });

  return {
    ...compat,
    error: enabled ? query.error : null,
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
