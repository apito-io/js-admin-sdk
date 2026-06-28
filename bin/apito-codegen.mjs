#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const runTs = path.join(root, '../scripts/apito-codegen-run.ts');

const args = process.argv.slice(2);
const result = spawnSync('npx', ['tsx', runTs, ...args], {
  stdio: 'inherit',
  cwd: process.cwd(),
  env: process.env,
});

process.exit(result.status ?? 1);
