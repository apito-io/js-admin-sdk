import type { ApitoListConnection } from "./types";

/** Parent-document scoped list `connection` payload (special-case API only). */
export function buildListConnectionScope(parentId: string): ApitoListConnection {
  return {
    _id: parentId,
    connection_type: "forward",
    relation_type: "has_many",
  };
}
