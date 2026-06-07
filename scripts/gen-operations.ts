#!/usr/bin/env npx tsx
/**
 * Emit schema.graphql + operations/{model}.graphql from introspection snapshot.
 * Aligned with flutter_admin_sdk OperationGenerator.
 */
import * as fs from 'fs';
import * as path from 'path';
import { DocumentBuilder } from '../src/naming/documentBuilder';
import { introspectionToSdl, parseIntrospection } from '../src/naming/schemaReader';
import { normalizeIntrospection } from './normalize-introspection';

const root = path.resolve(__dirname, '..');
const schemaPath =
  process.env.APITO_SCHEMA_FILE ?? path.join(root, 'schema/apito_introspection.json');
const outDir = path.join(root, 'codegen');
const opsDir = path.join(outDir, 'operations');
const modelFilter = process.env.APITO_MODELS?.split(',').map((s) => s.trim()).filter(Boolean);

function main() {
  const raw = JSON.parse(fs.readFileSync(schemaPath, 'utf8')) as Record<string, unknown>;
  const schema = parseIntrospection(raw, modelFilter);
  fs.mkdirSync(opsDir, { recursive: true });
  for (const f of fs.readdirSync(opsDir)) {
    if (f.endsWith('.graphql')) fs.unlinkSync(path.join(opsDir, f));
  }

  fs.writeFileSync(path.join(outDir, 'schema.graphql'), introspectionToSdl(raw));
  fs.writeFileSync(
    path.join(outDir, 'introspection.normalized.json'),
    JSON.stringify(normalizeIntrospection(raw), null, 2)
  );

  for (const model of schema.models) {
    const fields = model.fields.map((f) => f.name);
    const doc = new DocumentBuilder(model.name).generateGraphqlFile(fields);
    fs.writeFileSync(path.join(opsDir, `${model.name}.graphql`), doc);
    console.log(`wrote operations/${model.name}.graphql`);
  }
  console.log(`wrote schema.graphql (${schema.models.length} models)`);
}

main();
