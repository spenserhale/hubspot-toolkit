import { buildCommand } from "@stricli/core";
import { bunSecretStore, HubspotValidationError } from "@hubspot-toolkit/sdk";
import { handleError } from "../../handle-error.js";
import { deleteCredentials, parseResource, selectCredentialKeys } from "../../lib/auth.js";
import {
  authOutputFlags,
  dryRunFlag,
  emit,
  keyFlag,
  resourcePositional,
  type AuthOutputFlags,
} from "./shared.js";

interface AuthDeleteFlags extends AuthOutputFlags {
  readonly key?: string;
  readonly yes: boolean;
  readonly "dry-run": boolean;
}

export const authDeleteCommand = buildCommand({
  docs: {
    brief: "Remove a credential from the OS keychain (requires --yes)",
    fullDescription:
      "Deletes the resource's keychain entries, or only --key. Keys set through env or .env " +
      "files are not touched.",
  },
  parameters: {
    positional: resourcePositional,
    flags: {
      ...keyFlag,
      yes: { kind: "boolean", brief: "Confirm the deletion", default: false },
      ...dryRunFlag,
      ...authOutputFlags,
    },
  },
  async func(this: void, flags: AuthDeleteFlags, resourceArg: string) {
    try {
      const resource = parseResource(resourceArg);
      const keys = selectCredentialKeys(resource, flags.key);
      if (!flags.yes && !flags["dry-run"]) {
        throw new HubspotValidationError("Deleting a keychain entry needs --yes", {
          hint: `Preview with --dry-run, then run: hubspot auth delete ${resource} --yes`,
        });
      }
      const result = await deleteCredentials({
        resource,
        keys,
        store: bunSecretStore(),
        dryRun: flags["dry-run"],
      });
      emit(result, flags, {
        text: () => result.credentials.map((row) => `${row.action} ${row.key}`).join("\n"),
      });
    } catch (err) {
      handleError(err);
    }
  },
});
