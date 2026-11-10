import { buildCommand } from "@stricli/core";
import { HubspotClient } from "@hubspot-toolkit/sdk";
import { loadConfigOrExit, handleError } from "../../handle-error.js";
import { outputFlags, formatOutput } from "../../output.js";
import type { OutputFlags } from "../../output.js";
import { parseCsv } from "../../parse.js";

interface BatchReadFlags extends OutputFlags {
  readonly ids: string;
  readonly select?: string;
  readonly "id-property"?: string;
}

export const batchReadObjectsCommand = buildCommand({
  docs: { brief: "Read up to 100 objects by ID in one request" },
  parameters: {
    flags: {
      ids: { kind: "parsed", parse: String, brief: "Comma-separated object IDs (max 100)" },
      select: { kind: "parsed", parse: String, brief: "Comma-separated property names to return", optional: true },
      "id-property": { kind: "parsed", parse: String, brief: "Look objects up by a custom unique property instead of record ID", optional: true },
      ...outputFlags,
    },
    positional: {
      kind: "tuple",
      parameters: [
        { brief: "Object type (e.g. contacts, companies, deals, tickets)", parse: String },
      ],
    },
  },
  async func(this: void, flags: BatchReadFlags, objectType: string) {
    const ids = parseCsv(flags.ids) ?? [];
    try {
      const client = new HubspotClient(await loadConfigOrExit());
      const result = await client.batchReadObjects(objectType, ids, {
        properties: parseCsv(flags.select),
        idProperty: flags["id-property"],
      });
      console.log(formatOutput(result, flags));
    } catch (err) {
      handleError(err);
    }
  },
});
