import { buildCommand } from "@stricli/core";
import { HubspotClient } from "@hubspot-toolkit/sdk";
import type { BatchUpdateInputItem } from "@hubspot-toolkit/sdk";
import { resolveConfigOrExit, handleError } from "../../handle-error.js";
import { outputFlags, formatOutput } from "../../output.js";
import type { OutputFlags } from "../../output.js";
import { parseJsonFlag } from "../../parse.js";

interface BatchUpdateFlags extends OutputFlags {
  readonly inputs: string;
  readonly "dry-run": boolean;
}

export const batchUpdateObjectsCommand = buildCommand({
  docs: { brief: "Update up to 100 objects in one request" },
  parameters: {
    flags: {
      inputs: { kind: "parsed", parse: String, brief: 'Array of {id, properties} as JSON, e.g. \'[{"id":"123","properties":{"lifecyclestage":"customer"}}]\'' },
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
  async func(this: void, flags: BatchUpdateFlags, objectType: string) {
    const inputs = parseJsonFlag<BatchUpdateInputItem[]>(flags.inputs, "inputs");

    if (flags["dry-run"]) {
      console.log(formatOutput({ dry_run: true, objectType, count: inputs.length, inputs }, flags));
      process.exit(0);
    }

    try {
      const client = new HubspotClient(resolveConfigOrExit());
      const result = await client.batchUpdateObjects(objectType, inputs);
      console.log(formatOutput(result, flags));
    } catch (err) {
      handleError(err);
    }
  },
});
