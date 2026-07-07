---
type: feature
title: Codegen CLI
description: apito-codegen CLI and npm scripts that regenerate operations and React Query hooks
resource: bin/apito-codegen.mjs
tags: [js-admin-sdk, codegen, graphql-codegen]
timestamp: 2026-07-07T00:00:00Z
---

# Codegen CLI

## Purpose

Keeps `src/generated/` in sync with engine introspection. Produces GraphQL operation documents, TypeScript types, generic SDK methods, and TanStack React Query hooks. Never hand-edit output.

## Flows

- **Full regen**: `npm run gen` → `gen:operations` then `gen:types`.
- **Project hooks**: `npm run gen:project-hooks` — consumer-app hook stubs via `scripts/gen-project-hooks.ts`.
- **CLI**: `npx apito-codegen` (or global bin) delegates to `scripts/apito-codegen-run.ts`.
- **Consumer app**: point CLI at live introspection or checked-in `schema/apito_introspection.json`.

Pipeline details: [introspection-codegen-pipeline](../../../../.knowledge/features/introspection-codegen-pipeline.md).

## Main files

- `bin/apito-codegen.mjs` — CLI entry
- `scripts/apito-codegen-run.ts` — orchestration
- `scripts/gen-operations.ts` — 5-op documents per model
- `codegen.ts` — graphql-codegen config
- `src/generated/` — `types.ts`, `sdk.ts`, `hooks.ts`, `fetcher.ts` (generated)
- `src/naming/documentBuilder.ts` — operation doc builder

## Dependencies

- `@graphql-codegen/*` packages
- [naming-engine](../../../../.knowledge/features/naming-engine.md) vectors
- Engine introspection JSON or live endpoint

## Invariants

- Do not edit `src/generated/*`; fix generators or schema instead.
- Operation names must match naming vectors — same as Go genqlient / Flutter build_runner.
- `graphql` and `@tanstack/react-query` are peer deps for hooks export.

## Common bugs

- Forgot `npm run gen` after schema change → type errors in hooks.
- Wrong introspection file path in consumer — verify `APITO_SCHEMA_FILE` or default `schema/`.
- Partial model filter env `APITO_MODELS` omitted needed model.

## Tests

- `src/__tests__/codegenConnectionMeta.test.ts`
- `src/__tests__/naming.test.ts`
- Re-run `npm run gen` then `npm test` after schema changes

## Related

- [apito-client-core](apito-client-core.md), [react-headless-hooks](react-headless-hooks.md)
- Global: [introspection-codegen-pipeline](../../../../.knowledge/features/introspection-codegen-pipeline.md), [naming-engine](../../../../.knowledge/features/naming-engine.md)
