import { z } from "zod";
import type { FastMCP } from "fastmcp";
import { makeClient, toonText } from "./shared.js";

export function registerPropertyTools(server: FastMCP): void {
  server.addTool({
    name: "hubspot_list_properties",
    description: "List all property (field) definitions for a HubSpot CRM object type.",
    parameters: z.object({
      objectType: z.string().describe("HubSpot object type: contacts, companies, deals, tickets, or a custom object name"),
    }),
    annotations: { readOnlyHint: true },
    execute: async (args) => toonText(await makeClient().listProperties(args.objectType)),
  });

  server.addTool({
    name: "hubspot_get_property",
    description: "Get a single property definition for a HubSpot CRM object type.",
    parameters: z.object({
      objectType: z.string(),
      propertyName: z.string().describe("Internal property name, e.g. firstname"),
    }),
    annotations: { readOnlyHint: true },
    execute: async (args) => toonText(await makeClient().getProperty(args.objectType, args.propertyName)),
  });
}
