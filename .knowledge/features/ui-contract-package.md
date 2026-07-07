---
type: feature
title: UI Contract Package
description: Shared TypeScript prop and adapter types for Apito admin UI implementations
resource: src/ui/index.ts
tags: [js-admin-sdk, ui, types, contract]
timestamp: 2026-07-07T00:00:00Z
---

# UI Contract Package

## Purpose

`@apito-io/js-admin-sdk/ui` defines the interface between headless SDK and UI kits (Ant Design, future adapters). No React components here — only types so list/form/show/import/media props stay consistent across implementations.

## Flows

- **UI kit implements**: `ApitoListProps`, `ApitoFormProps`, `ApitoShowProps`, column defs, router adapter.
- **App wires**: `ApitoRouterAdapter` + `ApitoResourceRouteMap` for CRUD routes.
- **Import/export**: re-exports headless import types as UI prop shapes.
- **Media**: `ApitoMediaUploader`, `ApitoMediaDeleter`, label interfaces for i18n.

## Main files

- `src/ui/index.ts` — public type exports
- `src/ui/types.ts` — CRUD page props, table options, link adapter
- `src/headless/importExport/types.ts` — import/export config types (re-exported)
- `src/headless/types.ts` — `CrudFilter`, `CrudSort` shared with UI

## Dependencies

- [react-headless-hooks](react-headless-hooks.md) behavior must match these prop contracts
- Primary consumer: `sdk/js-admin-ui-antd`

## Invariants

- Breaking prop changes require major version bump across `js-admin-sdk` + `js-admin-ui-antd`.
- `ApitoListPageBridge` is the extension point for custom list chrome without forking types.
- Router types stay framework-agnostic — no `react-router` imports in `ui/`.

## Common bugs

- UI kit props drift from `ui/types.ts` — run typecheck against workspace SDK.
- `ApitoColumnDef` `dataIndex` not aligned with GraphQL field paths.
- Missing `ApitoLinkComponent` provider — links render as plain `<a>`.

## Tests

- Type-level: `js-admin-ui-antd` build against workspace `ui` exports
- `src/__tests__/operation-contract.test.ts` for data shape alignment

## Related

- Consumer: `js-admin-ui-antd/.knowledge/features/crud-pages-list-form-show.md`
- [react-headless-hooks](react-headless-hooks.md), [import-export-headless](import-export-headless.md)
