# JS Admin SDK — Cross-SDK Sync Summary

**Package:** `@apito-io/js-admin-sdk` (v3.7.1)  
**Aligned with:** `flutter_admin_sdk` v0.6.1, `go-admin-sdk` v2.6.1

## Shared contract

See [CONTRACT.md](CONTRACT.md).

## v3.7.1 (2026-06-22)

- **Cloudflare Workers v1** — document `generateTenantToken` / tenant catalog and Google `loginUser` limitations on Workers; password `loginUser` unchanged

## v3.7.0 (2026-06-11)

- **`tenantId` on user CRUD** — `searchUsers`, `createUser`, `updateUser` pass optional GraphQL `tenant_id` (pro SaaS)

## v3.6.1 (2026-06-15)

- **`loginUser` Google** — engine auto-links verified email to existing user; new errors documented (no SDK API change)
- **`createUser` / `updateUser`** — engine enforces project-wide email/phone uniqueness on open-core

## v3.6.0 (2026-06-08)

- **`loginUser` `tenantId`** — optional GraphQL `tenant_id`; required for SaaS per-tenant separate DB projects

## v3.5.0 (2026-06-05)

- **`loginUser` `google_id_token`** — native mobile sign-in (`idToken` on `LoginUserParams`)
- **Secured files REST** — default `restBaseURL` → `/secured`; full URLs `/secured/files/*`

## v3.4.0 (2026-06-05)

- **Naming engine** (`src/naming/apitoGraphqlNames.ts` — shared with refine-apito)
- **Operation emitter** (`npm run gen:operations`) → `codegen/operations/*.graphql` + `codegen/schema.graphql` + `codegen/introspection.normalized.json`
- **graphql-codegen** pipeline (`npm run gen:types`) → `src/generated/types.ts`, `sdk.ts`, `hooks.ts`
- **TanStack React Query v5 hooks** (`src/generated/hooks.ts`, optional peer dep)
- **`createApitoFetcher` / `getSdk`** typed client layer
- Canonical `test/fixtures/naming_vectors.json` parity test
- Introspection **input** snapshot: `schema/apito_introspection.json`

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run gen:operations` | Emit `.graphql` ops from introspection snapshot |
| `npm run gen:types` | Run graphql-codegen on `codegen/introspection.normalized.json` |
| `npm run gen` | Both |

After engine schema changes: refresh `schema/apito_introspection.json`, then `npm run gen`, commit generated output.

## Prior versions

See [CHANGELOG.md](CHANGELOG.md) for v3.3.0 (project DB files metadata), v3.0.0 (user rename), v1.2.0 (Go parity).
