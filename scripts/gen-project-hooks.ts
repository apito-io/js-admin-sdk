#!/usr/bin/env npx tsx
/** Standalone gen-project-hooks for SDK dev / tests. */
import fs from 'node:fs';
import path from 'node:path';

const outDir = process.env.APITO_OUT_DIR ?? path.resolve(process.cwd(), 'src/lib/apito-generated');
const configPath = process.env.APITO_CONFIG ?? path.resolve(process.cwd(), 'apito.config.ts');

async function main() {
  const { pathToFileURL } = await import('node:url');
  const mod = await import(pathToFileURL(path.resolve(configPath)).href);
  const config = mod.default ?? mod.config;
  const { writeProjectHooks } = await import('./apito-codegen-run');
  // writeProjectHooks is not exported — re-run full codegen instead
  const { spawnSync } = await import('node:child_process');
  spawnSync('npx', ['tsx', path.join(__dirname, 'apito-codegen-run.ts'), '--config', configPath, '--out', outDir], {
    stdio: 'inherit',
    cwd: process.cwd(),
  });
}

main();
