import { HubspotConfigError } from "./errors.js";

/** Service name every hubspot-toolkit keychain entry is stored under. */
export const KEYCHAIN_SERVICE = "hubspot-toolkit";

/**
 * A credential store keyed by env-var name (for example `HUBSPOT_ACCESS_TOKEN`).
 * The default implementation is the OS keychain via `Bun.secrets`; tests
 * inject an in-memory store.
 */
export interface SecretStore {
  readonly description: string;
  get(name: string): Promise<string | null>;
  set(name: string, value: string): Promise<void>;
  delete(name: string): Promise<boolean>;
}

/** Credential resources the `auth` commands act on, and the keychain entries each one uses. */
export const CREDENTIAL_RESOURCES = ["hubspot"] as const;
export type CredentialResource = (typeof CREDENTIAL_RESOURCES)[number];

const RESOURCE_CREDENTIAL_KEYS: Record<CredentialResource, readonly string[]> = {
  hubspot: ["HUBSPOT_ACCESS_TOKEN"],
};

/** Primary env names only; keychain entries are named exactly like these. */
export const CREDENTIAL_KEYS: readonly string[] = CREDENTIAL_RESOURCES.flatMap(
  (id) => RESOURCE_CREDENTIAL_KEYS[id],
);

export function resourceCredentialKeys(id: CredentialResource): readonly string[] {
  return RESOURCE_CREDENTIAL_KEYS[id];
}

export function resourceForCredentialKey(key: string): CredentialResource | undefined {
  return CREDENTIAL_RESOURCES.find((id) => RESOURCE_CREDENTIAL_KEYS[id].includes(key));
}

interface BunSecretsApi {
  get(options: { service: string; name: string }): Promise<string | null>;
  set(options: { service: string; name: string; value: string }): Promise<void>;
  delete(options: { service: string; name: string }): Promise<boolean>;
}

function bunSecretsApi(): BunSecretsApi | undefined {
  const bun = (globalThis as { Bun?: { secrets?: BunSecretsApi } }).Bun;
  return bun?.secrets;
}

/** The OS keychain (macOS Keychain, libsecret, Windows Credential Manager) via Bun.secrets. */
export function bunSecretStore(service: string = KEYCHAIN_SERVICE): SecretStore {
  const api = (): BunSecretsApi => {
    const secrets = bunSecretsApi();
    if (!secrets) {
      throw new HubspotConfigError("The OS keychain is not available in this runtime", {
        hint: "Run hubspot-toolkit with Bun 1.3 or newer, or set HUBSPOT_ACCESS_TOKEN through env, .env, or op run.",
      });
    }
    return secrets;
  };
  const wrap = async <T>(action: string, fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof HubspotConfigError) throw error;
      throw new HubspotConfigError(`Could not ${action} the OS keychain`, {
        got: error instanceof Error ? error.message : String(error),
        hint:
          "On macOS, unlock the login keychain and allow access when prompted. On Linux, start a " +
          "Secret Service daemon (GNOME Keyring or KWallet). Otherwise set HUBSPOT_ACCESS_TOKEN through env or op run.",
        cause: error,
      });
    }
  };
  return {
    description: `os-keychain:${service}`,
    get: (name) => wrap("read from", () => api().get({ service, name })),
    set: (name, value) => wrap("write to", () => api().set({ service, name, value })),
    delete: (name) => wrap("delete from", () => api().delete({ service, name })),
  };
}

export type KeychainStatus = "ok" | "disabled" | "unavailable";

export interface KeychainReadResult {
  status: KeychainStatus;
  values: Record<string, string>;
  error?: string;
}

/**
 * Read the given credential names in parallel. A store failure is reported
 * as `unavailable` instead of thrown, so a missing keychain never breaks a
 * command that has its key from somewhere else.
 */
export async function readKeychainValues(
  store: SecretStore,
  names: readonly string[],
): Promise<KeychainReadResult> {
  try {
    const entries = await Promise.all(
      names.map(async (name) => [name, await store.get(name)] as const),
    );
    const values: Record<string, string> = {};
    for (const [name, value] of entries) {
      if (value) values[name] = value;
    }
    return { status: "ok", values };
  } catch (error) {
    return { status: "unavailable", values: {}, error: errorDetail(error) };
  }
}

/** Short, value-free description of a store error. */
export function errorDetail(error: unknown): string {
  if (error instanceof HubspotConfigError) return error.got ?? error.message;
  return error instanceof Error ? error.message : String(error);
}
