---
type: feature
title: Import Export Headless
description: Headless CSV/JSON import validation and paginated export for admin bulk data
resource: src/headless/importExport/
tags: [js-admin-sdk, import, export, csv]
timestamp: 2026-07-07T00:00:00Z
---

# Import Export Headless

## Purpose

Framework-agnostic import/export pipeline: parse files, validate rows against schema columns, map to mutation inputs, and export all list pages to CSV. UI layer (`js-admin-ui-antd`) adds Ant Design modals/buttons only.

## Flows

- **Import**: parse file → `autoMapColumns` → `validateImportRows` → `mapParsedRows` → batch create mutations.
- **Export**: `fetchAllListPages` with list variables → `buildExportRows` → `rowsToCsvContent` → `downloadTextFile`.
- **Relations**: `ApitoImportRelationColumn` resolves connect fields during row mapping.
- **Media URLs**: `formatMediaUrlForExport` for absolute export links.

## Main files

- `src/headless/importExport/index.ts` — public exports
- `src/headless/importExport/validation.ts` — schema + row validation
- `src/headless/importExport/exporter.ts` — pagination + CSV builder
- `src/headless/importExport/types.ts` — column/schema types
- `src/headless/mediaUpload/formatMediaUrlForExport.ts` — export URL helper

## Dependencies

- [filter-variables-builder](filter-variables-builder.md) for export list queries
- [form-values-mutation-payload](form-values-mutation-payload.md) for row → mutation shape
- Generated create mutations per model

## Invariants

- Vertical CSV: `column.required` applies on group header rows only. Continuation identity cells are blank + disabled (`verticalGroups`).
- Import never skips validation — invalid rows surface in `ApitoImportRowError[]`.
- Export uses same list filters as UI table (permanent + current filters).
- Relation columns require explicit mapping; auto-map only matches exact header names.

## Common bugs

- Large export without pagination loop — always use `fetchAllListPages`.
- CSV date columns not serialized — pass through `serializeApitoFormFieldValue`.
- Import relation column mapped to display field instead of connect id field.

## Tests

- `src/__tests__/formatMediaUrlForExport.test.ts`
- `src/__tests__/validateImportRows-vertical.test.ts`
- Manual: `js-admin-ui-antd` import modal with sample CSV

## Related

- Consumer: `js-admin-ui-antd` [import-export-ui](../js-admin-ui-antd/.knowledge/features/import-export-ui.md)
- [react-headless-hooks](react-headless-hooks.md)
