# js-admin-sdk — Current

## Working on

- **2026-07-21 access-token project scope (uncommitted):**
  `ClientConfig` / `executeGraphQL` project overrides, explicit project-method
  headers, and scoped headless fetcher all use `X-Apito-Project-Id`.
- **2026-07-19→20 `_key` list hydration (uncommitted):**
  - `buildApitoFilterVariables` extracts `{ field: "_key" }` → `vars._key`
    (and `buildListQueryVariables` sets `_keyCount`).
  - `DocumentBuilder` list/count queries declare `$_key` / `$_keyCount`.
  - Tests in `buildListQueryVariables.test.ts` + `operation-contract.test.ts`.
  - Built `dist/`; suchok-astro consumes via pnpm link.

## Next

- Ask before commit/version bump; consumers must regenerate list docs (or patch
  like suchok) so `Get*ListDocument` includes `_key`.
- Go/Flutter parity for `searchTenants` (JS shipped 2026-07-10) still optional.

## Last Updated

2026-07-21
