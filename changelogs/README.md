# js-admin-sdk changelogs

Daily changelog for `@apito-io/js-admin-sdk` — headless + React layers for Apito admin apps.

## Layout

- `YYYY-MM-DD.md` per day
- [`fixes/`](fixes/) for detailed write-ups
- Bump `package.json` version when shipping API changes

## Sections

| Section | Use for |
|---------|---------|
| **API / Exports** | New modules, hooks, types in `src/` exports |
| **Breaking Changes** | Semver-major; migration for apps |
| **Bug Fixes** | Correctness without API shape change |
| **Session capture** | Auto-logged — consolidate with **cause** |

## Hooks

[`.cursor/hooks.json`](../.cursor/hooks.json) — `afterFileEdit` on `src/**`, `stop` consolidates once per session.

## Template

```markdown
- **14:30** — **API / Exports**: `deriveExportConnectionFieldsFromColumns` for import/export. **Cause**: student export missing relation columns. **Semver**: patch. **Apps**: Protiva student export.
```

## Downstream

Log matching app changes in **rosna-astro** / **protiva-astro** changelogs when bumping this package.
