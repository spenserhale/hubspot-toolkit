import { buildCommand } from "@stricli/core";
import { HubspotClient } from "@hubspot-toolkit/sdk";
import { resolveConfigOrExit, handleError } from "../../handle-error.js";
import { outputFlags, formatOutput } from "../../output.js";
import type { OutputFlags } from "../../output.js";

interface DeleteObjectFlags extends OutputFlags {
  readonly "id-property"?: string;
  readonly "dry-run": boolean;
}

export const deleteObjectCommand = buildCommand({
  docs: { brief: "Delete (archive) an object by ID" },
  parameters: {
    flags: {
      "id-property": { kind: "parsed", parse: String, brief: "Look the object up by a custom unique property instead of its record ID (e.g. email)", optional: true },
      "dry-run": { kind: "boolean", brief: "Validate without calling the API", default: false },
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
  async func(this: void, flags: DeleteObjectFlags, objectType: string, id: string) {
    if (flags["dry-run"]) {
      console.log(formatOutput({ dry_run: true, objectType, id, action: "archive" }, flags));
      process.exit(0);
    }

    try {
      const client = new HubspotClient(resolveConfigOrExit());
      await client.archiveObject(objectType, id, { idProperty: flags["id-property"] });
      console.log(formatOutput({ archived: id, objectType }, flags));
    } catch (err) {
      handleError(err);
    }
  },
});
