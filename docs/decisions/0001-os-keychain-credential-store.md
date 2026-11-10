---
title: "0001: Store the HubSpot access token in the OS keychain with Bun.secrets"
description: "HUBSPOT_ACCESS_TOKEN can live in the OS credential store via Bun.secrets, resolved after process env and .env."
status: accepted
date: 2026-11-10
decision-makers: "Spenser Hale"
---

## Context

Before this change, every persistent way to give the toolkit `HUBSPOT_ACCESS_TOKEN` was plaintext at rest: a project `.env` or a literal value in an MCP host `env` block. `op run` works but requires 1Password. The MCP case is the worst one: GUI hosts do not inherit the shell, so the usual fix is to paste the token into the host config file. A private app token grants read and write access to every CRM object its scopes cover.

Bun 1.3+ ships `Bun.secrets`, which wraps macOS Keychain Services, Linux libsecret, and Windows Credential Manager with no native dependency. The CLI and the MCP server already run on Bun. The same design shipped in `wide-search-toolkit` v0.2.0 (its decision record 0007) and `ynab-toolkit` v0.2.0; this toolkit copies it.

## Options considered

1. **`Bun.secrets`**: built in, cross-platform, no install step, async only. Only works when the process runs on Bun.
2. **`@napi-rs/keyring` or `keytar`**: work on Node too, but add a native dependency with per-platform optional packages that `bun install` can skip; `keytar` is archived.
3. **Shell out to `security`**: macOS only, and `add-generic-password -w <value>` leaks the value to `ps`.
4. **Document `op run` only**: no code, but it leaves non-1Password users with plaintext.

## Decision

We will store credentials with `Bun.secrets` under service `hubspot-toolkit`, one entry per env-var name (`HUBSPOT_ACCESS_TOKEN`).

Resolution order:

```
explicit override > process environment > nearest .env > OS keychain > default
```

- `.env` beats the keychain because a project `.env` is an explicit per-project override; `op run` and CI keep working unchanged.
- `resolveConfig()` stays synchronous and never touches the keychain. The new async `loadConfig()` reads only the keys that overrides, env and `.env` did not supply, so an explicit token never triggers a keychain prompt. Every CLI command and MCP tool uses `loadConfig()`.
- A keychain that throws (locked, no Secret Service daemon, not running on Bun) is reported as `keychain.status: "unavailable"` and never fails a command that has its token from elsewhere. `HUBSPOT_KEYCHAIN=0` (in env or `.env`) skips the lookup.
- The CLI gets `hubspot auth set|list|delete|migrate` and `hubspot config show`. `auth set` reads the value from a hidden TTY prompt or explicit `--stdin`, never from argv. `auth migrate` copies `.env` keys into the keychain but never edits files.
- The MCP server reads the keychain on every tool call, adds a read-only `hubspot_config_status` tool, and has no tool that writes or deletes secrets.

Not done: a plaintext fallback store, multiple profiles, and keychain entries for aliases. This toolkit has no user config file, so the "user config file" tier from the wide-search design does not exist here.

## Consequences

- Users can enter the token once, without it being shown, and drop both `.env` and the MCP `env` block.
- On macOS, a binary other than the one that created the entry (a Bun upgrade, the standalone `hubspot` binary, a GUI MCP host) can trigger an access dialog. Users choose "Always Allow".
- Headless Linux and CI usually have no Secret Service; they keep using env vars, and the keychain reports `unavailable`.
- The Node build (`packages/cli/dist/bin.js`) cannot read the keychain and needs the token from env or `.env`.
- The keychain protects the token at rest, not against code already running as the user.
- Tests inject an in-memory `SecretStore` and spawn processes with `HUBSPOT_KEYCHAIN=0`, so the suite never touches a real keychain.
