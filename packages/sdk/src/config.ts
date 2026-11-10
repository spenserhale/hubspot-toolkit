import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { HubspotConfigError } from "./errors.js";
import {
  bunSecretStore,
  CREDENTIAL_KEYS,
  readKeychainValues,
  type KeychainStatus,
  type SecretStore,
} from "./secrets.js";
import type { HubspotConfig } from "./types.js";

export type Env = Record<string, string | undefined>;

export const DEFAULT_BASE_URL = "https://api.hubapi.com";

export interface KeychainState {
  status: KeychainStatus;
  error?: string;
}

export interface ResolveConfigOptions {
  /** Directory to start the `.env` search from. Defaults to process.cwd(). */
  cwd?: string;
  /** Process environment. Defaults to process.env. */
  env?: Env;
  /** Credentials already read from the OS keychain; see loadConfig(). */
  keychainValues?: Record<string, string>;
  /** Keychain lookup status to report; defaults to disabled. */
  keychain?: KeychainState;
}

export interface LoadConfigOptions extends Omit<ResolveConfigOptions, "keychainValues" | "keychain"> {
  /** Explicit values that beat every other source. */
  overrides?: Partial<HubspotConfig>;
  /** Store to read keys from. Defaults to the OS keychain; pass null to skip it. */
  secretStore?: SecretStore | null;
}

/** Everything the resolver found, without requiring an access token. */
export interface ConfigState {
  accessToken?: string;
  baseUrl: string;
  /** Winning source per setting: override, env, envfile:<path>, default, or missing. */
  sources: Record<string, string>;
  /** Winning source per credential key: override, env, envfile:<path>, keychain, or missing. */
  credentialSources: Record<string, string>;
  /** Whether the OS keychain was consulted for credentials. */
  keychain: KeychainState;
  envFiles: string[];
  cwd: string;
}

/** A config that is ready to hand to HubspotClient. */
export interface ResolvedConfig extends ConfigState {
  accessToken: string;
}

interface EnvFileData {
  files: string[];
  values: Env;
  sources: Record<string, string>;
}

interface Picked {
  value: string;
  source: string;
}

/**
 * Resolve settings without requiring an access token. Precedence for each value:
 * override > process env > nearest `.env` > keychain (credentials only) > default.
 */
export function resolveConfigState(
  overrides: Partial<HubspotConfig> = {},
  options: ResolveConfigOptions = {},
): ConfigState {
  const cwd = resolve(options.cwd ?? process.cwd());
  const env = options.env ?? process.env;
  const envFile = readEnvFiles(cwd);
  const keychainValues = options.keychainValues ?? {};
  const sources: Record<string, string> = {};
  const credentialSources: Record<string, string> = {};

  const pickEnv = (name: string): Picked | null => {
    const fromProcess = env[name];
    const fromFile = envFile.values[name];
    const fileSource = `envfile:${envFile.sources[name] ?? "unknown"}`;
    if (fromProcess !== undefined && fromProcess !== "") {
      // Bun loads ./.env into process.env on start; report those values as the file they came from.
      return { value: fromProcess, source: fromProcess === fromFile ? fileSource : "env" };
    }
    if (fromFile !== undefined && fromFile !== "") return { value: fromFile, source: fileSource };
    return null;
  };

  const pick = (
    key: string,
    name: string,
    override: string | undefined,
    target: Record<string, string>,
    keychainValue?: string,
  ): string | undefined => {
    if (override !== undefined && override !== "") {
      target[key] = "override";
      return override;
    }
    const fromEnv = pickEnv(name);
    if (fromEnv) {
      target[key] = fromEnv.source;
      return fromEnv.value;
    }
    if (keychainValue) {
      target[key] = "keychain";
      return keychainValue;
    }
    return undefined;
  };

  const accessToken = pick(
    "HUBSPOT_ACCESS_TOKEN",
    "HUBSPOT_ACCESS_TOKEN",
    overrides.accessToken,
    credentialSources,
    keychainValues["HUBSPOT_ACCESS_TOKEN"],
  );
  if (!accessToken) credentialSources["HUBSPOT_ACCESS_TOKEN"] = "missing";

  let baseUrl = pick("baseUrl", "HUBSPOT_BASE_URL", overrides.baseUrl, sources);
  if (!baseUrl) {
    baseUrl = DEFAULT_BASE_URL;
    sources["baseUrl"] = "default";
  }

  return {
    accessToken,
    baseUrl,
    sources,
    credentialSources,
    keychain: options.keychain ?? { status: "disabled" },
    envFiles: envFile.files,
    cwd,
  };
}

/**
 * Synchronous resolver: overrides, env and `.env`, plus any keychain values
 * passed in. Throws HubspotConfigError when no access token is found. Use loadConfig()
 * to include the OS keychain.
 */
export function resolveConfig(
  overrides: Partial<HubspotConfig> = {},
  options: ResolveConfigOptions = {},
): ResolvedConfig {
  return requireAccessToken(resolveConfigState(overrides, options));
}

