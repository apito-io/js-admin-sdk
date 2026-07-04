import type { CrudFilter } from "../types";

export type ApitoImportSchemaIssue = {
  path: (string | number)[];
  message: string;
};

export type ApitoImportSchema<T> = {
  safeParse: (
    input: unknown,
  ) =>
    | { success: true; data: T }
    | { success: false; issues: ApitoImportSchemaIssue[] };
};

export type ApitoImportFileType = "csv" | "xlsx";

export type ApitoImportColumnType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "media";

export type ApitoImportRelationColumn = {
  /** GraphQL relation name, e.g. `class` */
  relation: string;
  /** Connect key used in mutation payload, e.g. `class_id` */
  connectKey: string;
  type?: "has_one" | "has_many";
};

export type ApitoImportColumn = {
  id: string;
  label: string;
  required?: boolean;
  aliases?: string[];
  type?: ApitoImportColumnType;
  /** Apito `data` field to read when it differs from `id` (e.g. `image_url` → `image`). */
  sourceField?: string;
  relation?: ApitoImportRelationColumn;
  /** Marks this column as the record id used for update detection */
  isId?: boolean;
};

export type ApitoImportRowError = {
  rowIndex: number;
  field: string;
  message: string;
};

export type ApitoValidatedImportRow = {
  _rowIndex: number;
  _errors: ApitoImportRowError[];
  _isValid: boolean;
  _operation: "create" | "update";
  [key: string]: unknown;
};

export type ApitoImportValidationResult = {
  rows: ApitoValidatedImportRow[];
  validCount: number;
  errorCount: number;
  newCount: number;
  updateCount: number;
};

export type ApitoParsedImportFile = {
  headers: string[];
  rows: Array<Record<string, string>>;
  fileType: ApitoImportFileType;
};

export type ApitoImportColumnMapping = Record<string, string | null>;

export type ApitoImportMutationInput = {
  operation: "create" | "update";
  id?: string;
  payload: Record<string, unknown>;
  connect?: Record<string, string>;
};

export type ApitoImportConfig<TRow extends Record<string, unknown> = Record<string, unknown>> = {
  resource: string;
  columns: ApitoImportColumn[];
  /** Application-side schema (e.g. Zod) for domain validation */
  schema?: ApitoImportSchema<TRow>;
  /** Custom row validator; runs after SDK default validation */
  validateRow?: (row: ApitoValidatedImportRow) => ApitoImportRowError[];
  /** Column used for update detection; defaults to `_id` */
  idColumn?: string;
  /** Defaults: `_id` present => update, otherwise create */
  resolveOperation?: (
    row: ApitoValidatedImportRow,
  ) => "create" | "update" | "skip";
  /** Map validated row to Apito mutation input */
  mapRowToMutation?: (row: ApitoValidatedImportRow) => ApitoImportMutationInput;
  /** Cross-row validation after per-row checks (e.g. carry-forward rules) */
  validateAllRows?: (
    rows: ApitoValidatedImportRow[],
  ) => ApitoValidatedImportRow[];
};

export type ApitoExportConfig<TRow extends Record<string, unknown> = Record<string, unknown>> = {
  resource: string;
  columns: ApitoImportColumn[];
  filters?: CrudFilter[];
  meta?: Record<string, unknown>;
  filenamePrefix?: string;
  mapRecordToRow?: (record: Record<string, unknown>) => TRow;
  /** When one record expands to multiple export rows (e.g. food sizes) */
  flattenRecordsToRows?: (
    records: Array<Record<string, unknown>>,
  ) => Array<Record<string, string>>;
};

/** Progress reporter passed to custom `onImportRows` handlers */
export type ApitoImportRowsContext = {
  /** Call after each row/batch is processed; omit `total` to keep the modal row count */
  reportProgress: (processed: number, total?: number) => void;
};
