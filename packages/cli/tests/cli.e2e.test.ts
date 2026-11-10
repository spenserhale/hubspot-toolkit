import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const bin = join(import.meta.dirname, "..", "src", "bin.ts");
const dirs: string[] = [];

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "hubspot-cli-"));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

// HUBSPOT_KEYCHAIN=0 keeps every spawned CLI away from the real OS keychain.
function cleanEnv(cwd: string, extra: Record<string, string> = {}): Record<string, string> {
  return { PATH: process.env["PATH"] ?? "", HOME: cwd, HUBSPOT_KEYCHAIN: "0", ...extra };
}

async function runCli(
  args: string[],
  cwd: string,
  stdinText?: string,
  extraEnv: Record<string, string> = {},
): Promise<{ code: number; stdout: string; stderr: string }> {
  const proc = Bun.spawn({
    cmd: ["bun", "run", bin, ...args],
    cwd,
    env: cleanEnv(cwd, extraEnv),
    stdin: stdinText === undefined ? "ignore" : new Blob([stdinText]),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  return { code: await proc.exited, stdout, stderr };
}

describe("hubspot auth (e2e)", () => {
  it("refuses auth set without a terminal unless --stdin is passed", async () => {
    const result = await runCli(["auth", "set", "hubspot"], tempDir());
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("--stdin");
  });

  it("previews auth set --stdin --dry-run without writing or echoing the key", async () => {
    const result = await runCli(
      ["auth", "set", "hubspot", "--stdin", "--dry-run", "--json"],
      tempDir(),
      "dry-run-secret\n",
    );
    expect(result.code).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload.dry_run).toBe(true);
    expect(payload.credentials[0].action).toBe("would_store");
    expect(result.stdout + result.stderr).not.toContain("dry-run-secret");
  });

  it("reports shadowed_by when env still overrides the stored key", async () => {
    const result = await runCli(
      ["auth", "set", "hubspot", "--stdin", "--dry-run", "--json"],
      tempDir(),
      "x\n",
      { HUBSPOT_ACCESS_TOKEN: "from-env" },
    );
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout).credentials[0].shadowed_by).toBe("env");
  });

  it("rejects empty --stdin input", async () => {
    const result = await runCli(["auth", "set", "hubspot", "--stdin", "--dry-run"], tempDir(), "\n");
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("must not be empty");
  });

  it("requires --yes for auth delete", async () => {
    const result = await runCli(["auth", "delete", "hubspot"], tempDir());
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("--yes");
  });

  it("rejects an unknown resource for auth commands", async () => {
    const result = await runCli(["auth", "delete", "bank", "--yes"], tempDir());
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("Unknown resource");
  });

  it("rejects --key that the resource does not use", async () => {
    const result = await runCli(["auth", "set", "hubspot", "--key", "HUBSPOT_BASE_URL", "--stdin"], tempDir(), "x");
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("not a credential");
  });

  it("exits 3 with an auth set hint when no key is configured", async () => {
    const result = await runCli(["objects", "list", "contacts"], tempDir());
    expect(result.code).toBe(3);
    expect(result.stderr).toContain("hubspot auth set hubspot");
  });

  it("config show reports sources and keychain status without values", async () => {
    const result = await runCli(["config", "show", "--json"], tempDir(), undefined, {
      HUBSPOT_ACCESS_TOKEN: "visible-secret",
    });
    expect(result.code).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload.keychain.status).toBe("disabled");
    expect(payload.credentials.HUBSPOT_ACCESS_TOKEN).toBe("set");
    expect(payload.credential_sources.HUBSPOT_ACCESS_TOKEN).toBe("env");
    expect(result.stdout).not.toContain("visible-secret");
  });
});
