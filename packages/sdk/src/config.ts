import type { HubspotConfig } from "./types.js";

/**
 * Resolve configuration from environment variables.
 * Useful for both CLI and MCP contexts.
 */
export function resolveConfig(
  overrides: Partial<HubspotConfig> = {}
): HubspotConfig {
  const accessToken =
    overrides.accessToken ?? process.env["HUBSPOT_ACCESS_TOKEN"] ?? "";
  if (!accessToken) {
    throw new Error("HUBSPOT_ACCESS_TOKEN is required");
  }

  const baseUrl =
    overrides.baseUrl ??
    process.env["HUBSPOT_BASE_URL"] ??
    "https://api.hubapi.com";

  return { accessToken, baseUrl };
}
