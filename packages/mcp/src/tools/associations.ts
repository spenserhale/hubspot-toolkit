import { z } from "zod";
import type { FastMCP } from "fastmcp";
import { makeClient, toonText } from "./shared.js";

export function registerAssociationTools(server: FastMCP): void {
  server.addTool({
    name: "hubspot_list_associations",
    description: "List a HubSpot object's associations to another object type (e.g. a contact's associated companies).",
    parameters: z.object({
      fromObjectType: z.string(),
      fromObjectId: z.string(),
      toObjectType: z.string(),
    }),
    annotations: { readOnlyHint: true },
    execute: async (args) => toonText(await makeClient().listAssociations(args.fromObjectType, args.fromObjectId, args.toObjectType)),
  });

  server.addTool({
    name: "hubspot_create_association",
    description: "Associate two HubSpot objects using the default association type between their object types.",
    parameters: z.object({
      fromObjectType: z.string(),
      fromObjectId: z.string(),
      toObjectType: z.string(),
      toObjectId: z.string(),
    }),
    annotations: { readOnlyHint: false },
    execute: async (args) => {
      await makeClient().createAssociation(args.fromObjectType, args.fromObjectId, args.toObjectType, args.toObjectId);
      return toonText({ associated: true, ...args });
    },
  });

  server.addTool({
    name: "hubspot_delete_association",
    description: "Remove the association between two HubSpot objects.",
    parameters: z.object({
      fromObjectType: z.string(),
      fromObjectId: z.string(),
      toObjectType: z.string(),
      toObjectId: z.string(),
    }),
    annotations: { readOnlyHint: false, destructiveHint: true },
    execute: async (args) => {
      await makeClient().deleteAssociation(args.fromObjectType, args.fromObjectId, args.toObjectType, args.toObjectId);
      return toonText({ disassociated: true, ...args });
    },
  });
}
