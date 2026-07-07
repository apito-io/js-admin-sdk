---
type: feature
title: Form Values Mutation Payload
description: Serializes Ant Design / dayjs form state into Apito create/update mutation payloads
resource: src/headless/formValues.ts
tags: [js-admin-sdk, forms, mutations, relations]
timestamp: 2026-07-07T00:00:00Z
---

# Form Values Mutation Payload

## Purpose

Bridges UI form state (Ant Design, dayjs, compat records) to GraphQL mutation variables. Handles dates, empty fields, and HasOne/HasMany connect maps per [mutation-connect-relations](../../../../.knowledge/features/mutation-connect-relations.md).

## Flows

- **Load record → form**: `apitoRecordToFormValues` / `apitoRecordToAntdFormValues` / `apitoRecordToCompatRecord`.
- **Save**: `normalizeApitoFormSaveInput` → `prepareApitoMutationPayload` → `serializeApitoPayloadValues`.
- **Relations**: `buildConnectFromApitoRecord`, `stripEmptyRelationFields` + `buildMutationConnectHasOne/HasMany`.
- **Dates**: `serializeApitoDateValue` — RFC3339, not bare date strings.

## Main files

- `src/headless/formValues.ts` — serialize + payload builders
- `src/headless/mutationConnect.ts` — connect map normalization
- `src/headless/recordCompat.ts` — Refine-style record shape
- `src/naming/apitoGraphqlNames.ts` — `*_Connect_*` field keys

## Dependencies

- [mutation-connect-relations](../../../../.knowledge/features/mutation-connect-relations.md)
- [naming-engine](../../../../.knowledge/features/naming-engine.md) for connect field names

## Invariants

- Date fields must serialize to ISO-8601 with timezone for engine validation.
- Empty relation fields stripped before mutation — do not send `null` connect objects.
- `prepareApitoMutationPayload` is the single save path for UI kits; do not fork per app.

## Common bugs

- dayjs without `toISOString` → date-only string rejected by API.
- HasMany connect sent as single id instead of ids array.
- Edit form sends read-only relation display objects — strip via `stripEmptyRelationFields`.

## Tests

- `src/__tests__/formValues.test.ts`
- `src/__tests__/mutationConnect.test.ts`
- `src/__tests__/recordCompat.test.ts`

## Related

- [react-headless-hooks](react-headless-hooks.md)
- Global: [mutation-connect-relations](../../../../.knowledge/features/mutation-connect-relations.md)
