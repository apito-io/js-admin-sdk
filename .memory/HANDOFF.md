# Handoff — js-admin-sdk 2026-10-18

## Apache-2.0 identifier

- **Done:** `package.json` license, homepage, repository, bugs, keywords, README opening, and an Unreleased CHANGELOG note.
- **Not done:** No npm publish, version bump, or push to GitHub. This checkout tracks GitLab.
- **Do not:** Leave the field as MIT. Do not include `.memory` in the public commit. `./command.sh save` until asked.

## Facebook token login

- **Done:** Added `accessToken` to `LoginUserParams`, `facebook_access_token` validation, and the optional `access_token` argument to the canonical `loginUser` document.
- **Verified:** `pnpm exec tsc --noEmit` passed.
- **Not done:** Package version bump, build/publish, and commit.
- **Do not:** `./command.sh save` until asked.

# Handoff — js-admin-sdk 2026-10-12

## Codegen artifacts

- **Done:** `--artifacts app|sdk` on `scripts/apito-codegen-run.ts`. `sdk` skips hooks and the resource registry.
- **Not done:** A Node test of that flag. Package bump.
- **Do not:** Claim the generator emits plain JavaScript. `./command.sh save` until asked.

# Handoff — js-admin-sdk 2026-09-23

## Project share active

- `listPartnerProjectRates` and `upsertPartnerProjectRate` include `active`.
- Next: `pnpm build` only if an app consumes `dist/`. Console uses source.
- Do not: npm publish. Do not `./command.sh save` until confirmed.

## Released

- **master** `d6f128e`: user JWT + `X-Use-Cookies: false`.
- **3.14.2** still last package bump (Suchok 1.4.0). No npm tag this cut.

## Done

- `/system/graphql` with `bearerToken` no longer falls through to console cookies.

## Next

- Optional npm bump if apps consume registry not `link:` / Vite alias.
- Rebuild `dist/` after pull (`pnpm build`); dist is gitignored.
- Uncommitted: codegen-run + importExport/ui leftovers.

## Last Updated

2026-09-21
