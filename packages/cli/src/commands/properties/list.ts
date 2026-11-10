import { buildCommand } from "@stricli/core";
import { HubspotClient } from "@hubspot-toolkit/sdk";
import { loadConfigOrExit, handleError } from "../../handle-error.js";
import { outputFlags, formatOutput } from "../../output.js";
import type { OutputFlags } from "../../output.js";

export const listPropertiesCommand = buildCommand({
  docs: { brief: "List all property definitions for an object type" },
  parameters: {
    flags: { ...outputFlags },
    positional: {
      kind: "tuple",
      parameters: [
        { brief: "Object type (e.g. contacts, companies, deals, tickets)", parse: String },
      ],
    },
  },
  async func(this: void, flags: OutputFlags, objectType: string) {
    try {
      const client = new HubspotClient(await loadConfigOrExit());
      const result = await client.listProperties(objectType);
      console.log(formatOutput(result, flags));
    } catch (err) {
      handleError(err);
    }
  },
});
