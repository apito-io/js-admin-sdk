#!/usr/bin/env npx tsx
/**
 * apito-codegen — introspection → operations → types/sdk/hooks → models/{model} facades.
 *
 * Usage:
 *   apito-codegen --schema introspection.json --out src/lib/apito-generated
 *   apito-codegen --config apito.config.ts --out src/lib/apito-generated
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { DocumentBuilder } from '../src/naming/documentBuilder';
import { formatApitoConnectionSubselections } from '../src/naming/apitoGraphqlNames';
import { introspectionToSdl, parseIntrospection } from '../src/naming/schemaReader';
import { normalizeIntrospection } from './normalize-introspection';
import { buildConnectionMetaTypes } from './codegen-meta';
import { buildCodegenConfigFromSchema, defaultCodegenUiPackage } from './schema-model-plan';

export type ApitoModelConfig = {
  name: string;
  fields: string[];
  supportsConnection?: boolean;
  /** When true, updates use deltaUpdate: false (required for models with `list` fields). */
  fullPayloadUpdate?: boolean;
  connectionFields?: Record<string, string>;
  aliasFields?: Record<string, string>;
};

export type ApitoCodegenConfig = {
  schema: string;
  uiPackage?: string;
  models: ApitoModelConfig[];
  customOperations?: string[];
};

function pascalCase(snake: string): string {
  if (snake.includes('_')) {
    return snake
      .split('_')
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join('');
  }
  return snake.charAt(0).toUpperCase() + snake.slice(1);
}

function gqlResourceName(model: string): string {
  return model
    .split('_')
    .map((part, i) => (i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('');
}

function flagValue(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index === -1 || index + 1 >= argv.length) return undefined;
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) return undefined;
  return value;
}

function parseArgs(argv: string[]) {
  const configValue = flagValue(argv, '--config');
  const schemaValue = flagValue(argv, '--schema');
  const outValue = flagValue(argv, '--out');
  const artifacts = flagValue(argv, '--artifacts') ?? 'app';
  if (!outValue || (!configValue && !schemaValue)) {
    throw new Error(
      'Usage: apito-codegen (--config <file> | --schema <introspection.json>) --out <dir> [--artifacts app|sdk] [--models a,b] [--ui-package <pkg>] [--no-relations] [--skip-document-validation]',
    );
  }
  if (artifacts !== 'app' && artifacts !== 'sdk') {
    throw new Error('--artifacts must be app or sdk');
  }
  const relationsFlag = flagValue(argv, '--relations');
  return {
    configPath: configValue ? path.resolve(process.cwd(), configValue) : '',
    schemaPath: schemaValue ? path.resolve(process.cwd(), schemaValue) : '',
    outDir: path.resolve(process.cwd(), outValue),
    skipDocumentsValidation: argv.includes('--skip-document-validation'),
    artifacts,
    models: (flagValue(argv, '--models') ?? '')
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean),
    includeRelations: !argv.includes('--no-relations') && relationsFlag !== 'false',
    uiPackage: flagValue(argv, '--ui-package') ?? '',
  };
}

async function loadConfig(configPath: string): Promise<ApitoCodegenConfig> {
  const mod = await import(pathToFileURL(configPath).href);
  const cfg = mod.default ?? mod.config;
  if (!cfg?.schema || !cfg?.models?.length) {
    throw new Error(`${configPath} must export default { schema, models[] }`);
  }
  return cfg as ApitoCodegenConfig;
}

function writeOperations(
  config: ApitoCodegenConfig,
  opsDir: string,
  schemaDir: string,
): void {
  const schemaPath = path.resolve(process.cwd(), config.schema);
  const raw = JSON.parse(fs.readFileSync(schemaPath, 'utf8')) as Record<string, unknown>;
  fs.mkdirSync(opsDir, { recursive: true });
  fs.mkdirSync(schemaDir, { recursive: true });

  for (const f of fs.readdirSync(opsDir)) {
    if (f.endsWith('.graphql')) fs.unlinkSync(path.join(opsDir, f));
  }

  fs.writeFileSync(path.join(schemaDir, 'schema.graphql'), introspectionToSdl(raw));
  fs.writeFileSync(
    path.join(schemaDir, 'introspection.normalized.json'),
    JSON.stringify(normalizeIntrospection(raw), null, 2),
  );

  for (const model of config.models) {
    const db = new DocumentBuilder(model.name, {
      supportsConnection: model.supportsConnection,
    });
    const selection = model.fields.filter((f) => f !== 'id');
    const connectionBlock = model.connectionFields
      ? formatApitoConnectionSubselections(
          model.connectionFields,
          model.aliasFields ?? {},
        )
      : '';
    const doc = db.generateGraphqlFile(selection.length ? selection : ['id'], connectionBlock);
    fs.writeFileSync(path.join(opsDir, `${model.name}.graphql`), doc);
    console.log(`wrote operations/${model.name}.graphql`);
  }

  if (config.customOperations?.length) {
    fs.writeFileSync(
      path.join(opsDir, 'custom.graphql'),
      config.customOperations.join('\n\n'),
    );
  }
}

