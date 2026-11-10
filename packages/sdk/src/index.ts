export { HubspotClient } from "./client.js";
export {
  resolveConfig,
  resolveConfigState,
  loadConfig,
  loadConfigState,
  redactedConfig,
  credentialValue,
  DEFAULT_BASE_URL,
} from "./config.js";
export type {
  ConfigState,
  ResolvedConfig,
  ResolveConfigOptions,
  LoadConfigOptions,
  KeychainState,
  RedactedConfig,
  Env,
} from "./config.js";
export {
  KEYCHAIN_SERVICE,
  CREDENTIAL_KEYS,
  CREDENTIAL_RESOURCES,
  bunSecretStore,
  readKeychainValues,
  resourceCredentialKeys,
  resourceForCredentialKey,
  errorDetail,
} from "./secrets.js";
export type {
  SecretStore,
  CredentialResource,
  KeychainStatus,
  KeychainReadResult,
} from "./secrets.js";
export {
  HubspotError,
  HubspotConfigError,
  HubspotAuthError,
  HubspotNotFoundError,
  HubspotValidationError,
  HubspotRateLimitError,
} from "./errors.js";
export type {
  HubspotConfig,
  CrmObject,
  CrmObjectPage,
  Paging,
  CreateObjectInput,
  BatchUpdateInputItem,
  FilterOperator,
  SearchFilter,
  SearchFilterGroup,
  SearchSort,
  SearchRequest,
  PropertyDefinition,
  AssociationEntry,
  AssociationList,
  ErrorResponse,
} from "./types.js";
export {
  HubspotConfigSchema,
  CrmObjectSchema,
  CrmObjectPageSchema,
  PagingSchema,
  FilterOperatorSchema,
  SearchFilterSchema,
  SearchFilterGroupSchema,
  SearchSortSchema,
  SearchRequestSchema,
  PropertyDefinitionSchema,
  AssociationListSchema,
  ErrorResponseSchema,
} from "./types.js";
