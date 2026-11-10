import { buildCommand } from "@stricli/core";
import { bunSecretStore, loadConfigState } from "@hubspot-toolkit/sdk";
import { handleError } from "../../handle-error.js";
import { migrateCredentials } from "../../lib/auth.js";
import { authOutputFlags, dryRunFlag, emit, type AuthOutputFlags } from "./shared.js";

interface AuthMigrateFlags extends AuthOutputFlags {
  readonly overwrite: boolean;
  readonly "dry-run": boolean;
}

export const authMigrateCommand = buildCommand({
  docs: {
    brief: "Copy plaintext keys from .env files into the keychain",
    fullDescription:
      "Stores every key whose active source is a .env file in the OS keychain, skipping keys " +
      "already there unless --overwrite. Process-environment keys (op run, CI) are left alone. " +
      "Files are not edited: remove the lines in the listed clean_up files yourself, because a " +
      ".env value keeps overriding the keychain until you do.",
  },
  parameters: {
    flags: {
      overwrite: {
        kind: "boolean",
        brief: "Replace keys that already exist in the keychain",
        default: false,
      },
      ...dryRunFlag,
      ...authOutputFlags,
    },
  },
  async func(this: void, flags: AuthMigrateFlags) {
    try {
      const store = bunSecretStore();
      const config = await loadConfigState({ secretStore: store });
      const result = await migrateCredentials({
        store,
        config,
        dryRun: flags["dry-run"],
        overwrite: flags.overwrite,
      });
      emit(result, flags, {
        text: () =>
          [
            ...(result.credentials.length === 0
              ? ["nothing to migrate: no keys come from .env files"]
              : result.credentials.map((row) => `${row.action} ${row.key} (from ${row.from})`)),
            ...(result.clean_up.length > 0
              ? [
                  "",
                  "remove the migrated keys from these files (a .env value keeps overriding the keychain):",
                  ...result.clean_up.map((file) => `  ${file}`),
                ]
              : []),
          ].join("\n"),
      });
    } catch (err) {
      handleError(err);
    }
  },
});
