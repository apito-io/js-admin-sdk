/** Apito GraphQL date fields expect RFC3339 / ISO-8601, not bare YYYY-MM-DD. */

import {
  apitoMutationConnectHasManyIdsField,
  apitoMutationConnectHasOneIdField,
} from "../naming/apitoGraphqlNames";
import { normalizeApitoRelationConnectMap } from "./mutationConnect";

const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T/;

type DayjsLike = {
  isValid: () => boolean;
  format: (pattern: string) => string;
  toISOString?: () => string;
};

function isDayjsLike(value: unknown): value is DayjsLike {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as DayjsLike).isValid === "function" &&
    typeof (value as DayjsLike).format === "function"
  );
}

export function isApitoDateString(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return ISO_DATE_ONLY.test(trimmed) || ISO_DATE_TIME.test(trimmed);
}

/** Serialize Ant Design / dayjs / Date / date-string values for Apito mutations. */
export function serializeApitoDateValue(value: unknown): string | undefined {
  if (value == null) return undefined;

  if (isDayjsLike(value)) {
    if (!value.isValid()) return undefined;
    if (typeof value.toISOString === "function") {
      return value.toISOString();
    }
    return serializeApitoDateValue(value.format("YYYY-MM-DD"));
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    if (ISO_DATE_TIME.test(trimmed)) {
      const parsed = new Date(trimmed);
      return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
    }
    if (ISO_DATE_ONLY.test(trimmed)) {
      const parsed = new Date(`${trimmed}T00:00:00.000Z`);
      return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
    }
  }

  return undefined;
}

export function isApitoDateFormValue(value: unknown): boolean {
  if (value == null) return false;
  if (isDayjsLike(value) || value instanceof Date) return true;
  return isApitoDateString(value);
}

/** Normalize a single form field before save (dates → ISO, pass-through otherwise). */
export function serializeApitoFormFieldValue(value: unknown): unknown {
  if (!isApitoDateFormValue(value)) return value;
  const iso = serializeApitoDateValue(value);
  return iso ?? value;
}

/** Shallow-serialize all date-like keys in a mutation payload. */
export function serializeApitoPayloadValues(
  values: Record<string, unknown>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    payload[key] = serializeApitoFormFieldValue(value);
  }
  return payload;
}

export function stripEmptyRelationFields(
  values?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  return normalizeApitoRelationConnectMap(values);
}

const RECORD_ROOT_SKIP_KEYS = new Set(["id", "data", "meta", "connect", "disconnect"]);

function isHasOneRelationNode(
  value: unknown,
): value is { id: string; data?: unknown } {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "id" in value &&
    typeof (value as { id: unknown }).id === "string"
  );
}

function isHasManyRelationNodes(
  value: unknown,
): value is Array<{ id: string }> {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => isHasOneRelationNode(item))
  );
}

function relationConnectKey(fieldName: string, cardinality: "one" | "many"): string {
  if (cardinality === "many") {
    return apitoMutationConnectHasManyIdsField(fieldName);
  }
  return apitoMutationConnectHasOneIdField(fieldName);
}

/** Build mutation `connect` map from relation nodes on the Apito record root. */
export function buildConnectFromApitoRecord(
  record: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const connect: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    if (RECORD_ROOT_SKIP_KEYS.has(key)) continue;
    if (isHasManyRelationNodes(value)) {
      connect[relationConnectKey(key, "many")] = value.map((item) => item.id);
      continue;
    }
    if (isHasOneRelationNode(value)) {
      connect[relationConnectKey(key, "one")] = value.id;
    }
  }

  return stripEmptyRelationFields(connect);
}

/** Map Apito record (with relations) to Ant Design nested form values. */
export function apitoRecordToFormValues(
  record: Record<string, unknown>,
  options?: {
    relationConnectKeys?: Record<string, string>;
  },
): Record<string, unknown> {
  const values: Record<string, unknown> = {
    data: record.data ?? {},
  };
  if (record.id) values.id = record.id;

  const connect = buildConnectFromApitoRecord(record) ?? {};
  if (options?.relationConnectKeys) {
    for (const [relationField, connectKey] of Object.entries(
      options.relationConnectKeys,
    )) {
      const rel = record[relationField];
      if (isHasManyRelationNodes(rel)) {
        connect[connectKey] = rel.map((item) => item.id);
      } else if (isHasOneRelationNode(rel)) {
        connect[connectKey] = rel.id;
      }
    }
  }

  const strippedConnect = stripEmptyRelationFields(connect);
  if (strippedConnect) values.connect = strippedConnect;

  return values;
}

export function normalizeApitoFormSaveInput(values: Record<string, unknown>): {
  payload: Record<string, unknown>;
  connect?: Record<string, unknown>;
  disconnect?: Record<string, unknown>;
} {
  if ("payload" in values || "connect" in values || "disconnect" in values) {
    return {
      payload: serializeApitoPayloadValues(
        (values.payload ?? {}) as Record<string, unknown>,
      ),
      connect: stripEmptyRelationFields(
        values.connect as Record<string, unknown> | undefined,
      ),
      disconnect: stripEmptyRelationFields(
        values.disconnect as Record<string, unknown> | undefined,
      ),
    };
  }
  return { payload: serializeApitoPayloadValues(values) };
}
