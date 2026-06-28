#!/usr/bin/env npx tsx
/**
 * apito-codegen — introspection → operations → types/sdk/hooks → models/{model} facades.
 *
 * Usage:
 *   apito-codegen --config apito.config.ts --out src/lib/apito-generated
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { DocumentBuilder } from '../src/naming/documentBuilder';
import { introspectionToSdl, parseIntrospection } from '../src/naming/schemaReader';
import { normalizeIntrospection } from './normalize-introspection';

export type ApitoModelConfig = {
  name: string;
  fields: string[];
  supportsConnection?: boolean;
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

function parseArgs(argv: string[]) {
  const configIdx = argv.indexOf('--config');
  const outIdx = argv.indexOf('--out');
  if (configIdx === -1 || outIdx === -1) {
    throw new Error('Usage: apito-codegen --config <apito.config.ts> --out <dir>');
  }
  return {
    configPath: path.resolve(process.cwd(), argv[configIdx + 1]),
    outDir: path.resolve(process.cwd(), argv[outIdx + 1]),
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
    const doc = db.generateGraphqlFile(selection.length ? selection : ['id']);
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
): string {
  const cfgPath = path.join(outDir, '.codegen.apito.ts');
  const relSchema = path.relative(outDir, path.join(schemaDir, 'introspection.normalized.json'));
  const relOps = path.relative(outDir, path.join(opsDir, '**/*.graphql'));

  const body = `import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: '${relSchema.replace(/\\/g, '/')}',
  documents: '${relOps.replace(/\\/g, '/')}',
  ignoreNoDocuments: true,
  config: {
    skipDocumentsValidation: true,
  },
  generates: {
    'types.ts': {
      plugins: ['typescript', 'typescript-operations'],
      config: { skipTypename: true, avoidOptionals: true },
    },
    'sdk.ts': {
      plugins: ['typescript', 'typescript-operations', 'typescript-generic-sdk'],
      config: { documentMode: 'string', skipTypename: true, avoidOptionals: true },
    },
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
    },
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

    fs.writeFileSync(
      path.join(modelDir, 'meta.ts'),
      `/** AUTO-GENERATED — do not edit. */
import type { Get${pascal}ListQuery, Get${pascal}Query } from "../../types";

export type ${pascal}Meta = NonNullable<Get${pascal}ListQuery["${gql}List"][number]["meta"]>;
export type ${pascal}Data = NonNullable<Get${pascal}ListQuery["${gql}List"][number]["data"]>;
export type ${pascal} = {
  id: string;
  data: ${pascal}Data;
  meta: ${pascal}Meta;
};

export const ${fieldsConst} = [
${model.fields.map((f) => `  "${f}",`).join('\n')}
] as const;
`,
    );

    fs.writeFileSync(
      path.join(modelDir, 'index.ts'),
      `/** AUTO-GENERATED — do not edit. */
"use client";

import { useListPage, useFormPage, useShowPage, useDeleteRecord } from "@apito-io/js-admin-sdk/react";
import type { CrudFilter } from "@apito-io/js-admin-sdk/react";
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
  initialPagination?: { current: number; pageSize: number };
}) {
  return useListPage<${pascal}>({
    resource: RESOURCE,
    listKey: LIST_KEY,
    countKey: COUNT_KEY,
    supportsConnection: ${supportsConn},
    enabled: options?.enabled,
    initialFilters: options?.initialFilters,
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
    oneKey: ONE_KEY,
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
${config.models.map((m) => `export * from "./models/${m.name}";`).join('\n')}
`,
  );
}

async function main() {
  const { configPath, outDir } = parseArgs(process.argv.slice(2));
  const config = await loadConfig(configPath);

  const workDir = path.join(outDir, '.codegen-work');
  const opsDir = path.join(workDir, 'operations');
  const schemaDir = path.join(workDir, 'schema');

  fs.mkdirSync(outDir, { recursive: true });
  writeOperations(config, opsDir, schemaDir);

  const codegenConfig = writeCodegenConfig(outDir, schemaDir, opsDir);
  const gen = spawnSync(
    'npx',
    ['graphql-codegen', '--config', codegenConfig],
    { stdio: 'inherit', cwd: outDir },
  );
  if (gen.status !== 0) process.exit(gen.status ?? 1);

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
  console.log(`apito-codegen complete → ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