function writeCodegenConfig(
  outDir: string,
  schemaDir: string,
  opsDir: string,
  skipDocumentsValidation = false,
  artifacts: 'app' | 'sdk' = 'app',
): string {
  const cfgPath = path.join(outDir, '.codegen.apito.ts');
  const relSchema = path.relative(outDir, path.join(schemaDir, 'introspection.normalized.json'));
  const relOps = path.relative(outDir, path.join(opsDir, '**/*.graphql'));

  const body = `const config = {
  schema: '${relSchema.replace(/\\/g, '/')}',
  documents: '${relOps.replace(/\\/g, '/')}',
  ignoreNoDocuments: true,
  config: {
    skipDocumentsValidation: ${skipDocumentsValidation},
  },
  generates: {
    'types.ts': {
      plugins: ['typescript', 'typescript-operations'],
      config: { skipTypename: true, avoidOptionals: true },
    },
    'sdk.ts': {
      plugins: ['typescript', 'typescript-operations', 'typescript-generic-sdk'],
      config: { documentMode: 'string', skipTypename: true, avoidOptionals: true },
    },${artifacts === 'sdk' ? '' : `
    'hooks.ts': {
      plugins: ['typescript', 'typescript-operations', 'typescript-react-query'],
      config: {
        fetcher: '@apito-io/js-admin-sdk/react#useApitoGraphQLFetcher',
        reactQueryVersion: 5,
        skipTypename: true,
        avoidOptionals: true,
        exposeFetcher: true,
        exposeQueryKeys: true,
        exposeMutationKeys: true,
      },
    },`}
  },
};

export default config;
`;
  fs.writeFileSync(cfgPath, body);
  return cfgPath;
}

