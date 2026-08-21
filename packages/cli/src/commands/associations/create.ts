import { buildCommand } from "@stricli/core";
import { HubspotClient } from "@hubspot-toolkit/sdk";
import { resolveConfigOrExit, handleError } from "../../handle-error.js";
import { outputFlags, formatOutput } from "../../output.js";
import type { OutputFlags } from "../../output.js";

interface CreateAssociationFlags extends OutputFlags {
  readonly "dry-run": boolean;
}

export const createAssociationCommand = buildCommand({
  docs: { brief: "Associate two objects using the default association type between their types" },
  parameters: {
    flags: {
      "dry-run": { kind: "boolean", brief: "Validate without calling the API", default: false },
      ...outputFlags,
    },
    positional: {
      kind: "tuple",
      parameters: [
        { brief: "From object type (e.g. contacts)", parse: String },
        { brief: "From object ID", parse: String },
        { brief: "To object type (e.g. companies)", parse: String },
        { brief: "To object ID", parse: String },
      ],
    },
  },
  async func(
    this: void,
    flags: CreateAssociationFlags,
    fromObjectType: string,
    fromObjectId: string,
    toObjectType: string,
    toObjectId: string
  ) {
    if (flags["dry-run"]) {
      console.log(formatOutput({ dry_run: true, fromObjectType, fromObjectId, toObjectType, toObjectId }, flags));
      process.exit(0);
    }

    try {
      const client = new HubspotClient(resolveConfigOrExit());
      await client.createAssociation(fromObjectType, fromObjectId, toObjectType, toObjectId);
      console.log(formatOutput({ associated: true, fromObjectType, fromObjectId, toObjectType, toObjectId }, flags));
    } catch (err) {
      handleError(err);
    }
  },
});
