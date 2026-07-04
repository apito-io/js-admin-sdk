/**
 * Apito JavaScript SDK
 * A comprehensive JavaScript SDK for communicating with Apito GraphQL API endpoints
 * 
 * @module @apito-io/js-admin-sdk
 */

// Export main client and types
export { ApitoClient, createClient } from './client';
export { TypedOperations } from './typed-operations';
export { Version, getVersion } from './version';
export {
  FILES_DELETE_PATH,
  FILES_LIST_PATH,
  FILES_UPLOAD_PATH,
} from './filesPaths';
export * from './types';
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
export { createBearerApitoFetcher } from './headless/fetcher';
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
