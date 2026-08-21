import { buildCommand } from "@stricli/core";
import { HubspotClient } from "@hubspot-toolkit/sdk";
import type { SearchFilterGroup, SearchSort } from "@hubspot-toolkit/sdk";
import { resolveConfigOrExit, handleError } from "../../handle-error.js";
import { outputFlags, formatOutput } from "../../output.js";
import type { OutputFlags } from "../../output.js";
import { parseCsv, parseJsonFlag } from "../../parse.js";

interface SearchObjectsFlags extends OutputFlags {
  readonly query?: string;
  readonly "filter-groups"?: string;
  readonly sorts?: string;
  readonly select?: string;
  readonly limit: number;
  readonly after?: string;
}

export const searchObjectsCommand = buildCommand({
  docs: { brief: "Search objects with a free-text query and/or structured filters" },
  parameters: {
    flags: {
      query: { kind: "parsed", parse: String, brief: "Free-text search query", optional: true },
      "filter-groups": { kind: "parsed", parse: String, brief: "Filter groups as JSON (SearchFilterGroup[]) — groups are OR'd, filters within a group are AND'd", optional: true },
      sorts: { kind: "parsed", parse: String, brief: "Sort order as JSON (SearchSort[])", optional: true },
      select: { kind: "parsed", parse: String, brief: "Comma-separated property names to return", optional: true },
      limit: { kind: "parsed", parse: Number, brief: "Max results per page (default 10, max 200)", default: "10" },
      after: { kind: "parsed", parse: String, brief: "Pagination cursor from a previous page's paging.next.after", optional: true },
      ...outputFlags,
    },
    positional: {
      kind: "tuple",
      parameters: [
        { brief: "Object type (e.g. contacts, companies, deals, tickets)", parse: String },
      ],
    },
  },
  async func(this: void, flags: SearchObjectsFlags, objectType: string) {
    const filterGroups = flags["filter-groups"]
      ? parseJsonFlag<SearchFilterGroup[]>(flags["filter-groups"], "filter-groups")
      : undefined;
    const sorts = flags.sorts ? parseJsonFlag<SearchSort[]>(flags.sorts, "sorts") : undefined;

    try {
      const client = new HubspotClient(resolveConfigOrExit());
      const result = await client.searchObjects(objectType, {
        query: flags.query,
        filterGroups,
        sorts,
        properties: parseCsv(flags.select),
        limit: flags.limit,
        after: flags.after,
      });
      console.log(formatOutput(result, flags));
    } catch (err) {
      handleError(err);
    }
  },
});
