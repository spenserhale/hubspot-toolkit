import { buildCommand } from "@stricli/core";
import { HubspotClient } from "@hubspot-toolkit/sdk";
import type { CreateObjectInput } from "@hubspot-toolkit/sdk";
import { loadConfigOrExit, handleError } from "../../handle-error.js";
import { outputFlags, formatOutput } from "../../output.js";
import type { OutputFlags } from "../../output.js";
import { parseJsonFlag } from "../../parse.js";

interface BatchCreateFlags extends OutputFlags {
  readonly inputs: string;
  readonly "dry-run": boolean;
}

export const batchCreateObjectsCommand = buildCommand({
  docs: { brief: "Create up to 100 objects in one request" },
  parameters: {
    flags: {
      inputs: { kind: "parsed", parse: String, brief: 'Array of CreateObjectInput as JSON, e.g. \'[{"properties":{"email":"a@b.com"}}]\'' },
      "dry-run": { kind: "boolean", brief: "Validate and print the payload without calling the API", default: false },
      ...outputFlags,
    },
    positional: {
      kind: "tuple",
      parameters: [
        { brief: "Object type (e.g. contacts, companies, deals, tickets)", parse: String },
      ],
    },
  },
  async func(this: void, flags: BatchCreateFlags, objectType: string) {
    const inputs = parseJsonFlag<CreateObjectInput[]>(flags.inputs, "inputs");

    if (flags["dry-run"]) {
      console.log(formatOutput({ dry_run: true, objectType, count: inputs.length, inputs }, flags));
      process.exit(0);
    }

    try {
      const client = new HubspotClient(await loadConfigOrExit());
      const result = await client.batchCreateObjects(objectType, inputs);
      console.log(formatOutput(result, flags));
    } catch (err) {
      handleError(err);
    }
  },
});
