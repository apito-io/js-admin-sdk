/**
 * Apito JavaScript SDK
 * A comprehensive JavaScript SDK for communicating with Apito GraphQL API endpoints
 * 
 * @module @apito-io/js-admin-sdk
 */

// Export main client and types
export { ApitoClient, createClient, deriveSystemAPIBaseURL } from './client';
export { TypedOperations } from './typed-operations';
export { Version, getVersion } from './version';
export {
  FILES_DELETE_PATH,
  FILES_LIST_PATH,
  FILES_UPLOAD_PATH,
} from './filesPaths';
export * from './types';
// Plan / permissions helpers only — do NOT re-export casbin-enforcer here.
// Casbin pulls Node-ish deps that break Cloudflare Workers SSR (API routes
// then fall through to [...slug] HTML). Use `@apito-io/js-admin-sdk/access`
// for the Casbin factory.
export {
  PLAN_TIERS,
  parsePlanTier,
  planRank,
  atLeast,
  type PlanTier,
} from './access/plan';
export type {
  EffectiveModelPermission,
  EffectivePermissionsSnapshot,
} from './access/permissions.types';
export { MY_EFFECTIVE_PERMISSIONS_QUERY } from './access/permissions.types';
export {
  scopeAllows,
  scopeForAction,
  canFromSnapshot,
  graceModelsFromSnapshot,
  buildCasbinPolicyFromSnapshot,
  type BuildCasbinPolicyOptions,
} from './access/permissions';
export { isPlanQuotaError } from './access/quota';
export {
  resourceMinPlan,
  annotateMenuItemsByPlan,
  type PlanMenuResource,
  type PlanMenuTreeItem,
  type PlanAnnotatedMenuItem,
} from './access/menu-plan';
export * from './naming/apitoGraphqlNames';
export { DocumentBuilder } from './naming/documentBuilder';
export { parseIntrospection, introspectionToSdl } from './naming/schemaReader';
export { resolveModelDataFields, resolveModelDataFieldNames } from './naming/dataFieldSelection';
export type { ApitoSchema, ApitoSchemaModel, ApitoSchemaField } from './naming/schemaReader';
export * from './generated';
export * from './headless/types';
export * from './headless/filterVariables';
export * from './headless/documents';
export {
  buildMutationConnectFromConnection,
  buildMutationConnectHasMany,
  buildMutationConnectHasOne,
  mutationConnectHasManyKey,
  mutationConnectHasOneKey,
  normalizeApitoRelationConnectMap,
  normalizeApitoRelationConnectValue,
} from "./headless/mutationConnect";
export {
  createBearerApitoFetcher,
  hasUsableGraphQLData,
} from './headless/fetcher';
export * from './headless/serializeGraphQLQuery';

// Re-export commonly used types for convenience
export type {
  ClientConfig,
  DefaultDocumentStructure,
  SearchResult,
  TypedDocumentStructure,
  TypedSearchResult,
  CreateAndUpdateRequest,
  GraphQLResponse,
  GraphQLError,
  ApitoError,
  ValidationError,
  InjectedDBOperationInterface,
  LoginUserParams,
  CreateUserParams,
  UpdateUserParams,
  User,
  File,
  UploadFileParams,
  FilesListResponse,
  DeleteFilesResponse,
} from './types';

// Default export for convenience
export { ApitoClient as default } from './client';
