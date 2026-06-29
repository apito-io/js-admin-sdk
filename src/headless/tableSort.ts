import type { CrudSort } from "./types";

export type AntdSortOrder = "ascend" | "descend" | null | undefined;

/** Map Ant Design Table sorter order to SDK CrudSort. */
export function antdSorterToCrudSort(
  field: string,
  order: AntdSortOrder,
): CrudSort | null {
  if (!field || !order) return null;
  return {
    field,
    order: order === "descend" ? "desc" : "asc",
  };
}

/** Resolve Ant Table column dataIndex to Apito GraphQL sort field name. */
export function resolveSortField(
  dataIndex: string | number | readonly (string | number)[],
  sortFieldMap?: Record<string, string>,
): string {
  const key = Array.isArray(dataIndex)
    ? dataIndex.map(String).join(".")
    : String(dataIndex);

  if (sortFieldMap?.[key]) {
    return sortFieldMap[key];
  }

  const parts = key.split(".");
  return parts[parts.length - 1] ?? key;
}

/** Map SDK CrudSort order to Ant Design controlled sortOrder. */
export function crudSortToAntdOrder(
  sorters: CrudSort[],
  field: string,
): AntdSortOrder {
  const match = sorters.find((s) => s.field === field);
  if (!match) return null;
  return match.order === "desc" ? "descend" : "ascend";
}
