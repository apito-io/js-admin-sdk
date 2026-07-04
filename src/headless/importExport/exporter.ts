import {
  formatMediaUrlForExport,
  isMediaLikeValue,
} from "../mediaUpload/formatMediaUrlForExport";
import type { ApitoExportConfig, ApitoImportColumn } from "./types";

function isMediaExportColumn(column: ApitoImportColumn): boolean {
  if (column.type === "media") return true;
  const id = column.id.toLowerCase();
  if (id === "image" || id === "logo" || id === "avatar") return true;
  if (id.endsWith("_url")) return true;
  return false;
}

function resolveExportDataField(
  data: Record<string, unknown>,
  column: ApitoImportColumn,
): unknown {
  if (column.sourceField) {
    return data[column.sourceField];
  }

  const id = column.id;
  if (id.toLowerCase().endsWith("_url")) {
    const baseField = id.replace(/_url$/i, "");
    if (baseField !== id && data[baseField] !== undefined) {
      return data[baseField];
    }
  }

  return data[id];
}

function formatExportCellValue(
  value: unknown,
  column: ApitoImportColumn,
): string {
  if (value == null) return "";
  if (isMediaExportColumn(column) || isMediaLikeValue(value)) {
    return formatMediaUrlForExport(value);
  }
  if (typeof value === "object") {
    const mediaUrl = formatMediaUrlForExport(value);
    if (mediaUrl) return mediaUrl;
    return "";
  }
  return String(value);
}

function resolveRelationNode(
  record: Record<string, unknown>,
  relationName: string,
): Record<string, unknown> | undefined {
  const node = record[relationName];
  if (node && typeof node === "object" && !Array.isArray(node)) {
    return node as Record<string, unknown>;
  }
  return undefined;
}

/** Derive GraphQL relation subselections from import/export column config. */
export function deriveExportConnectionFieldsFromColumns(
  columns: ApitoImportColumn[],
): Record<string, string> {
  const fields: Record<string, string> = {};
  const seen = new Set<string>();

  for (const column of columns) {
    if (!column.relation) continue;
    const relationName = column.relation.relation;
    if (seen.has(relationName)) continue;
    seen.add(relationName);
    fields[relationName] = "id data { code name }";
  }

  return fields;
}

export function mapRecordToExportRowDefault(
  record: Record<string, unknown>,
  columns: ApitoImportColumn[],
): Record<string, string> {
  const data =
    record.data && typeof record.data === "object"
      ? (record.data as Record<string, unknown>)
      : record;

  const row: Record<string, string> = {};

  for (const column of columns) {
    if (column.isId || column.id === "_id") {
      row._id = record.id ? String(record.id) : "";
      continue;
    }

    if (column.relation) {
      const relationNode = resolveRelationNode(record, column.relation.relation);
      const relationData =
        relationNode?.data && typeof relationNode.data === "object"
          ? (relationNode.data as Record<string, unknown>)
          : {};

      if (column.id === column.relation.connectKey) {
        row[column.id] = relationNode?.id ? String(relationNode.id) : "";
        continue;
      }

      if (column.id === column.relation.relation) {
        row[column.id] =
          relationData.code != null
            ? String(relationData.code)
            : relationData.name != null
              ? String(relationData.name)
              : "";
        continue;
      }
    }

    const value = resolveExportDataField(data as Record<string, unknown>, column);
    row[column.id] = formatExportCellValue(value, column);
  }

  return row;
}

export function rowsToCsvContent(
  rows: Array<Record<string, string>>,
  headers: readonly string[],
): string {
  const csvBodyRows = rows.map((row) =>
    headers.map((header) => {
      const raw = String(row[header] ?? "");
      return `"${raw.replace(/"/g, '""')}"`;
    }),
  );
  return [headers.join(","), ...csvBodyRows.map((r) => r.join(","))].join("\n");
}

export function downloadTextFile(
  filename: string,
  content: string,
  mime: string,
): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function buildExportRows(
  records: Array<Record<string, unknown>>,
  config: ApitoExportConfig,
): Array<Record<string, string>> {
  if (config.flattenRecordsToRows) {
    return config.flattenRecordsToRows(records);
  }

  if (config.mapRecordToRow) {
    return records.map((record) =>
      Object.fromEntries(
        Object.entries(config.mapRecordToRow!(record)).map(([key, value]) => {
          const column = config.columns.find((item) => item.id === key);
          if (column) {
            return [key, formatExportCellValue(value, column)];
          }
          if (isMediaLikeValue(value)) {
            return [key, formatMediaUrlForExport(value)];
          }
          return [key, value == null ? "" : String(value)];
        }),
      ),
    );
  }

  return records.map((record) =>
    mapRecordToExportRowDefault(record, config.columns),
  );
}

export function getExportHeaders(config: ApitoExportConfig): string[] {
  return config.columns.map((column) => column.id);
}

export async function fetchAllListPages<T>(options: {
  fetchPage: (skip: number, limit: number) => Promise<{ items: T[]; total: number }>;
  pageSize?: number;
}): Promise<T[]> {
  const pageSize = options.pageSize ?? 200;
  const first = await options.fetchPage(0, pageSize);
  const all = [...first.items];
  if (first.total <= all.length) return all;

  let skip = pageSize;
  while (skip < first.total) {
    const page = await options.fetchPage(skip, pageSize);
    all.push(...page.items);
    skip += pageSize;
    if (!page.items.length) break;
  }
  return all;
}
