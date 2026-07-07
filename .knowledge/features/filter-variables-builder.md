---
type: feature
title: Filter Variables Builder
description: Maps Refine-style CrudFilter and relation scopes to Apito GraphQL list variables
resource: src/headless/filterVariables.ts
tags: [js-admin-sdk, filters, graphql, list]
timestamp: 2026-07-07T00:00:00Z
---

# Filter Variables Builder

## Purpose

JS reference implementation for [list-filters-and-relations](../../../../.knowledge/features/list-filters-and-relations.md). Converts UI table filters, sorters, pagination, and relation/connection scopes into `where`, `sort`, `page`, `limit` GraphQL variables.

## Flows

- **Table list**: `buildListQueryVariables({ resource, filters, sorters, pagination, connection?, relationFilters? })`.
- **Relation filter**: `buildListRelationFilter` / `relationEqFilter` → nested `where` on relation fields.
- **Connection scope**: `buildListConnectionScope` for HasMany count/sort sub-inputs.
- **Logical groups**: `orCrudFilter`, `andCrudFilter` → `where.OR` / `where.AND`.
- **Type names**: `apitoWhereTypeName`, `apitoSortTypeName` from [naming-engine](../../../../.knowledge/features/naming-engine.md).

## Main files

- `src/headless/filterVariables.ts` — `buildApitoFilterVariables`, `buildListQueryVariables`
- `src/headless/listRelationFilters.ts` — relation eq filters, `transformRelationFilters`
- `src/headless/listConnectionFilters.ts` — connection count where/sort
- `src/headless/tableSort.ts` — Ant Design sorter ↔ CrudSort
- `src/naming/apitoGraphqlNames.ts` — composed input type names

## Dependencies

- [naming-engine](../../../../.knowledge/features/naming-engine.md)
- Global filter semantics: [list-filters-and-relations](../../../../.knowledge/features/list-filters-and-relations.md)

## Invariants

- Operator mapping (`eq`, `contains`, `gte`, …) must match engine filter schema — do not invent operators.
- Relation filters use connection metadata from schema reader, not guessed field paths.
- `permanentFilters` merge before UI filters; later keys do not override permanent constraints.

## Common bugs

- Relation filter on wrong connection key → empty list (not error).
- Date filters sent as bare `YYYY-MM-DD` in `where` — use same serialization as mutations.
- Sort field not resolved through `resolveSortField` → sort ignored server-side.

## Tests

- `src/__tests__/buildListQueryVariables.test.ts`
- `src/__tests__/listRelationFilters.test.ts`

## Related

- [react-headless-hooks](react-headless-hooks.md)
- Consumer: `js-admin-ui-antd` [table-sort-filter-bridge](../js-admin-ui-antd/.knowledge/features/table-sort-filter-bridge.md)
- Global: [list-filters-and-relations](../../../../.knowledge/features/list-filters-and-relations.md)
