---
type: feature
title: Apito Client Core
description: Core ApitoClient with GraphQL CRUD, REST admin, and injected DB interface
resource: src/client.ts
tags: [js-admin-sdk, graphql, client, rest]
timestamp: 2026-07-07T00:00:00Z
---

# Apito Client Core

## Purpose

`ApitoClient` is the language reference for the shared [admin SDK contract](../../../../.knowledge/features/admin-sdk-contract.md): five model ops, auth/tenant REST, and secured file paths. Apps construct one client (or fetcher) and call typed or dynamic GraphQL.

## Flows

- **Bootstrap**: `createClient({ baseURL, apiKey | bearerToken, tenantId? })` — REST base derived from GraphQL URL when omitted.
- **List/get/create/update/delete**: `search*`, `get*`, `create*`, `update*`, `delete*` via `TypedOperations` or raw documents.
- **Auth/tenant**: `loginUser`, `getTenants`, user CRUD — see [auth-tenant-admin](../../../../.knowledge/features/auth-tenant-admin.md).
- **Files**: `uploadFile`, `listFiles`, `deleteFiles` — see [secured-files-rest](../../../../.knowledge/features/secured-files-rest.md).

## Main files

- `src/client.ts` — `ApitoClient`, `createClient`, REST base derivation
- `src/typed-operations.ts` — typed op wrappers over client
- `src/types.ts` — `ClientConfig`, `InjectedDBOperationInterface`, response types
- `src/filesPaths.ts` — `FILES_UPLOAD_PATH`, `FILES_LIST_PATH`, `FILES_DELETE_PATH`
- `src/headless/fetcher.ts` — `createBearerApitoFetcher` for React Query

## Dependencies

- Engine public GraphQL + `/secured` REST
- [naming-engine](../../../../.knowledge/features/naming-engine.md) for operation names
- axios for HTTP

## Invariants

- Require `apiKey` or `bearerToken`; never send both-empty config.
- `/system/graphql` → REST base strips `/system`, appends `/secured` for project files.
- `cli-*` / `sdk-*` keys use `X-APITO-KEY`; bearer uses `Authorization`.
- Client implements `InjectedDBOperationInterface` for engine injection parity with Go.

## Common bugs

- Wrong GraphQL host (system vs public) → 403 or empty schema.
- Missing `tenantId` on SaaS list/search — pass in config or per-request context.
- Stale bearer after login — call `setBearerToken` or recreate client.

## Tests

- `src/__tests__/client.test.ts`
- `src/__tests__/resourceClient.test.ts`
- `src/__tests__/operation-contract.test.ts`

## Related

- `DECISIONS.md`, [codegen-cli](codegen-cli.md), [react-headless-hooks](react-headless-hooks.md)
- Global: [admin-sdk-contract](../../../../.knowledge/features/admin-sdk-contract.md)
