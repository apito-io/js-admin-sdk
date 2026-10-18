# js-admin-sdk — Current

- **License identifier (2026-10-18, uncommitted):** `package.json` `license` is `Apache-2.0`. CHANGELOG says the published npm identifier moves from MIT to Apache-2.0. The LICENSE file was already Apache text. No version bump and no publish. Origin is still GitLab. Leave `.memory` out of the public diff. Ask before `./command.sh save`.

- **Facebook token (2026-10-16, uncommitted):** `LoginUserParams.accessToken` and `authMethod: facebook_access_token` use the canonical `loginUser` query with optional `access_token`, matching Dart and Go. TypeScript passes. No version bump; dist is gitignored. Ask before commit or `./command.sh save`.

- **Codegen artifacts (2026-10-12):** `apito-codegen --artifacts sdk` writes types and the SDK only. `app` remains the default and still writes hooks and UI. No package bump. Ask before commit.

- **Billing interval (2026-09-26):** `billingIntervalMonths` on create and update tenant subscription. Allowed 1, 3, 4, 6, 12. No package bump. Dist gitignored — `pnpm build` before publish. Ask before commit.

- **Project share active (2026-09-23):** `PartnerProjectRate.active`. List and upsert send `active` (default false). No package bump. Dist gitignored — `pnpm build` before publish. Ask before commit.

- **Bearer JWT (2026-09-21):** `authHeaders` sets `X-Use-Cookies: false` for `bearerToken` (same as `apt_`). GitLab `d6f128e`. Dist gitignored — `pnpm build` before app bundle.
- **3.14.2 (2026-09-06):** `allFieldRoles` on Casbin policy builder;
  extra unmapped import/export columns pass through (Suchok variants).
- **3.14.1 tagged 2026-09-02:** `updateTenantSubscription` optional
  `partnerId` + `currentPeriodEnd`. `partner_id` is Console / Udbhabon
  Admin only; catalog reads skip it unless `{ includePartner: true }`.

## Last Updated

2026-09-21
