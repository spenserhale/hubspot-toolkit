import {
  HubspotAuthError,
  HubspotNotFoundError,
  HubspotValidationError,
  HubspotRateLimitError,
  HubspotError,
  resolveConfig,
} from "@hubspot-toolkit/sdk";
import type { HubspotConfig } from "@hubspot-toolkit/sdk";

export function resolveConfigOrExit(): HubspotConfig {
  try {
    return resolveConfig();
  } catch (err) {
    console.error(
      `Config error: ${err instanceof Error ? err.message : String(err)}. Set HUBSPOT_ACCESS_TOKEN in your .env file.`
    );
    process.exit(3);
  }
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
    process.exit(2);
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
