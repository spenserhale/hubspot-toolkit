import { buildCommand } from "@stricli/core";

const CATALOG = {
  name: "hubspot",
  version: "0.2.0",
  description: "Agent-native CLI for HubSpot CRM objects (generic engine — contacts, companies, deals, tickets, and custom objects)",
  env: ["HUBSPOT_ACCESS_TOKEN", "HUBSPOT_BASE_URL?", "HUBSPOT_KEYCHAIN?"],
  auth: "HubSpot private app access token (Settings -> Integrations -> Private Apps), sent as a Bearer token. Resolved from: process env > nearest .env > OS keychain (service hubspot-toolkit, entry HUBSPOT_ACCESS_TOKEN). Store it with `hubspot auth set hubspot` (hidden prompt) or `... | hubspot auth set hubspot --stdin`; never pass it as an argument. HUBSPOT_KEYCHAIN=0 skips the keychain.",
  exitCodes: { network: 1, validation: 2, config: 3, notFound: 4, auth: 5, rateLimit: 6, dryRun: 0 },
  outputFormats: { default: "toon", flags: ["--toon", "--json", "--csv (list commands only)"] },
  objectTypes: "Any HubSpot object type slug works: contacts, companies, deals, tickets, or a custom object's fully-qualified name / typeId.",
  groups: {
    objects: [
      "list", "get", "create", "update", "delete", "search",
      "batch-create", "batch-read", "batch-update", "batch-delete",
    ],
    properties: ["list", "get"],
    associations: ["list", "create", "delete"],
    auth: ["set", "list", "delete", "migrate"],
    config: ["show"],
  },
  topLevel: ["agent-context", "upgrade"],
  notes: [
    "auth set reads the token from a hidden TTY prompt or --stdin only; without a TTY and without --stdin it exits 2. auth delete requires --yes. auth migrate copies .env tokens into the keychain but never edits files.",
    "auth list and config show never print credential values; they report set/missing and the winning source (env, envfile:<path>, keychain, missing).",
    "delete/batch-delete archive (soft-delete) the object — HubSpot's DELETE endpoint does not permanently purge records.",
    "create/update/delete/batch-* mutation commands support --dry-run to validate and preview the payload without calling the API.",
    "associations create/delete use the default association type between the two object types; use the HubSpot UI for custom association type IDs.",
    "`hubspot upgrade` self-updates the standalone binary install (see install.sh); it's a no-op error when running via `bun run`/npm.",
  ],
} as const;

export const agentContextCommand = buildCommand({
  docs: { brief: "Print machine-readable command catalog (JSON)" },
  parameters: { flags: {} },
  async func(this: void) {
    console.log(JSON.stringify(CATALOG, null, 2));
  },
});
