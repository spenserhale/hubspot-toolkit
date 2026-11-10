import { buildCommand } from "@stricli/core";
import { HubspotClient } from "@hubspot-toolkit/sdk";
import { loadConfigOrExit, handleError } from "../../handle-error.js";
import { outputFlags, formatOutput } from "../../output.js";
import type { OutputFlags } from "../../output.js";

export const getPropertyCommand = buildCommand({
  docs: { brief: "Get a single property definition" },
  parameters: {
    flags: { ...outputFlags },
    positional: {
      kind: "tuple",
      parameters: [
        { brief: "Object type (e.g. contacts, companies, deals, tickets)", parse: String },
        { brief: "Property name (internal name, e.g. firstname)", parse: String },
      ],
    },
  },
  async func(this: void, flags: OutputFlags, objectType: string, propertyName: string) {
    try {
      const client = new HubspotClient(await loadConfigOrExit());
      const result = await client.getProperty(objectType, propertyName);
      console.log(formatOutput(result, flags));
    } catch (err) {
      handleError(err);
    }
  },
});
