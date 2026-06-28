export type ApitoRecordMeta = {
  created_at?: string | null;
  status?: string | null;
  updated_at?: string | null;
};

export type ApitoRecord<TData = Record<string, unknown>> = {
  id: string;
  data: TData;
  meta?: ApitoRecordMeta;
};

export type CrudFilter = {
  field: string;
  operator: string;
  value?: unknown;
};

export type CrudSort = {
  field: string;
  order: "asc" | "desc";
};

export type ListPagePagination = {
  current: number;
  pageSize: number;
};

export type ApitoListConnection = {
  _id: string;
  connection_type: "forward";
  relation_type: "has_many" | "has_one";
  model?: string;
  to_model?: string;
  known_as?: string;
};
