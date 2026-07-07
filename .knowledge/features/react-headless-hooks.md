---
type: feature
title: React Headless Hooks
description: TanStack Query hooks, ApitoProvider, and resource client for React admin apps
resource: src/react/index.ts
tags: [js-admin-sdk, react, tanstack-query, headless]
timestamp: 2026-07-07T00:00:00Z
---

# React Headless Hooks

## Purpose

`@apito-io/js-admin-sdk/react` exposes framework-agnostic data layer: providers, generated hooks, resource registry, and invalidation helpers. UI kits (`js-admin-ui-antd`) consume these without duplicating GraphQL wiring.

## Flows

- **Setup**: wrap app in `ApitoProvider` + `ApitoHooksProvider` with `createBearerApitoFetcher`.
- **List page**: `useApitoListQuery` / registry `listHooks[resource]` + `buildListQueryVariables`.
- **Form**: `useApitoOneQuery`, `useApitoCreateMutation`, `useApitoUpdateMutation` + `prepareApitoMutationPayload`.
- **Delete**: `useApitoDeleteMutation` + `invalidateApitoListQueries`.
- **Menu**: `buildApitoMenuTree` from schema models.

## Main files

- `src/react/index.ts` — public re-exports
- `src/headless/context.tsx` — `ApitoProvider`, `ApitoHooksProvider`
- `src/headless/hooks.ts` — hook factories over generated documents
- `src/headless/resourceClient.ts` — `createApitoResourceClient`
- `src/headless/queryInvalidation.ts` — list/one cache keys
- `src/headless/graphqlFetcher.ts` — `apitoGraphQLRequest`
- `src/generated/hooks.ts` — generated React Query hooks

## Dependencies

- `@tanstack/react-query` ^5 (peer)
- [codegen-cli](codegen-cli.md) output
- [filter-variables-builder](filter-variables-builder.md) for list variables

## Invariants

- Hooks require `ApitoHooksProvider` ancestor or explicit `queryClient` + fetcher.
- Resource names match GraphQL model keys from registry, not arbitrary strings.
- Use headless hooks in UI kits; do not call `ApitoClient` directly from Ant Design components.

## Common bugs

- Missing provider → "No QueryClient" runtime error.
- Stale list after mutation — forgot `invalidateApitoListQueries`.
- `enabled: false` on list hook while filters still defaulting — empty table flash.

## Tests

- `src/__tests__/resourceClient.test.ts`
- `src/__tests__/buildListQueryVariables.test.ts`
- Integration via `js-admin-ui-antd` consumer apps

## Related

- [apito-client-core](apito-client-core.md), [ui-contract-package](ui-contract-package.md)
- Consumer: `sdk/js-admin-ui-antd/.knowledge/features/crud-compat-bridge.md`
