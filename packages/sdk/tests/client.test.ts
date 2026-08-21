import { describe, expect, it } from "bun:test";
import { HubspotClient } from "../src/client.js";

describe("HubspotClient", () => {
  it("should require an access token", () => {
    expect(() => new HubspotClient({ accessToken: "" })).toThrow();
  });

  it("should accept a valid config", () => {
    const client = new HubspotClient({
      accessToken: "test-token",
      baseUrl: "https://api.hubapi.com",
    });
    expect(client).toBeDefined();
  });
});
