import type { ApitoImportRowError, ApitoValidatedImportRow } from "./types";

function getStr(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function dedupeRowErrors(errors: ApitoImportRowError[]): ApitoImportRowError[] {
  const seen = new Set<string>();
  return errors.filter((error) => {
    const key = `${error.field}\0${error.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export type VerticalGroupOptions = {
  /**
   * Parent identity columns filled only on the first (anchor) row of a group.
   * Continuation rows must leave these blank.
   */
  anchorColumns: string[];
  /**
   * Optional mid-level columns (e.g. division fields). Filled when a new mid
   * group starts within the parent; blank on further continuation rows.
   */
  midLevelColumns?: string[];
  /** Required on every row (anchor + continuation), e.g. `section_code`. */
  requiredEveryRow?: string[];
  /**
   * Required on parent anchor rows.
   * Defaults to `anchorColumns` excluding `_id`.
   */
  requiredOnAnchor?: string[];
  /** Required when a mid-level group starts (e.g. `division_name`). */
  requiredOnMid?: string[];
};

/** True when any anchor column has a value (starts a new parent group). */
export function isVerticalAnchorRow(
  row: Record<string, unknown>,
  anchorColumns: string[],
): boolean {
  return anchorColumns.some((col) => getStr(row[col]) !== "");
}

/**
 * Whether a preview cell may be edited for vertical (blanked) CSV layouts.
 * Anchor cols: only on parent header rows.
 * Mid cols: on parent header or mid-level start rows.
 * Other cols: always editable.
 */
export function isVerticalImportCellEditable(
  row: Record<string, unknown>,
  columnId: string,
  options: {
    anchorColumns: string[];
    midLevelColumns?: string[];
  },
): boolean {
  const midColumns = options.midLevelColumns ?? [];
  const isParentAnchor = isVerticalAnchorRow(row, options.anchorColumns);
  const isMidAnchor =
    midColumns.length > 0 && isVerticalAnchorRow(row, midColumns);

  if (options.anchorColumns.includes(columnId)) {
    return isParentAnchor;
  }
  if (midColumns.includes(columnId)) {
    return isParentAnchor || isMidAnchor;
  }
  return true;
}

/**
 * Blank repeated parent fields on export so only the first row of each group
 * carries identity columns (cleaner CSV).
 */
export function blankVerticalAnchorFields(
  row: Record<string, string>,
  anchorColumns: string[],
  isAnchor: boolean,
): Record<string, string> {
  if (isAnchor) return row;
  const next = { ...row };
  for (const col of anchorColumns) {
    next[col] = "";
  }
  return next;
}

/**
 * Cross-row validation for vertical (anchor + optional mid + continuation) CSV layouts.
 * Use as `ApitoImportConfig.validateAllRows`.
 */
export function validateVerticalContinuationRows(
  rows: ApitoValidatedImportRow[],
  options: VerticalGroupOptions,
): ApitoValidatedImportRow[] {
  const anchorColumns = options.anchorColumns;
  const midColumns = options.midLevelColumns ?? [];
  const requiredOnAnchor =
    options.requiredOnAnchor ??
    anchorColumns.filter((c) => c !== "_id" && c !== "id");
  const requiredOnMid = options.requiredOnMid ?? [];
  const requiredEvery = options.requiredEveryRow ?? [];

  let groupOpen = false;
  let groupOperation: "create" | "update" = "create";

  for (const row of rows) {
    const isClassAnchor = isVerticalAnchorRow(row, anchorColumns);
    const isMidAnchor =
      midColumns.length > 0 && isVerticalAnchorRow(row, midColumns);

    if (isClassAnchor) {
      groupOpen = true;
      groupOperation = row._operation === "update" ? "update" : "create";
      for (const col of requiredOnAnchor) {
        if (getStr(row[col]) === "") {
          row._errors.push({
            rowIndex: row._rowIndex,
            field: col,
            message: `${col} is required on the first row of a group`,
          });
        }
      }
      if (isMidAnchor) {
        for (const col of requiredOnMid) {
          if (getStr(row[col]) === "") {
            row._errors.push({
              rowIndex: row._rowIndex,
              field: col,
              message: `${col} is required when starting a mid-level group`,
            });
          }
        }
      }
    } else if (isMidAnchor) {
      if (!groupOpen) {
        row._errors.push({
          rowIndex: row._rowIndex,
          field: midColumns[0] ?? "division_name",
          message:
            "Mid-level row must follow a group header row (fill name/code on the first row only)",
        });
      } else {
        // Blanked identity → inherit parent create/update for import preview stats
        row._operation = groupOperation;
      }
      for (const col of requiredOnMid) {
        if (getStr(row[col]) === "") {
          row._errors.push({
            rowIndex: row._rowIndex,
            field: col,
            message: `${col} is required when starting a mid-level group`,
          });
        }
      }
    } else {
      if (!groupOpen) {
        row._errors.push({
          rowIndex: row._rowIndex,
          field: anchorColumns[0] ?? "_id",
          message:
            "Continuation row must follow a group header row (fill name/code on the first row only)",
        });
      } else {
        row._operation = groupOperation;
      }
      for (const col of [...anchorColumns, ...midColumns]) {
        if (getStr(row[col]) !== "") {
          row._errors.push({
            rowIndex: row._rowIndex,
            field: col,
            message: `${col} must be empty on continuation rows (fill only on the first row of the group)`,
          });
        }
      }
    }

    for (const col of requiredEvery) {
      if (getStr(row[col]) === "") {
        row._errors.push({
          rowIndex: row._rowIndex,
          field: col,
          message: `${col} is required`,
        });
      }
    }

    row._errors = dedupeRowErrors(row._errors);
    row._isValid = row._errors.length === 0;
  }

  return rows;
}

/**
 * Sequential groups: a new group starts when any anchor column is filled;
 * following empty-anchor rows (including mid-level starts) attach to that group.
 */
export function groupVerticalImportRows(
  rows: ApitoValidatedImportRow[],
  anchorColumns: string[],
): ApitoValidatedImportRow[][] {
  const groups: ApitoValidatedImportRow[][] = [];
  let current: ApitoValidatedImportRow[] | null = null;

  for (const row of rows) {
    if (isVerticalAnchorRow(row, anchorColumns)) {
      current = [row];
      groups.push(current);
      continue;
    }
    if (!current) {
      current = [row];
      groups.push(current);
      continue;
    }
    current.push(row);
  }

  return groups;
}
