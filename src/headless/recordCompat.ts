import type { ApitoRecord } from "./types";

/** Refine-shaped query wrapper used by legacy app shims (`const { data } = query`). */
export type ApitoCompatQueryState<TRecord> = {
  data: { data: TRecord } | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
};

export type ApitoCompatOneResult<TRecord> = {
  record: TRecord | undefined;
  data: TRecord | undefined;
  result: TRecord | undefined;
  query: ApitoCompatQueryState<TRecord>;
};

export function buildApitoCompatQueryState<TRecord>(
  record: TRecord | undefined,
  options: {
    isLoading: boolean;
    isFetching?: boolean;
    error?: Error | null;
    refetch?: () => void;
  },
): ApitoCompatQueryState<TRecord> {
  const isLoading = options.isLoading;
  const error = options.error ?? null;
  return {
    data: record ? { data: record } : undefined,
    isLoading,
    isFetching: options.isFetching ?? isLoading,
    isError: Boolean(error),
    error,
    refetch: options.refetch ?? (() => {}),
  };
}

export function buildApitoCompatOneResult<TRecord>(
  record: TRecord | undefined,
  options: {
    isLoading: boolean;
    isFetching?: boolean;
    error?: Error | null;
    refetch?: () => void;
  },
): ApitoCompatOneResult<TRecord> {
  const query = buildApitoCompatQueryState(record, options);
  return {
    record,
    data: record,
    result: record,
    query,
  };
}

function pascalFromResource(resource: string): string {
  return resource
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/** Extract created/updated record node from Apito mutation result. */
export function getSavedRecordNode(
  result: unknown,
  resource: string,
): ApitoRecord | undefined {
  if (!result || typeof result !== "object") return undefined;

  const data =
    "data" in result && (result as { data?: unknown }).data != null
      ? (result as { data: unknown }).data
      : result;

  if (!data || typeof data !== "object") return undefined;

  const pascal = pascalFromResource(resource);
  const createKey = `create${pascal}`;
  const updateKey = `update${pascal}`;
  const record =
    (data as Record<string, unknown>)[createKey] ??
    (data as Record<string, unknown>)[updateKey] ??
    data;

  return record && typeof record === "object"
    ? (record as ApitoRecord)
    : undefined;
}

/** Extract created/updated record id from Apito mutation result. */
export function getSavedRecordId(
  result: unknown,
  resource: string,
): string | undefined {
  const record = getSavedRecordNode(result, resource);
  if (!record) return undefined;
  const id = record.id;
  return id == null ? undefined : String(id);
}

export type ApitoSavedMutationMeta = {
  result: unknown;
  id?: string;
  action: "create" | "update";
  resource: string;
  record?: ApitoRecord;
};
