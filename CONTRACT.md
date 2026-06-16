# Apito Admin SDK — Shared Contract

All three admin SDKs (`flutter_admin_sdk`, `js-admin-sdk`, `go-admin-sdk`) share:

## 1. Naming engine

Golden vectors: `test/fixtures/naming_vectors.json` (canonical; copy verbatim to JS/Go).

Reference implementations:

- Dart: `lib/src/runtime/naming.dart`
- TypeScript: `refine-apito/src/apitoGraphqlNames.ts` (vendored in JS as `src/naming/apitoGraphqlNames.ts`)
- Go: `naming.go`

## 2. Introspection snapshot

Offline codegen input (JS):

1. **Source snapshot:** `schema/apito_introspection.json` (engine introspection JSON; refresh against a running engine with `X-Apito-Key` + optional `X-Apito-Tenant-ID`).
2. **Generated artifacts** (`npm run gen:operations`):
   - `codegen/schema.graphql` — SDL for reference
   - `codegen/introspection.normalized.json` — input to graphql-codegen
   - `codegen/operations/{model}.graphql` — 5 ops per model

Live fetch fallback: POST introspection query with `X-Apito-Key` + optional `X-Apito-Tenant-ID`, then save to `schema/apito_introspection.json`.

Flutter/Go snapshots: see their repo `schema/apito_introspection.json` paths.

## 3. Operation doc format (5 ops per model)

Each model emits:

1. `Get{Model}List` — list + count
2. `Get{Model}` — single by `_id`
3. `Create{Model}` — create mutation
4. `Update{Model}` — update mutation
5. `Delete{Model}` — delete mutation

Uses Apito composed type names (`{Model}List_Input_Where_Payload`, `{Model}_Create_Payload`, etc.).

Reference output: `codegen/operations/loan.graphql` (JS); Flutter: `example/lib/generated/operations/loan.graphql`.

## 4. Admin client surface

All SDKs expose:

- **GraphQL CRUD** (system GraphQL via `ApitoClient`; optional generated `getSdk` + TanStack hooks in JS)
- **REST storage**: `uploadFile`, `listFiles`, `deleteFiles` at `/secured/files/upload|list|delete` (paths relative to `restBaseURL`, default `/secured`)
- **Auth/admin**: `generateTenantToken`, `getTenants`, `createTenant`, `updateTenant`, `deleteTenant`, `loginUser` (password, Google OAuth code, **`google_id_token`**), `googleOAuthState`, `searchUsers`, `searchTenantsByDomain`, `createUser`, `updateUser`, `resetUserPassword`, `deleteUser`

Pro SaaS user ops accept optional **`tenantId`** / GraphQL `tenant_id` on `searchUsers`, `createUser`, and `updateUser` (in addition to `loginUser`). Omit on general projects.

## 5. Codegen outputs (JS)

| Step | Command | Output |
|------|---------|--------|
| Emit operations | `npm run gen:operations` | `codegen/operations/*.graphql`, `codegen/schema.graphql`, `codegen/introspection.normalized.json` |
| Types + SDK + hooks | `npm run gen:types` | `src/generated/types.ts`, `sdk.ts`, `hooks.ts` |
| Both | `npm run gen` | Full regen |

| SDK | Tool | Hooks |
|-----|------|-------|
| JS | graphql-codegen | TanStack React Query v5 (optional peer) |
| Go | genqlient | Context-aware client wrappers |
| Flutter | build_runner (custom) | Riverpod providers |
