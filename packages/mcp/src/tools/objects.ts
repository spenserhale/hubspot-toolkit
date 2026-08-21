import { z } from "zod";
import type { FastMCP } from "fastmcp";
import type { CreateObjectInput, BatchUpdateInputItem, SearchFilterGroup, SearchSort } from "@hubspot-toolkit/sdk";
import { makeClient, toonText } from "./shared.js";

const objectTypeParam = z
  .string()
  .describe("HubSpot object type: contacts, companies, deals, tickets, or a custom object name/typeId");

export function registerObjectTools(server: FastMCP): void {
  server.addTool({
    name: "hubspot_list_objects",
    description: "List HubSpot CRM objects of a given type, paginated.",
    parameters: z.object({
      objectType: objectTypeParam,
      limit: z.number().int().positive().max(100).optional().describe("Max results per page (default 10)"),
      after: z.string().optional().describe("Pagination cursor from a previous page's paging.next.after"),
      properties: z.array(z.string()).optional().describe("Property names to return"),
      associations: z.array(z.string()).optional().describe("Object types to include associated IDs for"),
      archived: z.boolean().optional().describe("List archived objects instead of active ones"),
    }),
    annotations: { readOnlyHint: true },
    execute: async (args) =>
      toonText(
        await makeClient().listObjects(args.objectType, {
          limit: args.limit,
          after: args.after,
          properties: args.properties,
          associations: args.associations,
          archived: args.archived,
        })
      ),
  });

  server.addTool({
    name: "hubspot_get_object",
    description: "Get a single HubSpot CRM object by ID.",
    parameters: z.object({
      objectType: objectTypeParam,
      id: z.string().describe("Object ID, or the idProperty value"),
      properties: z.array(z.string()).optional(),
      associations: z.array(z.string()).optional(),
      idProperty: z.string().optional().describe("Look the object up by a custom unique property instead of its record ID (e.g. email)"),
    }),
    annotations: { readOnlyHint: true },
    execute: async (args) =>
      toonText(
        await makeClient().getObject(args.objectType, args.id, {
          properties: args.properties,
          associations: args.associations,
          idProperty: args.idProperty,
        })
      ),
  });

  server.addTool({
    name: "hubspot_create_object",
    description: "Create a new HubSpot CRM object.",
    parameters: z.object({
      objectType: objectTypeParam,
      properties: z.record(z.string(), z.string()).describe("Object properties, e.g. { email: 'a@b.com' }"),
      associations: z
        .array(
          z.object({
            to: z.object({ id: z.string() }),
            types: z.array(z.object({ associationCategory: z.string(), associationTypeId: z.number() })),
          })
        )
        .optional()
        .describe("Associations to create alongside the object"),
    }),
    annotations: { readOnlyHint: false },
    execute: async (args) => {
      const input: CreateObjectInput = { properties: args.properties, associations: args.associations };
      return toonText(await makeClient().createObject(args.objectType, input));
    },
  });

  server.addTool({
    name: "hubspot_update_object",
    description: "Update an existing HubSpot CRM object's properties.",
    parameters: z.object({
      objectType: objectTypeParam,
      id: z.string().describe("Object ID, or the idProperty value"),
      properties: z.record(z.string(), z.string()),
      idProperty: z.string().optional(),
    }),
    annotations: { readOnlyHint: false },
    execute: async (args) =>
      toonText(await makeClient().updateObject(args.objectType, args.id, args.properties, { idProperty: args.idProperty })),
  });

  server.addTool({
    name: "hubspot_delete_object",
    description: "Delete (archive) a HubSpot CRM object by ID. This is a soft delete — HubSpot does not permanently purge the record.",
    parameters: z.object({
      objectType: objectTypeParam,
      id: z.string(),
      idProperty: z.string().optional(),
    }),
    annotations: { readOnlyHint: false, destructiveHint: true },
    execute: async (args) => {
      await makeClient().archiveObject(args.objectType, args.id, { idProperty: args.idProperty });
      return toonText({ archived: args.id, objectType: args.objectType });
    },
  });

  server.addTool({
    name: "hubspot_search_objects",
    description: "Search HubSpot CRM objects with a free-text query and/or structured filterGroups.",
    parameters: z.object({
      objectType: objectTypeParam,
      query: z.string().optional(),
      filterGroups: z
        .array(z.object({ filters: z.array(z.record(z.string(), z.unknown())) }))
        .optional()
        .describe("Filter groups (OR'd); filters within a group are AND'd"),
      sorts: z.array(z.object({ propertyName: z.string(), direction: z.enum(["ASCENDING", "DESCENDING"]).optional() })).optional(),
      properties: z.array(z.string()).optional(),
      limit: z.number().int().positive().max(200).optional(),
      after: z.string().optional(),
    }),
    annotations: { readOnlyHint: true },
    execute: async (args) =>
      toonText(
        await makeClient().searchObjects(args.objectType, {
          query: args.query,
          filterGroups: args.filterGroups as SearchFilterGroup[] | undefined,
          sorts: args.sorts as SearchSort[] | undefined,
          properties: args.properties,
          limit: args.limit ?? 10,
          after: args.after,
        })
      ),
  });

  server.addTool({
    name: "hubspot_batch_create_objects",
    description: "Create up to 100 HubSpot CRM objects in one request.",
    parameters: z.object({
      objectType: objectTypeParam,
      inputs: z.array(z.object({ properties: z.record(z.string(), z.string()) })),
    }),
    annotations: { readOnlyHint: false },
    execute: async (args) => toonText(await makeClient().batchCreateObjects(args.objectType, args.inputs as CreateObjectInput[])),
  });

  server.addTool({
    name: "hubspot_batch_read_objects",
    description: "Read up to 100 HubSpot CRM objects by ID in one request.",
    parameters: z.object({
      objectType: objectTypeParam,
      ids: z.array(z.string()).max(100),
      properties: z.array(z.string()).optional(),
      idProperty: z.string().optional(),
    }),
    annotations: { readOnlyHint: true },
    execute: async (args) =>
      toonText(await makeClient().batchReadObjects(args.objectType, args.ids, { properties: args.properties, idProperty: args.idProperty })),
  });

  server.addTool({
    name: "hubspot_batch_update_objects",
    description: "Update up to 100 HubSpot CRM objects in one request.",
    parameters: z.object({
      objectType: objectTypeParam,
      inputs: z.array(z.object({ id: z.string(), properties: z.record(z.string(), z.string()) })),
    }),
    annotations: { readOnlyHint: false },
    execute: async (args) => toonText(await makeClient().batchUpdateObjects(args.objectType, args.inputs as BatchUpdateInputItem[])),
  });

  server.addTool({
    name: "hubspot_batch_delete_objects",
    description: "Delete (archive) up to 100 HubSpot CRM objects by ID in one request.",
    parameters: z.object({
      objectType: objectTypeParam,
      ids: z.array(z.string()).max(100),
    }),
    annotations: { readOnlyHint: false, destructiveHint: true },
    execute: async (args) => {
      await makeClient().batchArchiveObjects(args.objectType, args.ids);
      return toonText({ archived: args.ids, objectType: args.objectType });
    },
  });
}