function writeProjectHooks(
  config: ApitoCodegenConfig,
  outDir: string,
): void {
  const uiPackage = config.uiPackage ?? '@apito-io/js-admin-ui-antd';
  const modelsDir = path.join(outDir, 'models');
  fs.mkdirSync(modelsDir, { recursive: true });

  for (const model of config.models) {
    const pascal = pascalCase(model.name);
    const gql = gqlResourceName(model.name);
    const camel = model.name.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
    const modelDir = path.join(modelsDir, model.name);
    fs.mkdirSync(modelDir, { recursive: true });

    const fieldsConst = `${camel}Fields`;
    const supportsConn = model.supportsConnection !== false;
    const deltaUpdateLine = model.fullPayloadUpdate
      ? '\n    deltaUpdate: false,'
      : '';
    const connectionMeta = buildConnectionMetaTypes(model);

    fs.writeFileSync(
      path.join(modelDir, 'meta.ts'),
      `/** AUTO-GENERATED — do not edit. */
import type { Get${pascal}ListQuery, Get${pascal}Query } from "../../types";

type ${pascal}ListItem = NonNullable<
  NonNullable<Get${pascal}ListQuery["${gql}List"]>[number]
>;
export type ${pascal}Meta = NonNullable<${pascal}ListItem["meta"]>;
export type ${pascal}Data = NonNullable<${pascal}ListItem["data"]>;
${connectionMeta.relationTypeLines ? `${connectionMeta.relationTypeLines}\n` : ''}export type ${pascal} = {
  id: string;
  data: ${pascal}Data;
  meta: ${pascal}Meta;${connectionMeta.relationFieldLines ? `\n${connectionMeta.relationFieldLines}` : ''}
};

export const ${fieldsConst} = [
${model.fields.map((f) => `  "${f}",`).join('\n')}
] as const;
${connectionMeta.metaExports}
`,
    );

    fs.writeFileSync(
      path.join(modelDir, 'index.ts'),
      `/** AUTO-GENERATED — do not edit. */
"use client";

import { useListPage, useFormPage, useShowPage, useDeleteRecord } from "@apito-io/js-admin-sdk/react";
import type { CrudFilter, CrudSort } from "@apito-io/js-admin-sdk/react";
import {
  useGet${pascal}ListQuery,
  useGet${pascal}Query,
  Create${pascal}Document,
  Update${pascal}Document,
  Delete${pascal}Document,
} from "../../hooks";

import { ${fieldsConst}, type ${pascal}, type ${pascal}Data } from "./meta";

export * from "./meta";

const RESOURCE = "${model.name}" as const;
const LIST_KEY = "${gql}List";
const COUNT_KEY = "${gql}ListCount";
const ONE_KEY = "${gql}";

export function use${pascal}List(options?: {
  enabled?: boolean;
  initialFilters?: CrudFilter[];
  permanentFilters?: CrudFilter[];
  initialSorters?: CrudSort[];
  initialPagination?: { current: number; pageSize: number };
}) {
  return useListPage<${pascal}>({
    resource: RESOURCE,
    listKey: LIST_KEY,
    countKey: COUNT_KEY,
    supportsConnection: ${supportsConn},
    enabled: options?.enabled,
    initialFilters: options?.initialFilters,
    permanentFilters: options?.permanentFilters,
    initialSorters: options?.initialSorters,
    initialPagination: options?.initialPagination,
    useListQuery: (_fetcher, variables, opts) =>
      useGet${pascal}ListQuery(variables, opts),
  });
}

export function use${pascal}(id: string, options?: { enabled?: boolean }) {
  return useShowPage<${pascal}>({
    id,
    oneKey: ONE_KEY,
    useOneQuery: (_fetcher, vars, opts) =>
      useGet${pascal}Query(vars, opts),
  });
}

export function use${pascal}Form(id?: string) {
  return useFormPage({
    resource: RESOURCE,
    id,
    oneKey: ONE_KEY,${deltaUpdateLine}
    useOneQuery: (_fetcher, vars, opts) =>
      useGet${pascal}Query(vars, opts),
    createDocument: Create${pascal}Document,
    updateDocument: Update${pascal}Document,
  });
}

export function useDelete${pascal}() {
  return useDeleteRecord({
    deleteDocument: Delete${pascal}Document,
  });
}

export { ${fieldsConst} };
export type { ${pascal}Data };
`,
    );

    const uiName = pascal;
    fs.writeFileSync(
      path.join(modelDir, 'ui.tsx'),
      `/** AUTO-GENERATED — do not edit. Wires ${uiPackage} primitives + model hooks. */
"use client";

import {
  ApitoList,
  ApitoCreate,
  ApitoEdit,
  ApitoShow,
  ApitoDeleteButton,
  ApitoCreateButton,
} from "${uiPackage}";
import type {
  ApitoListProps,
  ApitoCreateProps,
  ApitoEditProps,
  ApitoShowProps,
  ApitoDeleteButtonProps,
  ApitoCreateButtonProps,
} from "@apito-io/js-admin-sdk/ui";

import {
  use${pascal}List,
  use${pascal}Form,
  use${pascal},
  useDelete${pascal},
} from "./index";
import type { ${pascal} } from "./meta";

export function List${uiName}(
  props: Omit<ApitoListProps<${pascal}>, keyof ReturnType<typeof use${pascal}List>> &
    Partial<ApitoListProps<${pascal}>>,
) {
  const list = use${pascal}List();
  return (
    <ApitoList<${pascal}>
      resource={RESOURCE}
      createRoute={\`/\${RESOURCE}/create\`}
      editRoute={\`/\${RESOURCE}/edit/$id\`}
      showRoute={\`/\${RESOURCE}/show/$id\`}
      {...list}
      {...props}
      pagination={props.pagination ?? list.pagination}
      onPaginationChange={props.onPaginationChange ?? list.setPagination}
    />
  );
}

export function Create${uiName}(
  props: Omit<ApitoCreateProps, "onFinish" | "initialValues" | "loading" | "saving"> &
    Partial<ApitoCreateProps>,
) {
  const form = use${pascal}Form();
  return (
    <ApitoCreate
      resource={RESOURCE}
      initialValues={form.initialValues}
      loading={form.isLoading}
      saving={form.isSaving}
      onFinish={form.save}
      {...props}
    />
  );
}

export function Edit${uiName}(
  props: { id: string } & Omit<ApitoEditProps, "onFinish" | "initialValues" | "loading" | "saving"> &
    Partial<ApitoEditProps>,
) {
  const form = use${pascal}Form(props.id);
  return (
    <ApitoEdit
      resource={RESOURCE}
      id={props.id}
      initialValues={form.initialValues}
      loading={form.isLoading}
      saving={form.isSaving}
      onFinish={form.save}
      {...props}
    />
  );
}

export function Show${uiName}(
  props: { id: string } & Omit<ApitoShowProps<${pascal}>, "record" | "loading"> &
    Partial<ApitoShowProps<${pascal}>>,
) {
  const show = use${pascal}(props.id);
  return (
    <ApitoShow<${pascal}>
      resource={RESOURCE}
      record={show.record}
      loading={show.isLoading}
      {...props}
    />
  );
}

export function Delete${uiName}Button(
  props: Omit<ApitoDeleteButtonProps, "onConfirm" | "loading"> &
    Partial<ApitoDeleteButtonProps>,
) {
  const del = useDelete${pascal}();
  return (
    <ApitoDeleteButton
      resource={RESOURCE}
      loading={del.isDeleting}
      onConfirm={() => del.remove(props.recordItemId)}
      {...props}
    />
  );
}

export function Create${uiName}Button(
  props: Omit<ApitoCreateButtonProps, "resource" | "createRoute"> &
    Partial<ApitoCreateButtonProps>,
) {
  return (
    <ApitoCreateButton
      resource={RESOURCE}
      createRoute={\`/\${RESOURCE}/create\`}
      {...props}
    />
  );
}

const RESOURCE = "${model.name}";
`,
    );

    const indexContent = fs.readFileSync(path.join(modelDir, 'index.ts'), 'utf8');
    if (!indexContent.includes(`List${uiName}`)) {
      fs.writeFileSync(
        path.join(modelDir, 'index.ts'),
        indexContent +
          `\nexport { List${uiName}, Create${uiName}, Edit${uiName}, Show${uiName}, Delete${uiName}Button, Create${uiName}Button } from "./ui";\n`,
      );
    }
  }

  fs.writeFileSync(
    path.join(outDir, 'index.ts'),
    `/** AUTO-GENERATED — do not edit. */
export * from "./types";
export * from "./hooks";
export * from "./sdk";
export * from "./resource-documents";
export * from "./resource-registry";
${config.models.map((m) => `export * from "./models/${m.name}";`).join('\n')}
`,
  );
}

