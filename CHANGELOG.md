# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-11-10

### Added

- OS keychain credential storage via `Bun.secrets` (macOS Keychain, Linux libsecret, Windows Credential Manager). `HUBSPOT_ACCESS_TOKEN` is stored under service `hubspot-toolkit` and found by both the CLI and the MCP server with no `.env` file and no MCP `env` block.
- `hubspot auth set|list|delete|migrate`. `auth set` reads the token from a hidden prompt or `--stdin`, never from argv. `auth migrate` copies `.env` tokens into the keychain and lists the files to clean up without editing them.
- `hubspot config show`: resolved config with secrets redacted, per-setting sources, and keychain status.
- MCP tool `hubspot_config_status` (read-only): whether the token is configured, its source, and the keychain status. No MCP tool writes or deletes secrets.
- SDK: `loadConfig()`, `loadConfigState()`, `resolveConfigState()`, `redactedConfig()`, `SecretStore`, `bunSecretStore()`, `readKeychainValues()`, `CREDENTIAL_KEYS`, and `HubspotConfigError`.
- `HUBSPOT_KEYCHAIN=0` skips the keychain lookup.
- Docs: configuration guide, security guide, and decision record 0001.

### Changed

- Credential precedence is now override > process env > nearest `.env` > OS keychain > default. The SDK reads `.env` files itself, walking up from the current directory.
- Every CLI command and MCP tool resolves config with `await loadConfig()` on each call. A missing token exits 3 (CLI) or returns a tool error (MCP) with a hint to run `hubspot auth set hubspot`.
- `resolveConfig()` throws `HubspotConfigError` (a `HubspotError`) instead of a plain `Error`, and returns source metadata alongside `accessToken` and `baseUrl`.
- `HubspotValidationError` accepts an optional `hint`, printed by the CLI.

[Unreleased]: https://github.com/spenserhale/hubspot-toolkit/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/spenserhale/hubspot-toolkit/releases/tag/v0.2.0
