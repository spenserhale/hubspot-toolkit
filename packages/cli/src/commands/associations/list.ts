import { buildCommand } from "@stricli/core";
import { HubspotClient } from "@hubspot-toolkit/sdk";
import { loadConfigOrExit, handleError } from "../../handle-error.js";
import { outputFlags, formatOutput } from "../../output.js";
import type { OutputFlags } from "../../output.js";

export const listAssociationsCommand = buildCommand({
  docs: { brief: "List an object's associations to another object type" },
  parameters: {
    flags: { ...outputFlags },
    positional: {
      kind: "tuple",
      parameters: [
        { brief: "From object type (e.g. contacts)", parse: String },
        { brief: "From object ID", parse: String },
        { brief: "To object type (e.g. companies)", parse: String },
      ],
    },
  },
  async func(this: void, flags: OutputFlags, fromObjectType: string, fromObjectId: string, toObjectType: string) {
    try {
      const client = new HubspotClient(await loadConfigOrExit());
      const result = await client.listAssociations(fromObjectType, fromObjectId, toObjectType);
      console.log(formatOutput(result, flags));
    } catch (err) {
      handleError(err);
    }
  },
});
