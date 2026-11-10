import {
  HubspotAuthError,
  HubspotNotFoundError,
  HubspotValidationError,
  HubspotRateLimitError,
  HubspotConfigError,
  HubspotError,
  loadConfig,
} from "@hubspot-toolkit/sdk";
import type { ResolvedConfig } from "@hubspot-toolkit/sdk";

/** Resolve config (env > .env > OS keychain) or exit 3 with a hint. */
export async function loadConfigOrExit(): Promise<ResolvedConfig> {
  try {
    return await loadConfig();
  } catch (err) {
    handleError(err);
  }
}

function printHint(hint: string | undefined): void {
  if (hint) console.error(`hint: ${hint}`);
}

export function handleError(err: unknown): never {
  if (err instanceof HubspotAuthError) {
    console.error(`Auth error: ${err.message}`);
    process.exit(5);
  }
  if (err instanceof HubspotNotFoundError) {
    console.error(`Not found: ${err.message}`);
    process.exit(4);
  }
  if (err instanceof HubspotRateLimitError) {
    console.error(`Rate limit exceeded: ${err.message}`);
    process.exit(6);
  }
  if (err instanceof HubspotValidationError) {
    console.error(`Validation error: ${err.message}`);
    printHint(err.hint);
    process.exit(2);
  }
  if (err instanceof HubspotConfigError) {
    console.error(`Config error: ${err.message}${err.got ? ` (${err.got})` : ""}`);
    printHint(err.hint);
    process.exit(3);
  }
  if (err instanceof HubspotError) {
    console.error(`API error: ${err.message}`);
    process.exit(1);
  }
  if (err instanceof Error && err.name === "ZodError") {
    console.error(`Validation error: ${err.message}`);
    process.exit(2);
  }
  console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
