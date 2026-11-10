import {
  CREDENTIAL_KEYS,
  CREDENTIAL_RESOURCES,
  HubspotValidationError,
  credentialValue,
  errorDetail,
  resourceCredentialKeys,
  resourceForCredentialKey,
  type ConfigState,
  type CredentialResource,
  type SecretStore,
} from "@hubspot-toolkit/sdk";

export function parseResource(raw: string): CredentialResource {
  const value = raw.trim().toLowerCase();
  if (!(CREDENTIAL_RESOURCES as readonly string[]).includes(value)) {
    throw new HubspotValidationError(`Unknown resource "${raw}"`, {
      hint: `Valid resources: ${CREDENTIAL_RESOURCES.join(", ")}`,
    });
  }
  return value as CredentialResource;
}

/** The keychain entry names to act on: one --key, or every key the resource uses. */
export function selectCredentialKeys(resource: CredentialResource, key: string | undefined): string[] {
  const keys = resourceCredentialKeys(resource);
  if (key === undefined) return [...keys];
  const normalized = key.trim().toUpperCase();
  if (!keys.includes(normalized)) {
    throw new HubspotValidationError(`--key "${key}" is not a credential for ${resource}`, {
      hint: `Valid keys: ${keys.join(", ")}`,
    });
  }
  return [normalized];
}

/** Sources that outrank the keychain, so a stored value would be ignored. */
function isShadowingSource(source: string | undefined): boolean {
  return source === "env" || (source?.startsWith("envfile:") ?? false);
}

export interface SetCredentialsInput {
  resource: CredentialResource;
  keys: readonly string[];
  readValue: (key: string) => Promise<string>;
  store: SecretStore;
  /** Config loaded with `secretStore: null`, to see what would shadow the keychain. */
  config: ConfigState;
  dryRun: boolean;
}

export interface SetCredentialsResult {
  resource: CredentialResource;
  store: string;
  dry_run: boolean;
  credentials: Array<{ key: string; action: "stored" | "would_store"; shadowed_by?: string }>;
}

export async function setCredentials(input: SetCredentialsInput): Promise<SetCredentialsResult> {
  const values: Array<[string, string]> = [];
  for (const key of input.keys) {
    const value = (await input.readValue(key)).trim();
    if (!value) {
      throw new HubspotValidationError(`${key} must not be empty`, {
        hint: "Paste the key at the prompt, or pipe it with --stdin.",
      });
    }
    values.push([key, value]);
  }
  const credentials: SetCredentialsResult["credentials"] = [];
  for (const [key, value] of values) {
    if (!input.dryRun) await input.store.set(key, value);
    const source = input.config.credentialSources[key];
    credentials.push({
      key,
      action: input.dryRun ? "would_store" : "stored",
      ...(source && isShadowingSource(source) ? { shadowed_by: source } : {}),
    });
  }
  return {
    resource: input.resource,
    store: input.store.description,
    dry_run: input.dryRun,
    credentials,
  };
}

export interface CredentialListRow {
  resource: CredentialResource;
  key: string;
  keychain: "set" | "missing" | "unknown";
  active_source: string;
}

export interface ListCredentialsResult {
  store: string;
  keychain_status: "ok" | "unavailable";
  keychain_error?: string;
  credentials: CredentialListRow[];
}

export async function listCredentials(
  store: SecretStore,
  config: ConfigState,
): Promise<ListCredentialsResult> {
  let stored: Record<string, boolean> | null = null;
  let error: string | undefined;
  try {
    const entries = await Promise.all(
      CREDENTIAL_KEYS.map(async (key) => [key, Boolean(await store.get(key))] as const),
    );
    stored = Object.fromEntries(entries);
  } catch (caught) {
    error = errorDetail(caught);
  }
  return {
    store: store.description,
    keychain_status: stored ? "ok" : "unavailable",
    ...(error ? { keychain_error: error } : {}),
    credentials: CREDENTIAL_KEYS.map((key) => ({
      resource: resourceForCredentialKey(key) as CredentialResource,
      key,
      keychain: stored ? (stored[key] ? "set" : "missing") : "unknown",
      active_source: config.credentialSources[key] ?? "missing",
    })),
  };
}

export interface DeleteCredentialsResult {
  resource: CredentialResource;
  store: string;
  dry_run: boolean;
  credentials: Array<{ key: string; action: "deleted" | "not_found" | "would_delete" }>;
}

export async function deleteCredentials(input: {
  resource: CredentialResource;
  keys: readonly string[];
  store: SecretStore;
  dryRun: boolean;
}): Promise<DeleteCredentialsResult> {
  const credentials: DeleteCredentialsResult["credentials"] = [];
  for (const key of input.keys) {
    if (input.dryRun) {
      credentials.push({ key, action: "would_delete" });
      continue;
    }
    const deleted = await input.store.delete(key);
    credentials.push({ key, action: deleted ? "deleted" : "not_found" });
  }
  return {
    resource: input.resource,
    store: input.store.description,
    dry_run: input.dryRun,
    credentials,
  };
}

export interface MigrateCredentialsResult {
  store: string;
  dry_run: boolean;
  credentials: Array<{
    resource: CredentialResource;
    key: string;
    from: string;
    action: "stored" | "would_store" | "skipped_exists";
  }>;
  /** Plaintext files that still hold migrated keys; remove the lines yourself. */
  clean_up: string[];
  note?: string;
}

/**
 * Copy keys whose winning source is a `.env` file into the store. Process-
 * environment keys are left alone: they usually come from op run or CI and are
 * not plaintext at rest. Files are never edited.
 */
export async function migrateCredentials(input: {
  store: SecretStore;
  config: ConfigState;
  dryRun: boolean;
  overwrite: boolean;
}): Promise<MigrateCredentialsResult> {
  const credentials: MigrateCredentialsResult["credentials"] = [];
  const cleanUp = new Set<string>();
  for (const key of CREDENTIAL_KEYS) {
    const source = input.config.credentialSources[key];
    if (!source?.startsWith("envfile:")) continue;
    const file = source.slice("envfile:".length);
    const value = credentialValue(input.config, key);
    if (!value) continue;
    const resource = resourceForCredentialKey(key) as CredentialResource;

    if (!input.overwrite && (await input.store.get(key))) {
      credentials.push({ resource, key, from: source, action: "skipped_exists" });
      cleanUp.add(file);
      continue;
    }
    if (!input.dryRun) await input.store.set(key, value);
    credentials.push({ resource, key, from: source, action: input.dryRun ? "would_store" : "stored" });
    cleanUp.add(file);
  }
  return {
    store: input.store.description,
    dry_run: input.dryRun,
    credentials,
    clean_up: [...cleanUp],
    ...(cleanUp.size > 0
      ? {
          note: "A .env value keeps overriding the keychain until you delete that line from the file.",
        }
      : {}),
  };
}

export function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
