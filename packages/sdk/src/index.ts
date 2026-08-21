export { HubspotClient } from "./client.js";
export { resolveConfig } from "./config.js";
export {
  HubspotError,
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
