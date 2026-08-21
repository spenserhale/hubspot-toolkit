import { buildCommand } from "@stricli/core";
import { HubspotClient } from "@hubspot-toolkit/sdk";
import { resolveConfigOrExit, handleError } from "../../handle-error.js";
import { outputFlags, formatOutput } from "../../output.js";
import type { OutputFlags } from "../../output.js";
import { parseCsv } from "../../parse.js";

interface GetObjectFlags extends OutputFlags {
  readonly select?: string;
  readonly associations?: string;
  readonly "id-property"?: string;
}

export const getObjectCommand = buildCommand({
  docs: { brief: "Get a single object by ID" },
  parameters: {
    flags: {
      select: { kind: "parsed", parse: String, brief: "Comma-separated property names to return", optional: true },
      associations: { kind: "parsed", parse: String, brief: "Comma-separated object types to include associated IDs for", optional: true },
      "id-property": { kind: "parsed", parse: String, brief: "Look the object up by a custom unique property instead of its record ID (e.g. email)", optional: true },
      ...outputFlags,
    },
    positional: {
      kind: "tuple",
      parameters: [
        { brief: "Object type (e.g. contacts, companies, deals, tickets)", parse: String },
        { brief: "Object ID, or the --id-property value", parse: String },
      ],
    },
  },
  async func(this: void, flags: GetObjectFlags, objectType: string, id: string) {
    try {
      const client = new HubspotClient(resolveConfigOrExit());
      const result = await client.getObject(objectType, id, {
        properties: parseCsv(flags.select),
        associations: parseCsv(flags.associations),
        idProperty: flags["id-property"],
      });
      console.log(formatOutput(result, flags));
    } catch (err) {
      handleError(err);
    }
  },
});
