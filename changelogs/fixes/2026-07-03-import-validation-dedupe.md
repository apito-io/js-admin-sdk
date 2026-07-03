# Fix: Duplicate import validation errors

**Date:** 2026-07-03
**Status:** shipped
**Cause:** Import modal showed duplicate errors per row

## Problem

CSV import displayed the same validation message twice (required + schema) for a single cell.

## Root cause

`validateImportRows` appended both rule failures without deduping by row index, field, and message key.

## Solution

Deduplicate error list before returning from validation pipeline.

## Files changed

| Path | Change |
|------|--------|
| `src/headless/importExport/validation.ts` | Dedupe errors |

## Impact

**Semver:** patch. **Apps:** any consumer of `ApitoImportModal` + SDK validation.

## Verification

Import invalid rows — one error per issue in summary UI.
