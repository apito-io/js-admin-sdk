# js-admin-sdk — AI Changelog

Not git history — the *reasoning* behind changes. Newest on top.
Format per entry: date, **Changed**, **Why**, **Affected**.

---
## 2026-09-02 — updateTenantSubscription partner + period end

- **Changed:** `UpdateTenantSubscriptionParams.partnerId` /
  `currentPeriodEnd` on the GraphQL mutation. Empty period end clears.
- **Why:** Console Subscribers Edit and dealers need ledger partner
  reassignment without create+invoice.
- **Affected:** `src/client.ts`, `src/types.ts`, `src/__tests__/client.test.ts`,
  package CHANGELOG **3.14.1**. Tagged **v3.14.1**.

## 2026-09-01 — v3.13.0 ApitoProjectPayment GraphQL

- **Changed:** GraphQL `createTenantSubscription`, `updateTenantSubscription`,
  `createTenantInvoice`, `listTenantSubscribers`, `listTenantInvoices`,
  `getProjectPaymentProviders`; GraphQL cancel when only `subscriptionId`.
- **Why:** udbahabon-admin (and Console) cash/manual billing. REST cancel is
  Play/Paddle; dealers need the ledger mutations the engine already has.
- **Affected:** `src/client.ts`, `src/types.ts`, tests, CONTRACT/CHANGELOG.
  Ask before commit.

## 2026-08-12 — v3.12.1 ApitoProjectPayment REST

- **Changed:** `verifyProjectPayment` / `getTenantSubscription` /
  `cancelTenantSubscription`; `deriveSystemAPIBaseURL`; types; CONTRACT;
  package **3.12.1**.
- **Why:** Parity with Flutter/Go for engine-owned Play cancel/verify.
- **Affected:** `src/client.ts`, `src/types.ts`, tests, CONTRACT/CHANGELOG.
  Ask before commit.

## 2026-08-09 — Tenant plan_tier + myTenant

- **Changed:** `plan_tier` / `planTier` on tenant catalog GraphQL;
  `myTenant()` for app-user token.
- **Why:** Protiva plan gating; clients read control-plane tier without
  embedding system keys.
- **Affected:** client/types tenant APIs. Ask before bump/commit.

## 2026-08-06 — v3.11.10 oauthState + multi-provider loginUser

- **Changed:** `oauthState(projectId, provider)`; loginUser accepts
  facebook/github/x/linkedin code+state.
- **Why:** Match engine multi-provider app-user OAuth.
- **Affected:** `src/client.ts`, `src/types.ts`, package **3.11.10**.

## 2026-08-05 — v3.11.9 nested snake relation keys + GraphQLError on failed mutations

- **Changed:** Nested connection/relation filter keys use canonical snake
  (`food_category`, `food_category_list`); `apitoRelationFilterGraphQLKey`;
  `hasUsableGraphQLData` + throw `GraphQLError` when mutation data null;
  menuTree helpers; codegen connection meta tests.
- **Why:** Match open-core nested GraphQL snake; failed creates must not look
  like success; Studio/apps on link need built dist.
- **Affected:** naming, listRelationFilters, fetcher, hooks, menuTree, tests.
  Prior **v3.11.8** SORT_ENUM ASC/DESC. Tag **v3.11.9**.

---
## 2026-08-05 — v3.11.8 SORT_ENUM ASC/DESC

- **Changed:** `buildSortFromSorters` emits uppercase ASC/DESC.
- **Why:** Engine SORT_ENUM rejected lowercase asc/desc.
- **Affected:** filterVariables.ts. Tag **v3.11.8**.

---

## 2026-07-28/29 — GraphQLError on null roots + useListPage filter key

- **Changed:** `hasUsableGraphQLData` — throw when GraphQL `errors` exist
  and every top-level data field is null (e.g. `{ createImport: null }`).
  Same check in bearer fetcher + `apitoGraphQLRequest`. `useListPage`
  permanent-filter `useEffect` depends on content JSON key +
  `hasPermanentFilters`, not array identity. Tests + dist rebuild.
- **Why:** HTTP 200 with mutation-null + errors looked like success in
  Suchok import; permanentFilters new array each Select option refresh
  re-fired setState → max update depth on TagSelect search.
- **Affected:** `src/headless/fetcher.ts`, `graphqlFetcher.ts`,
  `hooks.ts`, `__tests__/fetcher.test.ts`, package CHANGELOG Unreleased.
  Ask before commit/publish bump.

---

## 2026-07-28 — nested GraphQL snake (no mapping)

- **Changed:** Adopt snake nested relation keys; drop camel↔snake alias/connect maps; Refine resources use stored model ids where applicable.
- **Why:** Engine nested GraphQL is snake; only roots stay camel.
- **Affected:** connectionFields, connect forms, resource config, SDK naming helpers.

---

## 2026-07-27 — v3.11.6 naming + partial GraphQL data

- **Changed:** canonicalizeModelName canonical-id early return; fetcher keeps data when errors present.
- **Why:** open-core 1.8.5 parity; edit forms hydrate despite nested resolver errors.
- **Affected:** `src/naming/apitoGraphqlNames.ts`, `src/headless/fetcher.ts`. Tag/version **3.11.6**.

---

## 2026-07-21
- **Changed:** Added canonical `X-Apito-Project-Id` support to client config,
  GraphQL request options, project-aware methods, and bearer fetcher scopes.
- **Why:** `apt_` grants require the selected project in the request header, not
  only in GraphQL variables.
- **Affected:** client/types/headless fetcher, focused tests, README/changelog.

## 2026-07-19→20
- **Changed:** Extract Refine `_key` filters to GraphQL list/count root args
  (`_key` / `_keyCount`); DocumentBuilder emits `$_key` / `$_keyCount` on
  Get*List queries; unit tests for both.
- **Why:** `useSelect` defaultValue hydration (Suchok TagSelect) put `_key` in
  `where` and generated docs omitted the real argument → Ant Select showed ULIDs.
- **Affected:** `src/headless/filterVariables.ts`, `src/naming/documentBuilder.ts`,
  `__tests__/buildListQueryVariables.test.ts`, `operation-contract.test.ts`;
  consumers must regenerate list docs. Uncommitted — ask before publish.

## 2026-07-10
- **Changed:** `searchTenants({ projectId, limit?, offset?, q? })` on admin client; types + CONTRACT + README; test stub in `client.test.ts`.
- **Why:** Parity with engine system GraphQL for SaaS tenant catalog console; enables consumer migration off raw queries.
- **Affected:** `src/client.ts`, `src/types.ts`, `CONTRACT.md`, `CHANGELOG.md`, `README.md`; apito-console-v4 TenantsTab.

## 2026-07-07
- **Changed:** SDK **1.0.4** — logical OR/AND list filters (`orCrudFilter`, `andCrudFilter`); `buildWhereFromFilters` emits `where.OR`/`where.AND`; `serializeApitoDateValue` keeps explicit offsets.
- **Why:** Rosna food-catalog search OR filters were silently dropped; food-order date `between` mismatched UTC saves vs `+06:00` list bounds.
- **Affected:** `filterVariables.ts`, `formValues.ts`, `types.ts`, `react/index.ts`; rosna food order + catalog.

## 2026-07-06
- **Changed:** Bootstrapped knowledge system for this repo.
- **Why:** Cross-LLM durable knowledge + working memory.
- **Affected:** this repo only.

Last Updated: 2026-07-21
