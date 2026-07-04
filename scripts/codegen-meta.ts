import type { ApitoModelConfig } from './apito-codegen-run';

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

function camelCase(model: string): string {
  return model.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

export function buildConnectionMetaTypes(model: ApitoModelConfig): {
  relationTypeLines: string;
  relationFieldLines: string;
  metaExports: string;
} {
  const connectionFields = model.connectionFields;
  if (!connectionFields || !Object.keys(connectionFields).length) {
    return { relationTypeLines: '', relationFieldLines: '', metaExports: '' };
  }

  const gql = gqlResourceName(model.name);
  const pascal = pascalCase(model.name);
  const camel = camelCase(model.name);

  const relationTypeLines = Object.keys(connectionFields)
    .map(
      (key) =>
        `export type ${pascalCase(key)}Relation = NonNullable<NonNullable<Get${pascal}Query["${gql}"]>["${key}"]>;`,
    )
    .join('\n');

  const relationFieldLines = Object.keys(connectionFields)
    .map((key) => `  ${key}?: ${pascalCase(key)}Relation | ${pascalCase(key)}Relation[];`)
    .join('\n');

  const metaExports = `
export const ${camel}ConnectionFields = ${JSON.stringify(connectionFields, null, 2)} as const;
export const ${camel}ListMeta = {
  fields: ${camel}Fields,
  connectionFields: ${camel}ConnectionFields,
} as const;
`;

  return { relationTypeLines, relationFieldLines, metaExports };
}
