import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadConfig,
  loadConfigState,
  redactedConfig,
  resolveConfig,
  resolveConfigState,
} from "../src/config.js";
import { HubspotConfigError } from "../src/errors.js";
import { readKeychainValues, type SecretStore } from "../src/secrets.js";

const dirs: string[] = [];

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "hubspot-secrets-"));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function memoryStore(initial: Record<string, string> = {}): SecretStore & { requested: string[] } {
  const values = new Map(Object.entries(initial));
  const requested: string[] = [];
  return {
    description: "memory",
    requested,
    async get(name) {
      requested.push(name);
      return values.get(name) ?? null;
    },
    async set(name, value) {
      values.set(name, value);
    },
    async delete(name) {
      return values.delete(name);
    },
  };
}

function failingStore(): SecretStore {
  const fail = async (): Promise<never> => {
    throw new Error("no secret service");
  };
  return { description: "failing", get: fail, set: fail, delete: fail };
}

describe("keychain credential resolution", () => {
  it("resolves the key from the keychain when env and .env are empty", async () => {
    const config = await loadConfig({
      cwd: tempDir(),
      env: {},
      secretStore: memoryStore({ HUBSPOT_ACCESS_TOKEN: "from-keychain" }),
    });
    expect(config.accessToken).toBe("from-keychain");
    expect(config.credentialSources["HUBSPOT_ACCESS_TOKEN"]).toBe("keychain");
    expect(config.keychain.status).toBe("ok");
  });

  it("ranks override > env > .env > keychain", () => {
    const cwd = tempDir();
    writeFileSync(join(cwd, ".env"), "HUBSPOT_ACCESS_TOKEN=from-env-file\n");
    const keychainValues = { HUBSPOT_ACCESS_TOKEN: "from-keychain" };

    const fromEnv = resolveConfig({}, { cwd, env: { HUBSPOT_ACCESS_TOKEN: "from-process" }, keychainValues });
    expect(fromEnv.accessToken).toBe("from-process");
    expect(fromEnv.credentialSources["HUBSPOT_ACCESS_TOKEN"]).toBe("env");

    const fromFile = resolveConfig({}, { cwd, env: {}, keychainValues });
    expect(fromFile.accessToken).toBe("from-env-file");
    expect(fromFile.credentialSources["HUBSPOT_ACCESS_TOKEN"]).toBe(`envfile:${join(cwd, ".env")}`);

    const fromKeychain = resolveConfig({}, { cwd: tempDir(), env: {}, keychainValues });
    expect(fromKeychain.credentialSources["HUBSPOT_ACCESS_TOKEN"]).toBe("keychain");

    const fromOverride = resolveConfig({ accessToken: "explicit" }, { cwd, env: { HUBSPOT_ACCESS_TOKEN: "p" } });
    expect(fromOverride.accessToken).toBe("explicit");
    expect(fromOverride.credentialSources["HUBSPOT_ACCESS_TOKEN"]).toBe("override");
  });

  it("uses the nearest .env and reports a Bun-loaded value as its file", () => {
    const parent = tempDir();
    const child = join(parent, "child");
    mkdirSync(child);
    writeFileSync(join(parent, ".env"), "HUBSPOT_ACCESS_TOKEN=parent\nHUBSPOT_BASE_URL=b1\n");
    writeFileSync(join(child, ".env"), "HUBSPOT_ACCESS_TOKEN=child\n");
    const state = resolveConfigState({}, { cwd: child, env: { HUBSPOT_ACCESS_TOKEN: "child" } });
    expect(state.accessToken).toBe("child");
    expect(state.credentialSources["HUBSPOT_ACCESS_TOKEN"]).toBe(`envfile:${join(child, ".env")}`);
    expect(state.baseUrl).toBe("b1");
  });

  it("only asks the keychain for keys env and .env did not supply", async () => {
    const store = memoryStore({ HUBSPOT_ACCESS_TOKEN: "from-keychain" });
    const fromEnv = await loadConfig({ cwd: tempDir(), env: { HUBSPOT_ACCESS_TOKEN: "x" }, secretStore: store });
    expect(fromEnv.accessToken).toBe("x");

    const cwd = tempDir();
    writeFileSync(join(cwd, ".env"), "HUBSPOT_ACCESS_TOKEN=from-env-file\n");
    await loadConfig({ cwd, env: {}, secretStore: store });
    await loadConfig({ cwd: tempDir(), env: {}, overrides: { accessToken: "o" }, secretStore: store });
    expect(store.requested).toEqual([]);

    await loadConfig({ cwd: tempDir(), env: {}, secretStore: store });
    expect(store.requested).toEqual(["HUBSPOT_ACCESS_TOKEN"]);
  });

  it("skips the keychain when HUBSPOT_KEYCHAIN=0 in env or .env", async () => {
    const store = memoryStore({ HUBSPOT_ACCESS_TOKEN: "from-keychain" });
    const state = await loadConfigState({ cwd: tempDir(), env: { HUBSPOT_KEYCHAIN: "0" }, secretStore: store });
    expect(state.accessToken).toBeUndefined();
    expect(state.keychain.status).toBe("disabled");

    const cwd = tempDir();
    writeFileSync(join(cwd, ".env"), "HUBSPOT_KEYCHAIN=off\n");
    const fromFile = await loadConfigState({ cwd, env: {}, secretStore: store });
    expect(fromFile.keychain.status).toBe("disabled");
    expect(store.requested).toHaveLength(0);
  });

  it("skips the keychain when secretStore is null", async () => {
    const state = await loadConfigState({ cwd: tempDir(), env: {}, secretStore: null });
    expect(state.keychain.status).toBe("disabled");
    expect(state.credentialSources["HUBSPOT_ACCESS_TOKEN"]).toBe("missing");
  });

  it("reports an unavailable keychain without failing, and env keys still work", async () => {
    const config = await loadConfig({
      cwd: tempDir(),
      env: {},
      secretStore: failingStore(),
    }).catch((err: unknown) => err);
    expect(config).toBeInstanceOf(HubspotConfigError);
    expect((config as HubspotConfigError).hint).toContain("no secret service");

    const state = await loadConfigState({ cwd: tempDir(), env: {}, secretStore: failingStore() });
    expect(state.keychain).toEqual({ status: "unavailable", error: "no secret service" });

    const withEnv = await loadConfig({
      cwd: tempDir(),
      env: { HUBSPOT_ACCESS_TOKEN: "from-process" },
      secretStore: failingStore(),
    });
    expect(withEnv.accessToken).toBe("from-process");
  });

  it("throws a config error with a hint when no key is found", () => {
    expect(() => resolveConfig({}, { cwd: tempDir(), env: {} })).toThrow(HubspotConfigError);
  });

  it("redacts secrets and reports keychain status", async () => {
    const state = await loadConfigState({
      cwd: tempDir(),
      env: {},
      secretStore: memoryStore({ HUBSPOT_ACCESS_TOKEN: "super-secret" }),
    });
    const redacted = redactedConfig(state);
    expect(redacted.credentials).toEqual({ HUBSPOT_ACCESS_TOKEN: "set" });
    expect(redacted.keychain.status).toBe("ok");
    expect(JSON.stringify(redacted)).not.toContain("super-secret");
  });

  it("reads keys in parallel and drops empty values", async () => {
    const result = await readKeychainValues(memoryStore({ A: "a", B: "" }), ["A", "B"]);
    expect(result).toEqual({ status: "ok", values: { A: "a" } });
  });
});
