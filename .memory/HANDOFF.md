# js-admin-sdk — Handoff

## Branch

- `master` — **local dirty** (`filterVariables`, `documentBuilder`, tests)

## Done

- **2026-07-19→20:** List `_key` filter support end-to-end for Select/defaultValue
  hydration (was silently putting `_key` into `where`).
- **2026-07-10:** `searchTenants()`; **1.0.4** logical OR/AND filters.

## Next

1. User confirm → commit + publish bump if external consumers need `_key` docs
2. Remind Astro apps to regenerate via `apito-codegen` / DocumentBuilder so
   static list documents include `$_key` / `$_keyCount`

## Do not touch

- Generated `dist/` (build artifact; rebuild after source edits; not the source of truth)

## Last Updated

2026-07-20
