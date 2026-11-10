import { buildCommand } from "@stricli/core";
import { bunSecretStore, loadConfigState } from "@hubspot-toolkit/sdk";
import { handleError } from "../../handle-error.js";
import { csvCell, listCredentials } from "../../lib/auth.js";
import { authOutputFlags, emit, type AuthOutputFlags } from "./shared.js";

export const authListCommand = buildCommand({
  docs: {
    brief: "Show which credentials are in the keychain and which source is active",
    fullDescription:
      "Lists every credential key with its keychain state (set, missing, or unknown when the " +
      "keychain cannot be read) and the source that currently wins (override, env, " +
      "envfile:<path>, keychain, or missing). Values are never printed.",
  },
  parameters: { flags: { ...authOutputFlags } },
  async func(this: void, flags: AuthOutputFlags) {
    try {
      const store = bunSecretStore();
      const config = await loadConfigState({ secretStore: store });
      const result = await listCredentials(store, config);
      emit(result, flags, {
        text: () =>
          [
            `store: ${result.store} (${result.keychain_status})`,
            ...result.credentials.map(
              (row) => `${row.key.padEnd(16)} keychain=${row.keychain.padEnd(7)} active=${row.active_source}`,
            ),
          ].join("\n"),
        csv: () =>
          [
            "resource,key,keychain,active_source",
            ...result.credentials.map((row) =>
              [row.resource, row.key, row.keychain, row.active_source].map(csvCell).join(","),
            ),
          ].join("\n"),
      });
    } catch (err) {
      handleError(err);
    }
  },
});
