# js-admin-sdk — AI Changelog

Not git history — the *reasoning* behind changes. Newest on top.
Format per entry: date, **Changed**, **Why**, **Affected**.

---
## 2026-07-07
- **Changed:** SDK **1.0.4** — logical OR/AND list filters (`orCrudFilter`, `andCrudFilter`); `buildWhereFromFilters` emits `where.OR`/`where.AND`; `serializeApitoDateValue` keeps explicit offsets.
- **Why:** Rosna food-catalog search OR filters were silently dropped; food-order date `between` mismatched UTC saves vs `+06:00` list bounds.
- **Affected:** `filterVariables.ts`, `formValues.ts`, `types.ts`, `react/index.ts`; rosna food order + catalog.

## 2026-07-06
- **Changed:** Bootstrapped knowledge system for this repo.
- **Why:** Cross-LLM durable knowledge + working memory.
- **Affected:** this repo only.

Last Updated: 2026-07-06
