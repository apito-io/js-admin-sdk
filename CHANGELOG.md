# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