function gqlResourceNameFromModel(model: string): string {
  return model
    .split('_')
    .map((part, i) => (i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('');
}

function writeResourceDocuments(config: ApitoCodegenConfig, outDir: string): void {
  const entries = config.models.map((model) => {
    const pascal = pascalCase(model.name);
    const gql = gqlResourceNameFromModel(model.name);
    const supportsConn = model.supportsConnection !== false;
    return { model, pascal, gql, supportsConn };
  });

  const documentImports = entries
    .map(
      ({ pascal }) =>
        `  Create${pascal}Document,
  Update${pascal}Document,
  Delete${pascal}Document,
  Get${pascal}ListDocument,
  Get${pascal}Document,`,
    )
    .join('\n');
  const createDocs = entries
    .map(({ model, pascal }) => `  ${model.name}: Create${pascal}Document,`)
    .join('\n');
  const updateDocs = entries
    .map(({ model, pascal }) => `  ${model.name}: Update${pascal}Document,`)
    .join('\n');
  const deleteDocs = entries
    .map(({ model, pascal }) => `  ${model.name}: Delete${pascal}Document,`)
    .join('\n');
  const listDocuments = entries
    .map(({ model, pascal }) => `  ${model.name}: Get${pascal}ListDocument,`)
    .join('\n');
  const oneDocuments = entries
    .map(({ model, pascal }) => `  ${model.name}: Get${pascal}Document,`)
    .join('\n');
  const listKeys = entries
    .map(({ model, gql }) => `  ${model.name}: "${gql}List",`)
    .join('\n');
  const countKeys = entries
    .map(({ model, gql }) => `  ${model.name}: "${gql}ListCount",`)
    .join('\n');
  const oneKeys = entries
    .map(({ model, gql }) => `  ${model.name}: "${gql}",`)
    .join('\n');
  const supportsConnection = entries
    .map(({ model, supportsConn }) => `  ${model.name}: ${supportsConn},`)
    .join('\n');
  const resourceNames = entries.map((entry) => `"${entry.model.name}"`).join(' | ');

  fs.writeFileSync(
    path.join(outDir, 'resource-documents.ts'),
    `/** AUTO-GENERATED — do not edit. */
import type {
  ApitoResourceRegistry,
  GraphQLQueryInput,
} from "@apito-io/js-admin-sdk";
import {
${documentImports}
} from "./sdk";
export {
${documentImports}
} from "./sdk";

export type ApitoResourceName = ${resourceNames};

export const APITO_CREATE_DOCUMENTS = {
${createDocs}
} as unknown as Record<string, GraphQLQueryInput>;

export const APITO_UPDATE_DOCUMENTS = {
${updateDocs}
} as unknown as Record<string, GraphQLQueryInput>;

export const APITO_DELETE_DOCUMENTS = {
${deleteDocs}
} as unknown as Record<string, GraphQLQueryInput>;

export const APITO_LIST_DOCUMENTS = {
${listDocuments}
} as unknown as Record<string, GraphQLQueryInput>;

export const APITO_ONE_DOCUMENTS = {
${oneDocuments}
} as unknown as Record<string, GraphQLQueryInput>;

const LIST_KEYS: Record<string, string> = {
${listKeys}
};

const COUNT_KEYS: Record<string, string> = {
${countKeys}
};

const ONE_KEYS: Record<string, string> = {
${oneKeys}
};

const SUPPORTS_CONNECTION: Record<string, boolean> = {
${supportsConnection}
};

export const apitoServerResourceRegistry: ApitoResourceRegistry = {
  getListDocument: (resource) => APITO_LIST_DOCUMENTS[resource],
  getOneDocument: (resource) => APITO_ONE_DOCUMENTS[resource],
  getCreateDocument: (resource) => APITO_CREATE_DOCUMENTS[resource],
  getUpdateDocument: (resource) => APITO_UPDATE_DOCUMENTS[resource],
  getDeleteDocument: (resource) => APITO_DELETE_DOCUMENTS[resource],
  getListKey: (resource) => LIST_KEYS[resource] ?? \`\${resource}List\`,
  getCountKey: (resource) => COUNT_KEYS[resource] ?? \`\${resource}ListCount\`,
  getOneKey: (resource) => ONE_KEYS[resource] ?? resource,
  supportsConnection: (resource) => SUPPORTS_CONNECTION[resource] !== false,
};
`,
  );
}

function writeResourceRegistry(config: ApitoCodegenConfig, outDir: string): void {
  const entries = config.models.map((model) => {
    const pascal = pascalCase(model.name);
    const gql = gqlResourceNameFromModel(model.name);
    const supportsConn = model.supportsConnection !== false;
    return { model, pascal, gql, supportsConn };
  });

  const hookImports = entries
    .map(
      ({ model, pascal }) =>
        `import { use${pascal}List, use${pascal}Form, useDelete${pascal} } from "./models/${model.name}";`,
    )
    .join('\n');

  const documentImports = entries
    .map(
      ({ pascal }) =>
        `  Create${pascal}Document,\n  Update${pascal}Document,\n  Delete${pascal}Document,\n  Get${pascal}ListDocument,\n  Get${pascal}Document,`,
    )
    .join('\n');

  const listHooks = entries
    .map(({ model, pascal }) => `  ${model.name}: use${pascal}List,`)
    .join('\n');

  const formHooks = entries
    .map(({ model, pascal }) => `  ${model.name}: use${pascal}Form,`)
    .join('\n');

  const deleteHooks = entries
    .map(({ model, pascal }) => `  ${model.name}: useDelete${pascal},`)
    .join('\n');

  const createDocs = entries
    .map(({ model, pascal }) => `  ${model.name}: Create${pascal}Document,`)
    .join('\n');

  const updateDocs = entries
    .map(({ model, pascal }) => `  ${model.name}: Update${pascal}Document,`)
    .join('\n');

  const deleteDocs = entries
    .map(({ model, pascal }) => `  ${model.name}: Delete${pascal}Document,`)
    .join('\n');

  const listKeys = entries
    .map(({ model, gql }) => `  ${model.name}: "${gql}List",`)
    .join('\n');

  const countKeys = entries
    .map(({ model, gql }) => `  ${model.name}: "${gql}ListCount",`)
    .join('\n');

  const oneKeys = entries
    .map(({ model, gql }) => `  ${model.name}: "${gql}",`)
    .join('\n');

  const listDocuments = entries
    .map(({ model, pascal }) => `  ${model.name}: Get${pascal}ListDocument,`)
    .join('\n');

  const oneDocuments = entries
    .map(({ model, pascal }) => `  ${model.name}: Get${pascal}Document,`)
    .join('\n');

  const supportsConnection = entries
    .map(({ model, supportsConn }) => `  ${model.name}: ${supportsConn},`)
    .join('\n');

  const resourceNames = entries.map((e) => `"${e.model.name}"`).join(' | ');

  fs.writeFileSync(
    path.join(outDir, 'resource-registry.ts'),
    `/** AUTO-GENERATED — do not edit. */
"use client";

import type {
  ApitoResourceRegistry,
  CrudFilter,
  GraphQLQueryInput,
} from "@apito-io/js-admin-sdk/react";
${hookImports}
import {
${documentImports}
} from "./resource-documents";

export type ApitoResourceName = ${resourceNames};

export const APITO_LIST_HOOKS = {
${listHooks}
} as const;

export const APITO_FORM_HOOKS = {
${formHooks}
} as const;

export const APITO_DELETE_HOOKS = {
${deleteHooks}
} as const;

export const APITO_CREATE_DOCUMENTS = {
${createDocs}
} as unknown as Record<string, GraphQLQueryInput>;

export const APITO_UPDATE_DOCUMENTS = {
${updateDocs}
} as unknown as Record<string, GraphQLQueryInput>;

export const APITO_DELETE_DOCUMENTS = {
${deleteDocs}
} as unknown as Record<string, GraphQLQueryInput>;

const LIST_KEYS: Record<string, string> = {
${listKeys}
};

const COUNT_KEYS: Record<string, string> = {
${countKeys}
};

const ONE_KEYS: Record<string, string> = {
${oneKeys}
};

const LIST_DOCUMENTS = {
${listDocuments}
} as unknown as Record<string, GraphQLQueryInput>;

const ONE_DOCUMENTS = {
${oneDocuments}
} as unknown as Record<string, GraphQLQueryInput>;

const SUPPORTS_CONNECTION: Record<string, boolean> = {
${supportsConnection}
};

export const apitoResourceRegistry: ApitoResourceRegistry = {
  getListDocument: (resource) => LIST_DOCUMENTS[resource],
  getOneDocument: (resource) => ONE_DOCUMENTS[resource],
  getCreateDocument: (resource) => APITO_CREATE_DOCUMENTS[resource],
  getUpdateDocument: (resource) => APITO_UPDATE_DOCUMENTS[resource],
  getDeleteDocument: (resource) => APITO_DELETE_DOCUMENTS[resource],
  getListKey: (resource) => LIST_KEYS[resource] ?? \`\${resource}List\`,
  getCountKey: (resource) => COUNT_KEYS[resource] ?? \`\${resource}ListCount\`,
  getOneKey: (resource) => ONE_KEYS[resource] ?? resource,
  supportsConnection: (resource) => SUPPORTS_CONNECTION[resource] !== false,
};

export function useApitoResourceList(
  resource: ApitoResourceName,
  options?: {
    enabled?: boolean;
    initialFilters?: CrudFilter[];
    initialPagination?: { current: number; pageSize: number };
    permanentFilters?: CrudFilter[];
  },
) {
  const hook = APITO_LIST_HOOKS[resource];
  return hook(options);
}

export function useApitoResourceForm(resource: ApitoResourceName, id?: string) {
  const hook = APITO_FORM_HOOKS[resource];
  return hook(id);
}

export function useApitoResourceDelete(resource: ApitoResourceName) {
  const hook = APITO_DELETE_HOOKS[resource];
  return hook();
}
`,
  );
}

/**
 * Some GraphQL Codegen plugin combinations emit String-backed documents but
 * leave their runtime helper to another preset. Keep the generated SDK
 * self-contained so server registries can import it without relying on the
 * React hooks artifact (or a bundler-provided global).
 */
function ensureTypedDocumentStringRuntime(outDir: string): void {
  const sdkPath = path.join(outDir, 'sdk.ts');
  if (!fs.existsSync(sdkPath)) return;
  const source = fs.readFileSync(sdkPath, 'utf8');
  if (!source.includes('new TypedDocumentString') || source.includes('class TypedDocumentString')) {
    return;
  }
  const helper = `/** Runtime wrapper emitted for String-backed GraphQL documents. */
class TypedDocumentString extends String {
  private readonly value: string;

  constructor(value: string) {
    super(value);
    this.value = value;
  }

  override toString(): string {
    return this.value;
  }
}

`;
  fs.writeFileSync(sdkPath, helper + source);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { outDir, skipDocumentsValidation, artifacts } = args;
  let config: ApitoCodegenConfig;
  if (args.schemaPath && !args.configPath) {
    const raw = JSON.parse(fs.readFileSync(args.schemaPath, 'utf8')) as unknown;
    const planned = buildCodegenConfigFromSchema(raw, {
      schemaPath: args.schemaPath,
      models: args.models,
      includeRelations: args.includeRelations,
      uiPackage: args.uiPackage || defaultCodegenUiPackage,
    });
    config = planned;
  } else {
    config = await loadConfig(args.configPath);
    if (args.schemaPath) config = { ...config, schema: args.schemaPath };
    if (args.uiPackage) config = { ...config, uiPackage: args.uiPackage };
    if (!args.includeRelations) {
      config = {
        ...config,
        models: config.models.map((model) => ({ ...model, connectionFields: undefined })),
      };
    }
    if (args.models.length) {
      const found = new Set(config.models.map((model) => model.name));
      const missing = args.models.filter((name) => !found.has(name));
      if (missing.length) {
        throw new Error(`published schema has no model: ${missing.join(', ')}`);
      }
      config = {
        ...config,
        models: config.models.filter((model) => args.models.includes(model.name)),
      };
    }
  }
  if (!config.models.length) {
    throw new Error('published schema did not contain any models');
  }

  const workDir = path.join(outDir, '.codegen-work');
  const opsDir = path.join(workDir, 'operations');
  const schemaDir = path.join(workDir, 'schema');

  fs.mkdirSync(outDir, { recursive: true });
  writeOperations(config, opsDir, schemaDir);

  if (skipDocumentsValidation) {
    console.warn(
      '[apito-codegen] --skip-document-validation: GraphQL documents will not be schema-checked',
    );
  }

  const codegenConfig = writeCodegenConfig(
    outDir,
    schemaDir,
    opsDir,
    skipDocumentsValidation,
    artifacts,
  );
  const sdkRoot = path.resolve(__dirname, '..');
  const codegenBin = path.join(sdkRoot, 'node_modules/@graphql-codegen/cli/cjs/bin.js');
  const sdkModules = path.join(sdkRoot, 'node_modules');
  const gen = spawnSync(
    process.execPath,
    [codegenBin, '--config', codegenConfig],
    {
      stdio: 'inherit',
      cwd: outDir,
      env: {
        ...process.env,
        NODE_PATH: process.env.NODE_PATH
          ? `${sdkModules}${path.delimiter}${process.env.NODE_PATH}`
          : sdkModules,
      },
    },
  );
  if (gen.status !== 0) process.exit(gen.status ?? 1);

  ensureTypedDocumentStringRuntime(outDir);
  writeResourceDocuments(config, outDir);

  if (artifacts !== 'sdk') {
    const hooksPath = path.join(outDir, 'hooks.ts');
    if (fs.existsSync(hooksPath)) {
      const hooksSrc = fs.readFileSync(hooksPath, 'utf8');
      const fixed = hooksSrc.replace(
        /import \{ useQuery, useMutation, UseQueryOptions, UseMutationOptions \} from '@tanstack\/react-query';/,
        "import { useQuery, useMutation } from '@tanstack/react-query';\nimport type { UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';",
      );
      if (fixed !== hooksSrc) fs.writeFileSync(hooksPath, fixed);
    }

    writeProjectHooks(config, outDir);
    writeResourceRegistry(config, outDir);
  }
  fs.rmSync(workDir, { recursive: true, force: true });
  console.log(`apito-codegen complete → ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
