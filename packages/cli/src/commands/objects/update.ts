import { buildCommand } from "@stricli/core";
import { HubspotClient } from "@hubspot-toolkit/sdk";
import { resolveConfigOrExit, handleError } from "../../handle-error.js";
import { outputFlags, formatOutput } from "../../output.js";
import type { OutputFlags } from "../../output.js";
import { parseJsonFlag } from "../../parse.js";

interface UpdateObjectFlags extends OutputFlags {
  readonly properties: string;
  readonly "id-property"?: string;
  readonly "dry-run": boolean;
}

export const updateObjectCommand = buildCommand({
  docs: { brief: "Update an existing object's properties" },
  parameters: {
    flags: {
      properties: { kind: "parsed", parse: String, brief: 'Properties to set as JSON, e.g. \'{"lifecyclestage":"customer"}\'' },
      "id-property": { kind: "parsed", parse: String, brief: "Look the object up by a custom unique property instead of its record ID (e.g. email)", optional: true },
      "dry-run": { kind: "boolean", brief: "Validate and print the payload without calling the API", default: false },
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
  async func(this: void, flags: UpdateObjectFlags, objectType: string, id: string) {
    const properties = parseJsonFlag<Record<string, string>>(flags.properties, "properties");

    if (flags["dry-run"]) {
      console.log(formatOutput({ dry_run: true, objectType, id, properties }, flags));
      process.exit(0);
    }

    try {
      const client = new HubspotClient(resolveConfigOrExit());
      const result = await client.updateObject(objectType, id, properties, {
        idProperty: flags["id-property"],
      });
      console.log(formatOutput(result, flags));
    } catch (err) {
      handleError(err);
    }
  },
});
