import {
  HubspotConfigSchema,
  CrmObjectSchema,
  CrmObjectPageSchema,
  PropertyDefinitionSchema,
  AssociationListSchema,
  ErrorResponseSchema,
} from "./types.js";
import type {
  HubspotConfig,
  CrmObject,
  CrmObjectPage,
  CreateObjectInput,
  BatchUpdateInputItem,
  SearchRequest,
  PropertyDefinition,
  AssociationList,
} from "./types.js";
import {
  HubspotError,
  HubspotAuthError,
  HubspotNotFoundError,
  HubspotValidationError,
  HubspotRateLimitError,
} from "./errors.js";

type QueryValue = string | number | boolean | string[] | undefined;

interface RequestOptions {
  body?: unknown;
  query?: Record<string, QueryValue>;
}

export class HubspotClient {
  private readonly config: HubspotConfig;

  constructor(config: Partial<HubspotConfig> & { accessToken: string }) {
    this.config = HubspotConfigSchema.parse(config);
  }

  // -------------------------------------------------------------------------
  // HTTP helpers
  // -------------------------------------------------------------------------

  private buildQuery(query?: Record<string, QueryValue>): string {
    if (!query) return "";
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined) continue;
      sp.set(k, Array.isArray(v) ? v.join(",") : String(v));
    }
    const s = sp.toString();
    return s ? `?${s}` : "";
  }

  private async request<T>(
    method: string,
    path: string,
    opts: RequestOptions = {}
  ): Promise<T> {
    const url = `${this.config.baseUrl}${path}${this.buildQuery(opts.query)}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.accessToken}`,
      Accept: "application/json",
    };
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";

    const res = await fetch(url, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });

    if (!res.ok) await this.throwForResponse(res);

    if (res.status === 204) return undefined as T;
    const text = await res.text();
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  }

  private async throwForResponse(res: Response): Promise<never> {
    const raw = await res.json().catch(() => null);
    const parsed = ErrorResponseSchema.safeParse(raw);
    const message = parsed.success ? parsed.data.message : `HTTP ${res.status}`;

    if (res.status === 401 || res.status === 403) throw new HubspotAuthError(message);
    if (res.status === 404) throw new HubspotNotFoundError(message);
    if (res.status === 400 || res.status === 409) throw new HubspotValidationError(message);
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("Retry-After")) || undefined;
      throw new HubspotRateLimitError(message, retryAfter);
    }

    const code = parsed.success ? (parsed.data.category ?? "UNKNOWN") : "UNKNOWN";
    throw new HubspotError(message, code, res.status);
  }

  private objectPath(objectType: string, objectId?: string, suffix = ""): string {
    const base = `/crm/v3/objects/${encodeURIComponent(objectType)}`;
    return objectId ? `${base}/${encodeURIComponent(objectId)}${suffix}` : `${base}${suffix}`;
  }

  // -------------------------------------------------------------------------
  // Objects — generic CRUD, works for any objectType (contacts, companies,
  // deals, tickets, or a custom object's fully-qualified name / typeId)
  // -------------------------------------------------------------------------

  async listObjects(
    objectType: string,
    params: {
      limit?: number;
      after?: string;
      properties?: string[];
      propertiesWithHistory?: string[];
      associations?: string[];
      archived?: boolean;
    } = {}
  ): Promise<CrmObjectPage> {
    const data = await this.request<unknown>("GET", this.objectPath(objectType), {
      query: {
        limit: params.limit,
        after: params.after,
        properties: params.properties,
        propertiesWithHistory: params.propertiesWithHistory,
        associations: params.associations,
        archived: params.archived,
      },
    });
    return CrmObjectPageSchema.parse(data);
  }

  async getObject(
    objectType: string,
    objectId: string,
    params: {
      properties?: string[];
      propertiesWithHistory?: string[];
      associations?: string[];
      idProperty?: string;
    } = {}
  ): Promise<CrmObject> {
    const data = await this.request<unknown>("GET", this.objectPath(objectType, objectId), {
      query: {
        properties: params.properties,
        propertiesWithHistory: params.propertiesWithHistory,
        associations: params.associations,
        idProperty: params.idProperty,
      },
    });
    return CrmObjectSchema.parse(data);
  }

  async createObject(objectType: string, input: CreateObjectInput): Promise<CrmObject> {
    const data = await this.request<unknown>("POST", this.objectPath(objectType), {
      body: input,
    });
    return CrmObjectSchema.parse(data);
  }

  async updateObject(
    objectType: string,
    objectId: string,
    properties: Record<string, string>,
    opts: { idProperty?: string } = {}
  ): Promise<CrmObject> {
    const data = await this.request<unknown>("PATCH", this.objectPath(objectType, objectId), {
      body: { properties },
      query: { idProperty: opts.idProperty },
    });
    return CrmObjectSchema.parse(data);
  }

  /** Archives (soft-deletes) the object — this is HubSpot's DELETE. */
  async archiveObject(
    objectType: string,
    objectId: string,
    opts: { idProperty?: string } = {}
  ): Promise<void> {
    await this.request<void>("DELETE", this.objectPath(objectType, objectId), {
      query: { idProperty: opts.idProperty },
    });
  }

  async searchObjects(objectType: string, req: SearchRequest): Promise<CrmObjectPage> {
    const data = await this.request<unknown>("POST", this.objectPath(objectType, undefined, "/search"), {
      body: req,
    });
    return CrmObjectPageSchema.parse(data);
  }

  // -------------------------------------------------------------------------
  // Objects — batch operations (max 100 inputs per request, per HubSpot)
  // -------------------------------------------------------------------------

  async batchCreateObjects(
    objectType: string,
    inputs: CreateObjectInput[]
  ): Promise<{ results: CrmObject[] }> {
    const data = await this.request<{ results?: unknown[] }>(
      "POST",
      this.objectPath(objectType, undefined, "/batch/create"),
      { body: { inputs } }
    );
    return { results: CrmObjectSchema.array().parse(data.results ?? []) };
  }

  async batchReadObjects(
    objectType: string,
    ids: string[],
    opts: { properties?: string[]; idProperty?: string } = {}
  ): Promise<{ results: CrmObject[] }> {
    const data = await this.request<{ results?: unknown[] }>(
      "POST",
      this.objectPath(objectType, undefined, "/batch/read"),
      {
        body: {
          inputs: ids.map((id) => ({ id })),
          properties: opts.properties,
          idProperty: opts.idProperty,
        },
      }
    );
    return { results: CrmObjectSchema.array().parse(data.results ?? []) };
  }

  async batchUpdateObjects(
    objectType: string,
    inputs: BatchUpdateInputItem[]
  ): Promise<{ results: CrmObject[] }> {
    const data = await this.request<{ results?: unknown[] }>(
      "POST",
      this.objectPath(objectType, undefined, "/batch/update"),
      { body: { inputs } }
    );
    return { results: CrmObjectSchema.array().parse(data.results ?? []) };
  }

  async batchArchiveObjects(objectType: string, ids: string[]): Promise<void> {
    await this.request<void>("POST", this.objectPath(objectType, undefined, "/batch/archive"), {
      body: { inputs: ids.map((id) => ({ id })) },
    });
  }

  // -------------------------------------------------------------------------
  // Properties
  // -------------------------------------------------------------------------

  async listProperties(objectType: string): Promise<PropertyDefinition[]> {
    const data = await this.request<{ results?: unknown[] }>(
      "GET",
      `/crm/v3/properties/${encodeURIComponent(objectType)}`
    );
    return PropertyDefinitionSchema.array().parse(data.results ?? []);
  }

  async getProperty(objectType: string, propertyName: string): Promise<PropertyDefinition> {
    const data = await this.request<unknown>(
      "GET",
      `/crm/v3/properties/${encodeURIComponent(objectType)}/${encodeURIComponent(propertyName)}`
    );
    return PropertyDefinitionSchema.parse(data);
  }

  // -------------------------------------------------------------------------
  // Associations (CRM v4) — linking one object to another, e.g. a contact
  // to a company. Create/delete use the "default" association type between
  // the two object types, which covers the common single-relationship case.
  // -------------------------------------------------------------------------

  private associationPath(
    fromObjectType: string,
    fromObjectId: string,
    toObjectType: string,
    toObjectId?: string,
    useDefault = false
  ): string {
    const base = `/crm/v4/objects/${encodeURIComponent(fromObjectType)}/${encodeURIComponent(fromObjectId)}/associations/${useDefault ? "default/" : ""}${encodeURIComponent(toObjectType)}`;
    return toObjectId ? `${base}/${encodeURIComponent(toObjectId)}` : base;
  }

  async listAssociations(
    fromObjectType: string,
    fromObjectId: string,
    toObjectType: string
  ): Promise<AssociationList> {
    const data = await this.request<unknown>(
      "GET",
      this.associationPath(fromObjectType, fromObjectId, toObjectType)
    );
    return AssociationListSchema.parse(data);
  }

  async createAssociation(
    fromObjectType: string,
    fromObjectId: string,
    toObjectType: string,
    toObjectId: string
  ): Promise<void> {
    await this.request<void>(
      "PUT",
      this.associationPath(fromObjectType, fromObjectId, toObjectType, toObjectId, true)
    );
  }

  async deleteAssociation(
    fromObjectType: string,
    fromObjectId: string,
    toObjectType: string,
    toObjectId: string
  ): Promise<void> {
    await this.request<void>(
      "DELETE",
      this.associationPath(fromObjectType, fromObjectId, toObjectType, toObjectId)
    );
  }
}
