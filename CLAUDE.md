# Guidance for Claude sessions in this repo

Follow the shared conventions in the parent `Toolkits/CLAUDE.md`.

## Do not try to validate `bun build --compile` binaries on local macOS

Binaries compiled locally on Apple Silicon with current Bun (1.3.x) can hang at
startup: no stdout, no exit, must be killed with `timeout`. The same code
cross-compiled to darwin-arm64 in GitHub Actions produces a working binary —
users installing via `scripts/install.sh` get a functioning executable.

**Implication:** don't smoke-test compiled binaries via
`./packages/cli/dist/hubspot --help` locally. Trust the CI build in
`.github/workflows/binaries.yml`, or download a CI-built asset from the GitHub
Release if you need to verify one actually runs.

The plain JS build (`bun run build` -> `packages/cli/dist/bin.js`) runs fine
locally; use `node packages/cli/dist/bin.js --help` for smoke tests.

## Install/upgrade

- `scripts/install.sh` downloads a prebuilt binary from GitHub Releases and
  verifies its SHA256 checksum — no npm publishing is wired up for this
  toolkit (unlike cloudflare-toolkit/godaddy-ai-toolkit, which also publish to
  npm via Changesets).
- `hubspot upgrade` self-replaces the running binary; it only works when
  invoked as the compiled binary (checked via `isCompiledBinary()` in
  `packages/cli/src/commands/upgrade.ts`), not via `bun run`/`npx`.
- New releases are cut manually with `gh release create vX.Y.Z`, which
  triggers `.github/workflows/binaries.yml` to cross-compile and attach the 5
  platform binaries + checksums.
