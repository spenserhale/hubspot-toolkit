# HubSpot Toolkit

SDK, CLI, and MCP server for CRUD on HubSpot CRM objects.

A monorepo containing the SDK, CLI, and MCP server for the HubSpot CRM API. The SDK exposes one generic engine over HubSpot's `/crm/v3/objects/{objectType}` API, so it works out of the box for standard objects (`contacts`, `companies`, `deals`, `tickets`) as well as any custom object, without per-object code.

## Packages

| Package | Description |
|---------|-------------|
| [`@hubspot-toolkit/sdk`](./packages/sdk) | Core SDK — types, HTTP client, config resolver, typed errors |
| [`@hubspot-toolkit/cli`](./packages/cli) | Command-line interface (Stricli) |
| [`@hubspot-toolkit/mcp`](./packages/mcp) | MCP server for AI assistants (FastMCP) |

## Getting Started

```bash
# Install dependencies
bun install

# Store your private app token in the OS keychain (hidden prompt)
bun run dev:cli -- auth set hubspot

# Build all packages
bun run build

# Run the CLI
bun run dev:cli -- --help

# Run the MCP server (stdio mode for Claude Desktop)
bun run dev:mcp
```

## Authentication

This toolkit uses a HubSpot **private app access token** (not OAuth). Create one at
Settings -> Integrations -> Private Apps in your HubSpot account, and grant the
`crm.objects.*` (read/write) scopes for whichever object types you need.

Recommended: store it once in the OS keychain (macOS Keychain, Linux libsecret, Windows
Credential Manager) via `Bun.secrets`. Both the CLI and the MCP server find it with no `.env`
and no MCP `env` block:

```bash
hubspot auth set hubspot                                   # hidden prompt
pbpaste | hubspot auth set hubspot --stdin                 # non-interactive
op read 'op://Private/HubSpot/access-token' | hubspot auth set hubspot --stdin
hubspot auth list                                          # keychain state + active source, never values
hubspot auth migrate                                       # copy a .env token into the keychain
hubspot config show                                        # resolved config, secrets redacted
```

Precedence is process env > nearest `.env` > OS keychain, so `HUBSPOT_ACCESS_TOKEN` in the
environment or a `.env` file still works and wins. Set `HUBSPOT_KEYCHAIN=0` to skip the keychain.
The token is never accepted as a command-line argument. See
[docs/guides/configuration.md](./docs/guides/configuration.md) and
[docs/guides/security.md](./docs/guides/security.md).

SDK consumers: `await loadConfig()` resolves env, `.env` and the keychain;
`resolveConfig()` stays synchronous and skips the keychain.

```ts
import { HubspotClient, loadConfig } from "@hubspot-toolkit/sdk";
const client = new HubspotClient(await loadConfig());
```

## CLI Usage

The CLI is a generic engine — every command takes an `<objectType>` (e.g. `contacts`,
`companies`, `deals`, `tickets`, or a custom object name/typeId) as its first positional
argument.

```bash
# List
hubspot objects list contacts --limit 5

# Get
hubspot objects get contacts 12345 --select email,firstname,lastname

# Create
hubspot objects create contacts --properties '{"email":"jane@example.com","firstname":"Jane"}'

# Update
hubspot objects update contacts 12345 --properties '{"lifecyclestage":"customer"}'

# Delete (archives the record)
hubspot objects delete contacts 12345

# Search
hubspot objects search deals --query "acme" --limit 10

# Batch
hubspot objects batch-read contacts --ids 111,222,333

# Properties
hubspot properties list contacts

# Associations
hubspot associations list contacts 12345 companies
hubspot associations create contacts 12345 companies 67890

# Credentials (OS keychain) and resolved config
hubspot auth list
hubspot config show

# Machine-readable command catalog
hubspot agent-context
```

All mutation commands (`create`, `update`, `delete`, `batch-*`, `associations create/delete`)
support `--dry-run` to validate and preview the payload without calling the API. Output
defaults to TOON; pass `--json` or `--csv` (list commands only) to change format.

## Architecture

```
packages/sdk/     <-- Types, HTTP client, config resolver, typed errors (foundation)
    ^       ^
    |       |
packages/cli/   packages/mcp/
    (Stricli)    (FastMCP)
```

Both the CLI and MCP server are thin wrappers over the SDK. If the REST API
changes, you update the SDK and both consumers get the fix automatically.

## Development

```bash
# Run tests across all packages
bun test

# Type-check a specific package
cd packages/sdk && bun run lint
```

## Adding a New Operation

1. Add the client method to `packages/sdk/src/client.ts` (and types to `types.ts` if needed)
2. Add a CLI command in `packages/cli/src/commands/`
3. Add an MCP tool in `packages/mcp/src/tools/`
