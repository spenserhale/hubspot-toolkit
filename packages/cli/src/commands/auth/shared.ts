import { CREDENTIAL_RESOURCES } from "@hubspot-toolkit/sdk";
import { formatOutput, outputFlags, type OutputFlags } from "../../output.js";

export const resourcePositional = {
  kind: "tuple",
  parameters: [
    {
      brief: `Credential resource: ${CREDENTIAL_RESOURCES.join(", ")}`,
      parse: String,
      placeholder: "resource",
    },
  ],
} as const;

export const keyFlag = {
  key: {
    kind: "parsed",
    parse: String,
    brief: "Only this credential (e.g. HUBSPOT_ACCESS_TOKEN); default: every key the resource uses",
    optional: true,
  },
} as const;

export const dryRunFlag = {
  "dry-run": {
    kind: "boolean",
    brief: "Validate and report what would change without touching the keychain",
    default: false,
  },
} as const;

export const authOutputFlags = {
  ...outputFlags,
  text: { kind: "boolean" as const, brief: "Output as plain text lines", default: false },
};

export interface AuthOutputFlags extends OutputFlags {
  readonly text: boolean;
}

/** Print a result in the requested format. `csv` and `text` renderers override the defaults. */
export function emit(
  data: unknown,
  flags: AuthOutputFlags,
  renderers: { text: () => string; csv?: () => string },
): void {
  if (flags.text) console.log(renderers.text());
  else if (flags.csv && renderers.csv) console.log(renderers.csv());
  else console.log(formatOutput(data, flags));
}
