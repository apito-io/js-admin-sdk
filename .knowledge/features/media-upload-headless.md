---
type: feature
title: Media Upload Headless
description: Secured file upload helpers, accept rules, and React media context providers
resource: src/headless/mediaUpload/
tags: [js-admin-sdk, media, upload, rest]
timestamp: 2026-07-07T00:00:00Z
---

# Media Upload Headless

## Purpose

Headless layer for project secured files: upload via REST, MIME accept rules, gallery helpers, and React context for injection into UI kits. REST contract: [secured-files-rest](../../../../.knowledge/features/secured-files-rest.md).

## Flows

- **Single image**: `useApitoImageUpload` (via `ApitoMediaProvider`) → client `uploadFile`.
- **Gallery**: multi-file upload with ordering metadata.
- **Accept rules**: `resolveMediaAccept` / `mediaAcceptForField` from schema field type.
- **Picker**: list files via `listFiles`, resolve display URL for existing media ids.
- **Export**: `formatMediaUrlForExport` for CSV absolute URLs.

## Main files

- `src/headless/mediaUpload/index.ts` — upload helpers
- `src/headless/mediaUpload/mediaAccept.ts` — MIME / extension accept
- `src/headless/mediaUpload/helpers.ts` — gallery + file metadata
- `src/headless/mediaContext.tsx` — `ApitoMediaProvider`, upload hooks
- `src/filesPaths.ts` — REST paths shared with client

## Dependencies

- [apito-client-core](apito-client-core.md) `uploadFile` / `listFiles` / `deleteFiles`
- [secured-files-rest](../../../../.knowledge/features/secured-files-rest.md)

## Invariants

- Upload targets `/secured` REST base, not GraphQL.
- `ApitoMediaProvider` must wrap any component using `useApitoMediaUpload`.
- Accept strings follow HTML input accept format; validate before upload.

## Common bugs

- Wrong `restBaseURL` — uploads 404 when GraphQL is `/system/graphql`.
- Missing bearer on upload — use same auth as GraphQL fetcher.
- Gallery field stores ids but UI shows broken URL — wire `ApitoMediaFileResolver`.

## Tests

- `src/__tests__/mediaAccept.test.ts`
- `src/__tests__/formatMediaUrlForExport.test.ts`

## Related

- Consumer: `js-admin-ui-antd` [media-upload-ui](../js-admin-ui-antd/.knowledge/features/media-upload-ui.md)
- Global: [secured-files-rest](../../../../.knowledge/features/secured-files-rest.md)
