import { buildCommand } from "@stricli/core";
import { HubspotClient } from "@hubspot-toolkit/sdk";
import { resolveConfigOrExit, handleError } from "../../handle-error.js";
import { outputFlags, formatOutput } from "../../output.js";
import type { OutputFlags } from "../../output.js";
import { parseCsv } from "../../parse.js";

interface BatchDeleteFlags extends OutputFlags {
  readonly ids: string;
  readonly "dry-run": boolean;
}

export const batchDeleteObjectsCommand = buildCommand({
  docs: { brief: "Delete (archive) up to 100 objects by ID in one request" },
  parameters: {
    flags: {
      ids: { kind: "parsed", parse: String, brief: "Comma-separated object IDs (max 100)" },
      "dry-run": { kind: "boolean", brief: "Validate without calling the API", default: false },
      ...outputFlags,
    },
    positional: {
      kind: "tuple",
      parameters: [
        { brief: "Object type (e.g. contacts, companies, deals, tickets)", parse: String },
      ],
    },
  },
  async func(this: void, flags: BatchDeleteFlags, objectType: string) {
    const ids = parseCsv(flags.ids) ?? [];

    if (flags["dry-run"]) {
      console.log(formatOutput({ dry_run: true, objectType, count: ids.length, ids }, flags));
      process.exit(0);
    }

    try {
      const client = new HubspotClient(resolveConfigOrExit());
      await client.batchArchiveObjects(objectType, ids);
      console.log(formatOutput({ archived: ids, objectType }, flags));
    } catch (err) {
      handleError(err);
    }
  },
});
