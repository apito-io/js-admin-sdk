import {
  apitoMultipleResourceName,
  apitoSingularResourceName,
  formatApitoConnectionSubselections,
  pascalFromAnyModelId,
} from "../naming/apitoGraphqlNames";

export type BuildListDocumentOptions = {
  resource: string;
  fields: string[];
  connectionFields?: Record<string, string>;
  aliasFields?: Record<string, string>;
  /** When false, omit `connection` arg (staff/notice on some tenants). */
  supportsConnection?: boolean;
};

export type BuildOneDocumentOptions = {
  resource: string;
  fields: string[];
  connectionFields?: Record<string, string>;
  aliasFields?: Record<string, string>;
};

function fieldBlock(fields: string[]): string {
  return fields.join("\n");
}

function connectionBlock(
  connectionFields: Record<string, string> | undefined,
  aliasFields: Record<string, string> | undefined,
): string {
  if (!connectionFields || !Object.keys(connectionFields).length) return "";
  return formatApitoConnectionSubselections(connectionFields, aliasFields ?? {});
}

/** Build list + listCount query document for a model. */
export function buildApitoListDocument(
  options: BuildListDocumentOptions,
): string {
  const {
    resource,
    fields,
    connectionFields,
    aliasFields,
    supportsConnection = true,
  } = options;
  const listRoot = apitoMultipleResourceName(resource);
  const pascal = pascalFromAnyModelId(resource);
  const conn = connectionBlock(connectionFields, aliasFields);
  const dataSelection = conn
    ? `${fieldBlock(fields)}\n${conn}`
    : fieldBlock(fields);

  const connectionArg = supportsConnection
    ? ", $connection: [Connection_Input!]"
    : "";
  const connectionVar = supportsConnection ? ", connection: $connection" : "";

  return `query Get${pascal}List(
  $where: ${listRoot.toUpperCase()}_INPUT_WHERE_PAYLOAD
  $sort: ${listRoot.toUpperCase()}_INPUT_SORT_PAYLOAD
  $_key: ${listRoot.toUpperCase()}_KEY_CONDITION
  $limit: Int
  $skip: Int${connectionArg}
) {
  ${listRoot}(
    where: $where
    sort: $sort
    _key: $_key
    limit: $limit
    skip: $skip${connectionVar}
  ) {
    id
    data {
      ${dataSelection}
    }
    meta {
      created_at
      status
      updated_at
    }
  }
  ${listRoot}Count(
    where: $where
    sort: $sort
    _key: $_key
  )
}`;
}

/** Build get-one query document. */
export function buildApitoOneDocument(
  options: BuildOneDocumentOptions,
): string {
  const { resource, fields, connectionFields, aliasFields } = options;
  const singular = apitoSingularResourceName(resource);
  const pascal = pascalFromAnyModelId(resource);
  const conn = connectionBlock(connectionFields, aliasFields);
  const dataSelection = conn
    ? `${fieldBlock(fields)}\n${conn}`
    : fieldBlock(fields);

  return `query Get${pascal}($id: String!) {
  ${singular}(id: $id) {
    id
    data {
      ${dataSelection}
    }
    meta {
      created_at
      status
      updated_at
    }
  }
}`;
}

/** Build create mutation document. */
export function buildApitoCreateDocument(
  resource: string,
  fields: string[],
): string {
  const singular = apitoSingularResourceName(resource);
  const pascal = pascalFromAnyModelId(resource);
  const payload = `${pascal.toUpperCase()}_CREATE_PAYLOAD`;
  const rel = `${pascal.toUpperCase()}_RELATION_CONNECT_PAYLOAD`;

  return `mutation Create${pascal}($payload: ${payload}!, $connect: ${rel}) {
  create${pascal}(payload: $payload, connect: $connect, status: published) {
    id
    data {
      ${fieldBlock(fields)}
    }
    meta {
      created_at
      status
      updated_at
    }
  }
}`;
}

/** Build update mutation document. */
export function buildApitoUpdateDocument(
  resource: string,
  fields: string[],
): string {
  const singular = apitoSingularResourceName(resource);
  const pascal = pascalFromAnyModelId(resource);
  const payload = `${pascal.toUpperCase()}_UPDATE_PAYLOAD`;
  const rel = `${pascal.toUpperCase()}_RELATION_CONNECT_PAYLOAD`;

  return `mutation Update${pascal}($id: String!, $payload: ${payload}!, $connect: ${rel}) {
  update${pascal}(id: $id, payload: $payload, connect: $connect) {
    id
    data {
      ${fieldBlock(fields)}
    }
    meta {
      created_at
      status
      updated_at
    }
  }
}`;
}

/** Build delete mutation document. */
export function buildApitoDeleteDocument(resource: string): string {
  const pascal = pascalFromAnyModelId(resource);
  return `mutation Delete${pascal}($id: String!) {
  delete${pascal}(id: $id) {
    id
  }
}`;
}
