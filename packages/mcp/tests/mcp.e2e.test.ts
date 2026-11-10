import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const entry = join(import.meta.dirname, "..", "src", "index.ts");
const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

interface RpcResponse {
  id?: number;
  result?: { tools?: Array<{ name: string }>; content?: Array<{ text: string }>; isError?: boolean };
  error?: unknown;
}

/** Spawn the stdio server, send JSON-RPC requests in order, and collect the responses by id. */
async function rpc(
  requests: Array<{ method: string; params?: unknown }>,
  env: Record<string, string>,
): Promise<Map<number, RpcResponse>> {
  const cwd = mkdtempSync(join(tmpdir(), "hubspot-mcp-"));
  dirs.push(cwd);
  const proc = Bun.spawn({
    cmd: ["bun", "run", entry],
    cwd,
    // HUBSPOT_KEYCHAIN=0 keeps the spawned server away from the real OS keychain.
    env: { PATH: process.env["PATH"] ?? "", HOME: cwd, HUBSPOT_KEYCHAIN: "0", ...env },
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });
  const send = (message: object) => proc.stdin.write(`${JSON.stringify(message)}\n`);
  send({
    jsonrpc: "2.0",
    id: 0,
    method: "initialize",
    params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "test", version: "0" } },
  });

  const responses = new Map<number, RpcResponse>();
  const reader = proc.stdout.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let next = 0;
  const deadline = Date.now() + 15_000;
  while (responses.size <= requests.length && Date.now() < deadline) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline: number;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      const message = JSON.parse(line) as RpcResponse;
      if (typeof message.id !== "number") continue;
      responses.set(message.id, message);
      if (message.id === 0) send({ jsonrpc: "2.0", method: "notifications/initialized" });
      if (next < requests.length && responses.has(next)) {
        const request = requests[next]!;
        next += 1;
        send({ jsonrpc: "2.0", id: next, ...request });
      }
    }
  }
  proc.kill();
  return responses;
}

describe("hubspot MCP server (e2e)", () => {
  it("exposes read-only tools and no secret-writing tool", async () => {
    const responses = await rpc([{ method: "tools/list" }], {});
    const names = (responses.get(1)?.result?.tools ?? []).map((tool) => tool.name);
    expect(names).toContain("hubspot_config_status");
    expect(names).toContain("hubspot_list_objects");
    expect(names.some((name) => /auth|secret|keychain|set_key|delete_key/.test(name))).toBe(false);
  }, 20_000);

  it("reports the key source without returning the value", async () => {
    const responses = await rpc(
      [{ method: "tools/call", params: { name: "hubspot_config_status", arguments: { format: "json" } } }],
      { HUBSPOT_ACCESS_TOKEN: "mcp-secret" },
    );
    const text = responses.get(1)?.result?.content?.[0]?.text ?? "";
    const payload = JSON.parse(text);
    expect(payload.configured).toBe(true);
    expect(payload.credential_sources.HUBSPOT_ACCESS_TOKEN).toBe("env");
    expect(payload.keychain.status).toBe("disabled");
    expect(text).not.toContain("mcp-secret");
  }, 20_000);

  it("returns a config error with an auth set hint when no key is found", async () => {
    const responses = await rpc(
      [{ method: "tools/call", params: { name: "hubspot_list_objects", arguments: { objectType: "contacts" } } }],
      {},
    );
    const result = responses.get(1)?.result;
    expect(result?.isError).toBe(true);
    expect(result?.content?.[0]?.text).toContain("hubspot auth set hubspot");
  }, 20_000);
});
