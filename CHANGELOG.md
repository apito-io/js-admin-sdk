# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.0] - 2026-05-17

### Changed (breaking)

- **Tenant-user API renamed to User API** — aligned with engine open-core migration. All `*TenantUser*` types and methods renamed (e.g. `loginUser`, `searchUsers`, `createUser`, `updateUser`, `deleteUser`).
- **`googleOAuthState`** replaces `tenantGoogleOAuthState`.
- **`updateUser`** no longer accepts `password`; use **`resetUserPassword`**.

### Added

- **`resetUserPassword(userId, password)`**
- **`getProjectStorageSettings`**, **`updateProjectStorageSettings`**
- **`uploadSystemFile`**, **`listSystemFiles`**, **`deleteSystemFiles`** — `/system/files` REST (`restBaseURL` optional)
- Examples: `examples/users/`, `examples/system_files/` (replaces `examples/tenant_users/`)

### Migration

| v2.7.x | v3.0.0 |
|--------|--------|
| `loginTenantUser` | `loginUser` |
| `TenantGoogleOAuthState` / `tenantGoogleOAuthState` | `googleOAuthState` |
| `searchTenantUsers` | `searchUsers` |
| `createTenantUser` | `createUser` |
| `updateTenantUser` (+ password) | `updateUser` + `resetUserPassword` |
| `deleteTenantUser` | `deleteUser` |
| `TenantUser` | `User` |

## [2.7.0] - 2026-05-08

### Changed (breaking)

- **Tenant Google login** no longer uses **`loginTenantUserGoogle`**. Use **`loginTenantUser`** with **`authMethod: 'google'`**, **`code`**, and **`state`** after the browser returns from Google OAuth. Call **`tenantGoogleOAuthState(projectId)`** first to obtain **`state`** for the authorize URL.
- **`TenantLoginParams`**: **`password`** optional when using Google flow; added **`code`**, **`state`**.

### Removed

- **`loginTenantUserGoogle`** (engine removed the mutation).

## [2.6.0] - 2026-05-09

### Changed (breaking)

- **Tenant catalog users** aligned with Apito Engine Pro GraphQL: **`TenantUser`** includes **`phone`** ( **`username`** removed). **`loginTenantUser`** now takes **`TenantLoginParams`**: **`{ projectId, password, email?, phone?, authMethod? }`** matching system **`loginTenantUser`** (email vs phone per project Authentication settings).
- **`createTenantUser`** is now **`(projectId, CreateTenantUserParams)`** (**`password`**, optional **`role`**, **`email`**, **`phone`**); **`username`** argument removed.

### Added

- **`updateTenantUser`**, **`deleteTenantUser`** (system **`updateTenantUser`** / **`deleteTenantUser`**; project scope comes from the API key).

### Migration examples

Use `loginTenantUser({ projectId, password, email: 'you@corp.com' })` or `{ phone: '+1...' }` per catalog sign-in mode. Use `createTenantUser(projectId, { password: '…', email: '…', role: 'member' })`.

## [2.5.0] - 2026-05-09

### Changed (breaking)

- **`generateTenantToken`**: signature is now **`(tenantId, duration?, role?)`**, aligned with engine `generateTenantToken` (`tenant_id`, `duration`, optional `role`). Removed the unused legacy **`token`** first argument; GraphQL mutation now passes optional **`role`**.

## [2.4.0] - 2026-05-09

### Changed (breaking)

- **`searchTenantsByDomain`**: now `(projectId, domain)` only; returns **`TenantByDomainResponse`** `{ tenant: ... | null }` (exact match, no pagination). Replaces list + `count`.

### Engine parity (documented)

- System GraphQL **`createTenant`** / **`updateTenant`**: optional **`domain`** is validated for uniqueness within the project (see README).

## [2.3.0] - 2026-05-09

### Added

- **Pro tenant catalog search by domain**: `searchTenantsByDomain`; types `TenantCatalogSearchRow`, `TenantsByDomainResponse`.

## [2.2.0] - 2026-05-08

### Added

- **Pro tenant catalog users** (parity with Go SDK): `loginTenantUser`, `loginTenantUserGoogle`, `searchTenantUsers`, `createTenantUser`; types `TenantUser`, `TenantLoginResponse`, `TenantUsersResponse`.
- **`examples/tenant_users`**: Node example listing tenant users (and optional password login) via the same env vars as the Go sample.

### Tests

- Jest: **`Tenant users (Pro)`** block in `src/__tests__/client.test.ts` — integration-style calls when `process.env.APITO_PROJECT_ID` is set; otherwise logs and continues.

## [2.1.2] - 2026-04-18

### Fixed

