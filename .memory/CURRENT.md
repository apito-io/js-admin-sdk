# js-admin-sdk — Current

## Working on

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

2026-07-20
