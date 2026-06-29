import type { ApitoExportConfig } from "./types";

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
  if (config.mapRecordToRow) {
    return records.map((record) =>
      Object.fromEntries(
        Object.entries(config.mapRecordToRow!(record)).map(([key, value]) => [
          key,
          value == null ? "" : String(value),
        ]),
      ),
    );
  }

  return records.map((record) => {
    const row: Record<string, string> = {};
    for (const column of config.columns) {
      const data =
        record.data && typeof record.data === "object"
          ? (record.data as Record<string, unknown>)
          : record;
      const value = (data as Record<string, unknown>)[column.id];
      row[column.id] = value == null ? "" : String(value);
    }
    if (config.columns.some((c) => c.isId || c.id === "_id")) {
      row._id = record.id ? String(record.id) : "";
    }
    return row;
  });
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
