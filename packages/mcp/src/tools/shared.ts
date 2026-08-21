import { encode } from "@toon-format/toon";
import { HubspotClient, resolveConfig } from "@hubspot-toolkit/sdk";

export function makeClient(): HubspotClient {
  return new HubspotClient(resolveConfig());
}

export function toonText(result: unknown): { content: { type: "text"; text: string }[] } {
  return { content: [{ type: "text", text: encode(result ?? { ok: true }) }] };
}
