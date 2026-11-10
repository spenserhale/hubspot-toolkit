import { buildCommand } from "@stricli/core";
import { HubspotClient } from "@hubspot-toolkit/sdk";
import type { CreateObjectInput } from "@hubspot-toolkit/sdk";
import { loadConfigOrExit, handleError } from "../../handle-error.js";
import { outputFlags, formatOutput } from "../../output.js";
import type { OutputFlags } from "../../output.js";
import { parseJsonFlag } from "../../parse.js";

interface CreateObjectFlags extends OutputFlags {
  readonly properties: string;
  readonly associations?: string;
  readonly "dry-run": boolean;
}

export const createObjectCommand = buildCommand({
  docs: { brief: "Create a new object" },
  parameters: {
    flags: {
      properties: { kind: "parsed", parse: String, brief: 'Object properties as JSON, e.g. \'{"email":"a@b.com"}\'' },
      associations: { kind: "parsed", parse: String, brief: "Associations to create alongside the object, as a JSON array (CreateObjectInput.associations)", optional: true },
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
  async func(this: void, flags: CreateObjectFlags, objectType: string) {
    const properties = parseJsonFlag<Record<string, string>>(flags.properties, "properties");
    const associations = flags.associations
      ? parseJsonFlag<CreateObjectInput["associations"]>(flags.associations, "associations")
      : undefined;
    const input: CreateObjectInput = { properties, associations };

    if (flags["dry-run"]) {
      console.log(formatOutput({ dry_run: true, objectType, input }, flags));
      process.exit(0);
    }

    try {
      const client = new HubspotClient(await loadConfigOrExit());
      const result = await client.createObject(objectType, input);
      console.log(formatOutput(result, flags));
    } catch (err) {
      handleError(err);
    }
  },
});
