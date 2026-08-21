import { buildCommand } from "@stricli/core";
import { HubspotClient } from "@hubspot-toolkit/sdk";
import { resolveConfigOrExit, handleError } from "../../handle-error.js";
import { outputFlags, formatOutput } from "../../output.js";
import type { OutputFlags } from "../../output.js";
import { parseCsv } from "../../parse.js";

interface ListObjectsFlags extends OutputFlags {
  readonly limit: number;
  readonly after?: string;
  readonly select?: string;
  readonly associations?: string;
  readonly archived: boolean;
}

export const listObjectsCommand = buildCommand({
  docs: { brief: "List objects of a given type (paginated)" },
  parameters: {
    flags: {
      limit: { kind: "parsed", parse: Number, brief: "Max results per page (default 10, max 100)", default: "10" },
      after: { kind: "parsed", parse: String, brief: "Pagination cursor from a previous page's paging.next.after", optional: true },
      select: { kind: "parsed", parse: String, brief: "Comma-separated property names to return", optional: true },
      associations: { kind: "parsed", parse: String, brief: "Comma-separated object types to include associated IDs for", optional: true },
      archived: { kind: "boolean", brief: "List archived (soft-deleted) objects instead of active ones", default: false },
      ...outputFlags,
    },
    positional: {
      kind: "tuple",
      parameters: [
        { brief: "Object type (e.g. contacts, companies, deals, tickets, or a custom object name)", parse: String },
      ],
    },
  },
  async func(this: void, flags: ListObjectsFlags, objectType: string) {
    try {
      const client = new HubspotClient(resolveConfigOrExit());
      const result = await client.listObjects(objectType, {
        limit: flags.limit,
        after: flags.after,
        properties: parseCsv(flags.select),
        associations: parseCsv(flags.associations),
        archived: flags.archived,
      });
      console.log(formatOutput(result, flags));
    } catch (err) {
      handleError(err);
    }
  },
});