/**
 * resolveConfigState() plus the OS keychain. Only credentials that overrides,
 * the process environment and `.env` files did not supply are looked up, so an
 * explicit key never triggers a keychain prompt. Set HUBSPOT_KEYCHAIN=0 to skip
 * the lookup entirely.
 */
export async function loadConfigState(options: LoadConfigOptions = {}): Promise<ConfigState> {
  const { secretStore, overrides = {}, ...resolveOptions } = options;
  const cwd = resolve(resolveOptions.cwd ?? process.cwd());
  const env = resolveOptions.env ?? process.env;
  const envFile = readEnvFiles(cwd);
  const keychainSwitch = env["HUBSPOT_KEYCHAIN"] ?? envFile.values["HUBSPOT_KEYCHAIN"];
  const disabled =
    secretStore === null ||
    ["0", "false", "no", "off"].includes((keychainSwitch ?? "").trim().toLowerCase());
  if (disabled) {
    return resolveConfigState(overrides, { ...resolveOptions, keychain: { status: "disabled" } });
  }

  const supplied: Record<string, string | undefined> = { HUBSPOT_ACCESS_TOKEN: overrides.accessToken };
  const missing = CREDENTIAL_KEYS.filter(
    (name) => !supplied[name] && !env[name] && !envFile.values[name],
  );
  if (missing.length === 0) {
    return resolveConfigState(overrides, { ...resolveOptions, keychain: { status: "ok" } });
  }
  const result = await readKeychainValues(secretStore ?? bunSecretStore(), missing);
  return resolveConfigState(overrides, {
    ...resolveOptions,
    keychainValues: result.values,
    keychain: result.error ? { status: result.status, error: result.error } : { status: result.status },
  });
}

/** loadConfigState() that throws HubspotConfigError when no access token is found. */
export async function loadConfig(options: LoadConfigOptions = {}): Promise<ResolvedConfig> {
  return requireAccessToken(await loadConfigState(options));
}

function requireAccessToken(state: ConfigState): ResolvedConfig {
  if (state.accessToken) return { ...state, accessToken: state.accessToken };
  const keychainNote =
    state.keychain.status === "unavailable"
      ? ` The OS keychain could not be read (${state.keychain.error ?? "unknown error"}).`
      : "";
  throw new HubspotConfigError("HUBSPOT_ACCESS_TOKEN is required", {
    hint:
      "Store it in the OS keychain with `hubspot auth set hubspot`, or set HUBSPOT_ACCESS_TOKEN in the " +
      `environment or a .env file.${keychainNote}`,
  });
}

function readEnvFiles(cwd: string): EnvFileData {
  const files: string[] = [];
  let current = cwd;
  while (true) {
    const candidate = join(current, ".env");
    if (existsSync(candidate)) files.push(candidate);
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  // Nearest .env wins, so apply parent files first.
  files.reverse();

  const values: Env = {};
  const sources: Record<string, string> = {};
  for (const file of files) {
    for (const [key, value] of Object.entries(parseEnvFile(file))) {
      values[key] = value;
      sources[key] = file;
    }
  }
  return { files, values, sources };
}

function parseEnvFile(path: string): Env {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return {};
  }
  const values: Env = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const unexported = line.startsWith("export ") ? line.slice("export ".length).trim() : line;
    const equals = unexported.indexOf("=");
    if (equals <= 0) continue;
    const key = unexported.slice(0, equals).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = unexported.slice(equals + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      const comment = value.indexOf(" #");
      if (comment >= 0) value = value.slice(0, comment).trim();
    }
    values[key] = value.replace(/\\n/g, "\n");
  }
  return values;
}

export interface RedactedConfig {
  schema_version: "1";
  cwd: string;
  env_files: string[];
  values: { baseUrl: string };
  sources: Record<string, string>;
  credentials: Record<string, "set" | "missing">;
  credential_sources: Record<string, string>;
  keychain: KeychainState;
}

/** Config with every secret replaced by set/missing; safe to print. */
export function redactedConfig(state: ConfigState): RedactedConfig {
  const values: Record<string, string | undefined> = { HUBSPOT_ACCESS_TOKEN: state.accessToken };
  return {
    schema_version: "1",
    cwd: state.cwd,
    env_files: state.envFiles,
    values: { baseUrl: state.baseUrl },
    sources: state.sources,
    credentials: Object.fromEntries(
      CREDENTIAL_KEYS.map((key) => [key, values[key] ? "set" : "missing"] as const),
    ),
    credential_sources: state.credentialSources,
    keychain: state.keychain,
  };
}

/** The credential value currently in effect for a key; used by `auth migrate`. */
export function credentialValue(state: ConfigState, key: string): string | undefined {
  return key === "HUBSPOT_ACCESS_TOKEN" ? state.accessToken : undefined;
}
