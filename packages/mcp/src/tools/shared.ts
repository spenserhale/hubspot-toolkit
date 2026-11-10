import { encode } from "@toon-format/toon";
import { UserError } from "fastmcp";
import { HubspotClient, HubspotError, loadConfig } from "@hubspot-toolkit/sdk";

/**
 * Resolve config on every call (env > .env > OS keychain), so a token stored
 * or rotated with `hubspot auth set` applies without restarting the MCP host.
 */
export async function makeClient(): Promise<HubspotClient> {
  try {
    return new HubspotClient(await loadConfig());
  } catch (err) {
    if (err instanceof HubspotError) {
      const hint = (err as { hint?: string }).hint;
      throw new UserError(hint ? `${err.message}. ${hint}` : err.message);
    }
    throw err;
  }
}

export function toonText(result: unknown): { content: { type: "text"; text: string }[] } {
  return { content: [{ type: "text", text: encode(result ?? { ok: true }) }] };
}

export type OutputFormat = "toon" | "json";

export function render(data: unknown, format: OutputFormat = "toon"): string {
  return format === "json" ? JSON.stringify(data, null, 2) : encode(data);
}
