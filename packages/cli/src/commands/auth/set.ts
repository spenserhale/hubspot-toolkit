import { buildCommand } from "@stricli/core";
import { bunSecretStore, loadConfigState, HubspotValidationError } from "@hubspot-toolkit/sdk";
import { handleError } from "../../handle-error.js";
import { parseResource, selectCredentialKeys, setCredentials } from "../../lib/auth.js";
import { promptHidden, readAllStdin, stdinIsInteractive } from "../../lib/prompt.js";
import {
  authOutputFlags,
  dryRunFlag,
  emit,
  keyFlag,
  resourcePositional,
  type AuthOutputFlags,
} from "./shared.js";

interface AuthSetFlags extends AuthOutputFlags {
  readonly key?: string;
  readonly stdin: boolean;
  readonly "dry-run": boolean;
}

export const authSetCommand = buildCommand({
  docs: {
    brief: "Store a credential in the OS keychain (hidden prompt, or --stdin)",
    fullDescription:
      "Saves the key under keychain service `hubspot-toolkit`, named by its env var (HUBSPOT_ACCESS_TOKEN). " +
      "On a terminal it prompts with hidden input. For scripts and agents, pipe the value with " +
      "--stdin (one key per call). The key is never accepted as an argument, so it stays out of " +
      "shell history and process listings. Env vars and .env files still take precedence over " +
      "the keychain; the output flags a stored key that one of them shadows.",
  },
  parameters: {
    positional: resourcePositional,
    flags: {
      ...keyFlag,
      stdin: {
        kind: "boolean",
        brief: "Read the key from stdin instead of prompting (non-interactive)",
        default: false,
      },
      ...dryRunFlag,
      ...authOutputFlags,
    },
  },
  async func(this: void, flags: AuthSetFlags, resourceArg: string) {
    try {
      const resource = parseResource(resourceArg);
      const keys = selectCredentialKeys(resource, flags.key);

      let readValue: (key: string) => Promise<string>;
      if (flags.stdin) {
        if (keys.length > 1) {
          throw new HubspotValidationError(
            `${resource} uses ${keys.length} keys; --stdin stores one per call`,
            { hint: `Run once per key: ... | hubspot auth set ${resource} --key ${keys[0]} --stdin` },
          );
        }
        const piped = await readAllStdin();
        readValue = async () => piped;
      } else {
        if (!stdinIsInteractive()) {
          throw new HubspotValidationError("No terminal to prompt on", {
            hint: `Pipe the key instead: ... | hubspot auth set ${resource} --stdin`,
          });
        }
        readValue = (key) => promptHidden(`${key}: `);
      }

      const config = await loadConfigState({ secretStore: null });
      const result = await setCredentials({
        resource,
        keys,
        readValue,
        store: bunSecretStore(),
        config,
        dryRun: flags["dry-run"],
      });
      emit(result, flags, {
        text: () =>
          result.credentials
            .map(
              (row) =>
                `${row.action} ${row.key} in ${result.store}` +
                (row.shadowed_by ? ` (warning: ${row.shadowed_by} still overrides it)` : ""),
            )
            .join("\n"),
      });
    } catch (err) {
      handleError(err);
    }
  },
});
