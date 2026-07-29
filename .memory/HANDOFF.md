# js-admin-sdk — Handoff

## Branch

- `master` — **local dirty** (fetcher GraphQLError, useListPage permanentKey,
  filterVariables/`_key`, project headers). Ask before commit/publish.

## Done

- **2026-07-28/29:** Throw on GraphQL `errors` + all-null data roots
  (`hasUsableGraphQLData`); `useListPage` permanent-filter content-key sync
  (fixes Suchok TagSelect max update-depth). CHANGELOG Unreleased; dist
  rebuilt. Verified via suchok Rapid Import Parle search.
- **2026-07-21:** Canonical `X-Apito-Project-Id` across client/fetcher.
- **2026-07-19→20:** List `_key` filter support for Select defaultValue.
- **2026-07-10:** `searchTenants()`; **1.0.4** logical OR/AND filters.

## Next

1. User confirm → commit + publish bump if external consumers need fixes
2. suchok-astro (and others) must pick up rebuilt dist / published version

## Do not touch

- Don’t revert “keep data when errors + usable data” for nested resolver
  failures — only all-null top-level roots should throw
- Generated `dist/` is rebuild artifact; source of truth is `src/`

## Last Updated

2026-07-29
