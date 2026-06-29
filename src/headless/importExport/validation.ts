import type {
  ApitoImportColumn,
  ApitoImportColumnMapping,
  ApitoImportConfig,
  ApitoImportRowError,
  ApitoImportValidationResult,
  ApitoParsedImportFile,
  ApitoValidatedImportRow,
} from "./types";

function getStr(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function isRowEmpty(row: Record<string, unknown>, columnIds: string[]): boolean {
  return columnIds.every((id) => getStr(row[id]) === "");
}

function coerceValue(
  value: string,
  type: ApitoImportColumn["type"] = "string",
): unknown {
  if (type === "number") {
    if (value === "") return "";
    const num = Number(value);
    return Number.isNaN(num) ? value : num;
  }
  if (type === "boolean") {
    const lower = value.toLowerCase();
    if (["true", "1", "yes"].includes(lower)) return true;
    if (["false", "0", "no"].includes(lower)) return false;
    return value;
  }
  return value;
}

function defaultValidateRow(
  row: ApitoValidatedImportRow,
  columns: ApitoImportColumn[],
): ApitoImportRowError[] {
  const errors: ApitoImportRowError[] = [];
  const columnIds = columns.map((c) => c.id);

  if (isRowEmpty(row, columnIds)) {
    return errors;
  }

  for (const column of columns) {
    const raw = getStr(row[column.id]);
    if (column.required && raw === "") {
      errors.push({
        rowIndex: row._rowIndex,
        field: column.id,
        message: `${column.label} is required`,
      });
      continue;
    }

    if (column.type === "number" && raw !== "") {
      const num = Number(raw);
      if (Number.isNaN(num)) {
        errors.push({
          rowIndex: row._rowIndex,
          field: column.id,
          message: `${column.label} must be a valid number`,
        });
      }
    }
  }

  return errors;
}

function resolveOperation(
  row: ApitoValidatedImportRow,
  config: ApitoImportConfig,
): "create" | "update" | "skip" {
  if (config.resolveOperation) {
    return config.resolveOperation(row);
  }
  const idColumn = config.idColumn ?? "_id";
  const id = getStr(row[idColumn]);
  return id ? "update" : "create";
}

export function autoMapColumns(
  parsed: ApitoParsedImportFile,
  columns: ApitoImportColumn[],
): ApitoImportColumnMapping {
  const mapping: ApitoImportColumnMapping = {};

  for (const column of columns) {
    const match = parsed.headers.find((header) => {
      const trimmed = header.trim();
      const canonical = trimmed.toUpperCase().replace(/\s+/g, "_");
      if (canonical === column.id.toUpperCase()) return true;
      if (
        column.aliases?.some(
          (alias) => alias.toLowerCase() === trimmed.toLowerCase(),
        )
      ) {
        return true;
      }
      return (
        column.label.toLowerCase().replace(/\s+/g, " ") ===
        trimmed.toLowerCase().replace(/\s+/g, " ")
      );
    });
    mapping[column.id] = match ?? null;
  }

  return mapping;
}

export function mapParsedRows(
  parsed: ApitoParsedImportFile,
  mapping: ApitoImportColumnMapping,
  columns: ApitoImportColumn[],
): Array<Record<string, string>> {
  return parsed.rows.map((row) => {
    const mapped: Record<string, string> = {};
    for (const column of columns) {
      const header = mapping[column.id];
      mapped[column.id] =
        header && row[header] !== undefined ? String(row[header]).trim() : "";
    }
    return mapped;
  });
}

export function validateImportRows(
  rawRows: Array<Record<string, string>>,
  config: ApitoImportConfig,
): ApitoImportValidationResult {
  const columnIds = config.columns.map((c) => c.id);
  const rows: ApitoValidatedImportRow[] = rawRows.map((raw, index) => {
    const row: ApitoValidatedImportRow = {
      _rowIndex: index,
      _errors: [],
      _isValid: true,
      _operation: "create",
    };

    for (const column of config.columns) {
      const value = raw[column.id] ?? "";
      row[column.id] = coerceValue(value, column.type);
    }

    if (isRowEmpty(row, columnIds)) {
      row._isValid = true;
      row._operation = "create";
      return row;
    }

    row._errors.push(...defaultValidateRow(row, config.columns));

    if (config.schema) {
      const parsed = config.schema.safeParse(row);
      if ("issues" in parsed) {
        for (const issue of parsed.issues) {
          row._errors.push({
            rowIndex: row._rowIndex,
            field: String(issue.path[0] ?? ""),
            message: issue.message,
          });
        }
      } else {
        Object.assign(row, parsed.data);
      }
    }

    if (config.validateRow) {
      row._errors.push(...config.validateRow(row));
    }

    const operation = resolveOperation(row, config);
    row._operation = operation === "skip" ? "create" : operation;
    row._isValid = row._errors.length === 0 && operation !== "skip";
    return row;
  });

  const dataRows = rows.filter((row) => !isRowEmpty(row, columnIds));
  const validRows = dataRows.filter((row) => row._isValid);
  const errorCount = dataRows.filter((row) => !row._isValid).length;
  const newCount = validRows.filter((row) => row._operation === "create").length;
  const updateCount = validRows.filter((row) => row._operation === "update").length;

  return {
    rows: dataRows,
    validCount: validRows.length,
    errorCount,
    newCount,
    updateCount,
  };
}

export function buildDefaultMutation(
  row: ApitoValidatedImportRow,
  config: ApitoImportConfig,
) {
  const idColumn = config.idColumn ?? "_id";
  const id = getStr(row[idColumn]);
  const payload: Record<string, unknown> = {};
  const connect: Record<string, string> = {};

  for (const column of config.columns) {
    if (column.isId || column.id === idColumn) continue;
    const value = row[column.id];
    if (column.relation) {
      const relationValue = getStr(value);
      if (relationValue) {
        connect[column.relation.connectKey] = relationValue;
      }
      continue;
    }
    if (value !== "" && value !== undefined && value !== null) {
      payload[column.id] = value;
    }
  }

  return {
    operation: row._operation,
    id: id || undefined,
    payload,
    connect: Object.keys(connect).length > 0 ? connect : undefined,
  };
}