- `generateTenantToken`: align GraphQL with the engine (`tenant_id` + required `duration` as `YYYY-MM-DD`); remove obsolete `token` mutation argument. Default expiry is one calendar year ahead in UTC. Legacy first parameter is ignored (auth uses `X-Apito-Key` / client `apiKey`).

## [2.1.1] - 2026-04-02

### Fixed

- TypeScript 6 + `tsup` DTS: use `moduleResolution` `bundler` (replaces deprecated `node` / `node10`) and `ignoreDeprecations` `6.0` so declaration emit succeeds when tooling merges deprecated options such as `baseUrl` (`prepare` / `pnpm install` / `npm run build`)

## [2.1.0] - 2026-04-02

### Added

- Public `ApitoClient.executeGraphQL()` for arbitrary admin/system GraphQL (e.g. plugin-registered mutations) with optional per-call `tenantId`
- `InjectedDBOperationInterface` now includes `executeGraphQL` for parity with embedders

## [2.0.0] - 2026-04-02

### Changed

- **BREAKING**: npm package renamed from `@apito-io/js-internal-sdk` to `@apito-io/js-admin-sdk`
- GitHub repository identity: `github.com/apito-io/js-admin-sdk` (clone directory: `js-admin-sdk`)
- Pairing: plugin build SDK is published as `@apito-io/js-plugin-build-sdk` ([`js-plugin-build-sdk`](https://github.com/apito-io/js-plugin-build-sdk))

## [1.2.1] - 2026-04-02

### Changed

- Publish to npm as `@apito-io/js-internal-sdk` (aligned with `@apito-io/js-apito-plugin-sdk` scope)
- Repository metadata targets `github.com/apito-io/js-internal-sdk`
- GitHub Actions: CI on pull requests, publish and GitHub Release on `v*` tags ([`.github/workflows/publish.yml`](.github/workflows/publish.yml))
- Dependabot weekly npm updates ([`.github/dependabot.yml`](.github/dependabot.yml))
- Dev dependency refresh (Jest 30, current TypeScript 5.9.x, `npm audit` clean)

### Added

- [`RELEASE.md`](RELEASE.md) release checklist; [`release.sh`](release.sh) helper to tag and push

## [1.2.0] - 2025-10-19

### Changed

- **BREAKING**: Synchronized JS SDK to match Go SDK v1.2.0 exactly
- Updated `createNewResource()` to use `upsertModelData` mutation (matching Go SDK)
- Updated `getRelationDocuments()` to use `getModelData` query with connection parameter (matching Go SDK)
- Updated `updateResource()` mutation parameter order to match Go SDK
- Updated `deleteResource()` mutation name to `DeleteData` (matching Go SDK)
- Added validation checks for required parameters in `createNewResource()` and `updateResource()`

### Removed

- **BREAKING**: Removed `sendAuditLog()` method (not present in Go SDK)
- Removed `AuditData` interface (not used in Go SDK)

### Added

- Added `version.ts` file with `Version` constant and `getVersion()` function (matching Go SDK structure)
- Exported `Version` and `getVersion` from main index
- Enhanced error messages to match Go SDK patterns

### Tests

- Completely rewrote test suite to match Go SDK test structure
- Removed all mocked responses - now uses real API calls (matching Go SDK approach)
- Added same test constants (BaseURL, APIKey) as Go SDK
- Added Task, Product, and User interfaces matching Go SDK test types
- Implemented all core method tests with real API integration
- Added typed operations integration tests
- Added error handling validation tests
- Tests now log results like Go SDK (with ✅ success indicators)

### Fixed

- Fixed GraphQL query structures to match exactly with Go SDK implementation
- Fixed variable naming and parameter passing to match Go SDK conventions

## [1.0.0] - 2024-07-15

### Added

- Initial release of the Apito JavaScript SDK
- Complete implementation matching the Go SDK functionality
- TypeScript support with full type definitions
- Core client with all GraphQL operations
- Typed operations for type-safe development
- Comprehensive error handling
- Environment variable support
- Basic and advanced examples
- Full documentation and README
- MIT License

### Features

- `getSingleResource()` - Get single resource by ID
- `searchResources()` - Search resources with filtering
- `createNewResource()` - Create new resources
- `updateResource()` - Update existing resources
- `deleteResource()` - Delete resources
- `getRelationDocuments()` - Get related documents
- `generateTenantToken()` - Generate tenant tokens
- `debug()` - Debug functionality

### Type Safety

- Generic typed methods for all operations
- TypeScript interfaces for all data structures
- Error type definitions
- Configuration type definitions

### Error Handling

- Custom error classes for different error types
- GraphQL error parsing
- HTTP error handling
- Validation error handling

### Documentation

- Comprehensive README with examples
- TypeScript documentation
- API reference
- Quick start guide
- Advanced usage examples
