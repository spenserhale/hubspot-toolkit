import { buildCommand } from "@stricli/core";
import { loadConfigState, redactedConfig } from "@hubspot-toolkit/sdk";
import { handleError } from "../../handle-error.js";
import { formatOutput, outputFlags, type OutputFlags } from "../../output.js";

export const showConfigCommand = buildCommand({
  docs: {
    brief: "Show resolved config with secrets redacted",
    fullDescription:
      "Prints each setting with the source that won (env, envfile:<path>, keychain, default, or " +
      "missing) and the OS keychain status (ok, disabled, or unavailable). Credential values are " +
      "shown only as set or missing.",
  },
  parameters: { flags: { ...outputFlags } },
  async func(this: void, flags: OutputFlags) {
    try {
      console.log(formatOutput(redactedConfig(await loadConfigState()), flags));
    } catch (err) {
      handleError(err);
    }
  },
});
