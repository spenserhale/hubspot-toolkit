---
title: Configuration
description: How hubspot-toolkit finds HUBSPOT_ACCESS_TOKEN and other settings, and how to keep the token in the OS keychain.
---

## Settings

| Env var | Purpose | Default |
|---|---|---|
| `HUBSPOT_ACCESS_TOKEN` | HubSpot private app access token (secret) | none; required |
| `HUBSPOT_BASE_URL` | API base URL | `https://api.hubapi.com` |
| `HUBSPOT_KEYCHAIN` | `0`, `false`, `no` or `off` skips the OS keychain | keychain on |

## Precedence

Each value comes from the first source that has it:

```
explicit override (SDK caller) > process env > nearest .env > OS keychain (credentials only) > default
```

- **Process env** includes `op run`, CI secrets and an MCP host `env` block.
- **Nearest `.env`**: the SDK walks up from the current directory and the closest file wins. Bun also loads `./.env` into `process.env`; the toolkit still reports those values as `envfile:<path>`.
- **OS keychain**: service `hubspot-toolkit`, entry `HUBSPOT_ACCESS_TOKEN`, read through `Bun.secrets` (macOS Keychain, Linux libsecret, Windows Credential Manager). It is only consulted when nothing above supplied the token, so an explicit token never causes a keychain prompt.

This toolkit has no user config file, so there is no tier between the keychain and the default.

`hubspot config show` prints each setting's winning source and the keychain status (`ok`, `disabled`, `unavailable`) without values. The MCP tool `hubspot_config_status` returns the same data.

## OS keychain setup

Interactive (hidden prompt; the label goes to stderr):

```bash
hubspot auth set hubspot
```

Non-interactive. The value is read from stdin only with `--stdin`, and never from an argument, so it stays out of shell history and `ps`:

```bash
pbpaste | hubspot auth set hubspot --stdin
op read 'op://Private/HubSpot/access-token' | hubspot auth set hubspot --stdin
```

Without a terminal and without `--stdin`, `auth set` exits `2` with a hint instead of waiting on stdin. From a source checkout, use `bun run dev:cli -- auth ...` in place of `hubspot auth ...`.

## Commands

| Command | What it does |
|---|---|
| `hubspot auth set hubspot [--key HUBSPOT_ACCESS_TOKEN] [--stdin] [--dry-run]` | Store the token. Output lists `stored` / `would_store` per key, plus `shadowed_by: env` or `envfile:<path>` when a higher-precedence source still overrides it. |
| `hubspot auth list` | Every credential key with its keychain state (`set`, `missing`, `unknown` when the keychain is unavailable) and active source. Never prints values. `--csv` and `--text` renderers are available. |
| `hubspot auth delete hubspot --yes [--key] [--dry-run]` | Remove the entry. Refuses without `--yes` (exit 2). Reports `deleted` or `not_found`. |
| `hubspot auth migrate [--dry-run] [--overwrite]` | Copy keys whose active source is a `.env` file into the keychain. |
| `hubspot config show` | Resolved config with secrets redacted and the keychain status. |

All `auth` commands accept `--toon` (default), `--json`, `--csv` and `--text`. Exit codes follow the CLI conventions: `2` validation, `3` config (including a missing token or an unreadable keychain on `set`/`delete`).

## Migrating from `.env`

```bash
hubspot auth migrate --dry-run     # see what would move
hubspot auth migrate               # store it; prints clean_up: the files that still hold the token
```

`migrate` skips keys already in the keychain unless `--overwrite`, and leaves process-env keys (`op run`, CI) alone. It never edits files. Delete the `HUBSPOT_ACCESS_TOKEN=` line from each `clean_up` file yourself: a `.env` value keeps overriding the keychain until you do.

## MCP setup

Recommended: store the token with `hubspot auth set hubspot`, then configure the host with no `env` block:

```json
{ "mcpServers": { "hubspot": { "command": "bun", "args": ["run", "/abs/path/hubspot-toolkit/packages/mcp/src/index.ts"] } } }
```

The server reads the keychain on each tool call, so a rotated token applies without restarting the host. An `env` block still works and wins over the keychain.

## Caveats

- **macOS access dialog.** The binary that created an entry reads it silently. Another binary (Bun after an upgrade, the `hubspot` standalone binary from `install.sh`, a GUI MCP host launching Bun) can trigger "wants to use your confidential information". Choose **Always Allow**. Entries are visible in Keychain Access.app, and `security find-generic-password -s hubspot-toolkit -a HUBSPOT_ACCESS_TOKEN` finds them.
- **Linux needs a Secret Service daemon** (GNOME Keyring or KWallet). Headless boxes and CI usually have none: the keychain reports `unavailable` and env tokens keep working. Set `HUBSPOT_KEYCHAIN=0` there to skip the lookup.
- **Bun only.** The lookup uses `globalThis.Bun.secrets`. The `node packages/cli/dist/bin.js` build and SDK consumers running on Node get `keychain.status: "unavailable"` and must supply the token through env or an override.
- **At rest, not at runtime.** The keychain keeps the token off disk in plaintext. It does not protect against code already running as your user.
