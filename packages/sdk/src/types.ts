import { z } from "zod";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export const HubspotConfigSchema = z.object({
  accessToken: z.string().min(1, "Access token is required"),
  baseUrl: z.string().url().default("https://api.hubapi.com"),
});

export type HubspotConfig = z.infer<typeof HubspotConfigSchema>;

// ---------------------------------------------------------------------------
// CRM objects (generic — works for contacts, companies, deals, tickets,
// and any custom object type, keyed by objectType)
// ---------------------------------------------------------------------------

export const CrmObjectSchema = z.object({
  id: z.string(),
  properties: z.record(z.string(), z.union([z.string(), z.null()])),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  archived: z.boolean().optional(),
  associations: z.record(z.string(), z.unknown()).optional(),
});

export type CrmObject = z.infer<typeof CrmObjectSchema>;

export const PagingSchema = z.object({
  next: z
    .object({
      after: z.string(),
      link: z.string().optional(),
    })
    .optional(),
});

export type Paging = z.infer<typeof PagingSchema>;

export const CrmObjectPageSchema = z.object({
  results: z.array(CrmObjectSchema),
  paging: PagingSchema.optional(),
});

export type CrmObjectPage = z.infer<typeof CrmObjectPageSchema>;

export interface CreateObjectInput {
  properties: Record<string, string>;
  associations?: Array<{
    to: { id: string };
    types: Array<{ associationCategory: string; associationTypeId: number }>;
  }>;
}

export interface BatchUpdateInputItem {
  id: string;
  properties: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export const FilterOperatorSchema = z.enum([
  "EQ",
  "NEQ",
  "LT",
  "LTE",
  "GT",
  "GTE",
  "BETWEEN",
  "IN",
  "NOT_IN",
  "HAS_PROPERTY",
  "NOT_HAS_PROPERTY",
  "CONTAINS_TOKEN",
  "NOT_CONTAINS_TOKEN",
]);

export type FilterOperator = z.infer<typeof FilterOperatorSchema>;

export const SearchFilterSchema = z.object({
  propertyName: z.string(),
  operator: FilterOperatorSchema,
  value: z.string().optional(),
  values: z.array(z.string()).optional(),
  highValue: z.string().optional(),
});

export type SearchFilter = z.infer<typeof SearchFilterSchema>;

export const SearchFilterGroupSchema = z.object({
  filters: z.array(SearchFilterSchema),
});

export type SearchFilterGroup = z.infer<typeof SearchFilterGroupSchema>;

export const SearchSortSchema = z.object({
  propertyName: z.string(),
  direction: z.enum(["ASCENDING", "DESCENDING"]).default("ASCENDING"),
});

export type SearchSort = z.infer<typeof SearchSortSchema>;

export const SearchRequestSchema = z.object({
  query: z.string().optional(),
  filterGroups: z.array(SearchFilterGroupSchema).optional(),
  sorts: z.array(SearchSortSchema).optional(),
  properties: z.array(z.string()).optional(),
  limit: z.number().int().positive().max(200).default(10),
  after: z.string().optional(),
});

export type SearchRequest = z.infer<typeof SearchRequestSchema>;

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

export const PropertyOptionSchema = z.object({
  label: z.string(),
  value: z.string(),
  hidden: z.boolean().optional(),
  displayOrder: z.number().optional(),
});

export const PropertyDefinitionSchema = z.object({
  name: z.string(),
  label: z.string().optional(),
  type: z.string().optional(),
  fieldType: z.string().optional(),
  description: z.string().optional(),
  groupName: z.string().optional(),
  options: z.array(PropertyOptionSchema).optional(),
  calculated: z.boolean().optional(),
  hidden: z.boolean().optional(),
});

export type PropertyDefinition = z.infer<typeof PropertyDefinitionSchema>;

// ---------------------------------------------------------------------------
// Associations (CRM v4)
// ---------------------------------------------------------------------------

export const AssociationTypeSchema = z.object({
  category: z.string(),
  typeId: z.number(),
  label: z.string().nullable().optional(),
});

export const AssociationEntrySchema = z.object({
  toObjectId: z.string(),
  associationTypes: z.array(AssociationTypeSchema).optional(),
});

export type AssociationEntry = z.infer<typeof AssociationEntrySchema>;

export const AssociationListSchema = z.object({
  results: z.array(AssociationEntrySchema),
  paging: PagingSchema.optional(),
});

export type AssociationList = z.infer<typeof AssociationListSchema>;

// ---------------------------------------------------------------------------
// API error envelope
// ---------------------------------------------------------------------------

export const ErrorResponseSchema = z.object({
  status: z.string().optional(),
  message: z.string(),
  correlationId: z.string().optional(),
  category: z.string().optional(),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
