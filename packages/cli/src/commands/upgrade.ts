import { buildCommand } from "@stricli/core";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { chmod, rename, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import pkg from "../../package.json" with { type: "json" };

const REPO = "spenserhale/hubspot-toolkit";

interface UpgradeFlags {
  readonly check: boolean;
  readonly force: boolean;
  readonly version: string | undefined;
}

export interface UpgradeDeps {
  readonly log: (msg: string) => void;
  readonly error: (msg: string) => void;
  readonly exit: (code: number) => never;
  readonly fetch: typeof fetch;
  readonly execPath: string;
  readonly currentVersion: string;
  readonly platform: NodeJS.Platform;
  readonly arch: string;
  readonly writeBinary: (path: string, bytes: Buffer) => Promise<void>;
  readonly replaceBinary: (target: string, tempSource: string) => Promise<void>;
}

const defaultDeps: UpgradeDeps = {
  log: (msg) => console.log(msg),
  error: (msg) => console.error(msg),
  exit: (code) => process.exit(code),
  fetch: fetch as typeof fetch,
  execPath: process.execPath,
  currentVersion: pkg.version,
  platform: process.platform,
  arch: process.arch,
  writeBinary: async (path, bytes) => {
    await writeFile(path, bytes);
    await chmod(path, 0o755);
  },
  replaceBinary: async (target, tempSource) => {
    if (process.platform === "win32") {
      const oldPath = `${target}.old`;
      if (existsSync(oldPath)) {
        try {
          await unlink(oldPath);
        } catch {
          // A previous upgrade left a .old that couldn't be removed; ignore
          // and let the rename below surface the real failure if any.
        }
      }
      await rename(target, oldPath);
      await rename(tempSource, target);
    } else {
      await rename(tempSource, target);
    }
  },
};

export function resolveAssetName(platform: string, arch: string): string | null {
  if (platform === "linux" && arch === "x64") return "hubspot-linux-x64";
  if (platform === "linux" && arch === "arm64") return "hubspot-linux-arm64";
  if (platform === "darwin" && arch === "x64") return "hubspot-darwin-x64";
  if (platform === "darwin" && arch === "arm64") return "hubspot-darwin-arm64";
  if (platform === "win32" && arch === "x64") return "hubspot-windows-x64.exe";
  return null;
}

export function isCompiledBinary(execPath: string): boolean {
  // A bun-compiled binary has process.execPath pointing at the binary itself
  // (basename `hubspot` / `hubspot.exe`). Anything else (node, bun, npx)
  // means the CLI is running as a JS script and can't replace its own runtime.
  const name = basename(execPath).replace(/\.exe$/i, "");
  return name === "hubspot";
}

export function compareSemver(a: string, b: string): number {
  const parse = (v: string) => v.replace(/^v/, "").split(".").map((n) => Number(n) || 0);
  const aParts = parse(a);
  const bParts = parse(b);
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const ap = aParts[i] ?? 0;
    const bp = bParts[i] ?? 0;
    if (ap > bp) return 1;
    if (ap < bp) return -1;
  }
  return 0;
}

async function fetchLatestRelease(deps: UpgradeDeps): Promise<{ tag: string; version: string }> {
  const res = await deps.fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as { tag_name?: string };
  if (!data.tag_name) {
    throw new Error("GitHub response missing tag_name");
  }
  return { tag: data.tag_name, version: data.tag_name.replace(/^v/, "") };
}

async function downloadAndVerify(
  deps: UpgradeDeps,
  tag: string,
  asset: string,
): Promise<Buffer> {
  const base = `https://github.com/${REPO}/releases/download/${tag}`;
  const [assetRes, checksumRes] = await Promise.all([
    deps.fetch(`${base}/${asset}`),
    deps.fetch(`${base}/${asset}.sha256`),
  ]);

  if (!assetRes.ok) throw new Error(`Failed to download ${asset}: ${assetRes.status}`);
  if (!checksumRes.ok) throw new Error(`Failed to download checksum: ${checksumRes.status}`);

  const bytes = Buffer.from(await assetRes.arrayBuffer());
  const expected = (await checksumRes.text()).trim().split(/\s+/)[0];
  if (!expected) throw new Error("Could not parse checksum file");

  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== expected) {
    throw new Error(`Checksum mismatch: expected ${expected}, got ${actual}`);
  }

  return bytes;
}

export async function runUpgrade(deps: UpgradeDeps, flags: UpgradeFlags): Promise<void> {
  if (!isCompiledBinary(deps.execPath)) {
    deps.error("`hubspot upgrade` is only supported on the standalone binary install.");
    deps.error("");
    deps.error("You appear to be running via Node.js / a package manager. Update via:");
    deps.error("  npm install -g @hubspot-toolkit/cli@latest");
    deps.error("  bun add -g @hubspot-toolkit/cli@latest");
    deps.error("");
    deps.error("Or switch to the standalone binary:");
    deps.error("  curl -fsSL https://raw.githubusercontent.com/spenserhale/hubspot-toolkit/main/scripts/install.sh | sh");
    deps.exit(1);
  }

  const asset = resolveAssetName(deps.platform, deps.arch);
  if (!asset) {
    deps.error(`No prebuilt binary for ${deps.platform}/${deps.arch}.`);
    deps.error("Supported: linux-x64, linux-arm64, darwin-x64, darwin-arm64, windows-x64.");
    deps.exit(1);
  }

  const latest = flags.version
    ? {
        tag: flags.version.startsWith("v") ? flags.version : `v${flags.version}`,
        version: flags.version.replace(/^v/, ""),
      }
    : await fetchLatestRelease(deps);

  deps.log(`Current: ${deps.currentVersion}`);
  deps.log(`Latest:  ${latest.version}`);

  const cmp = compareSemver(deps.currentVersion, latest.version);

  if (flags.check) {
    if (cmp >= 0) {
      deps.log("You are on the latest version.");
    } else {
      deps.log("Update available. Run `hubspot upgrade` to install.");
    }
    return;
  }

  if (!flags.force && cmp >= 0) {
    deps.log("Already on the latest version.");
    return;
  }

  deps.log(`Downloading ${asset}...`);
  const bytes = await downloadAndVerify(deps, latest.tag, asset);

  const binDir = dirname(deps.execPath);
  const tmpPath = join(binDir, `.hubspot-upgrade-${process.pid}.tmp`);
  await deps.writeBinary(tmpPath, bytes);
  await deps.replaceBinary(deps.execPath, tmpPath);

  deps.log(`Upgraded to ${latest.version}.`);
}

export const upgradeCommand = buildCommand({
  docs: {
    brief: "Upgrade the CLI to the latest release",
  },
  parameters: {
    flags: {
      check: {
        kind: "boolean",
        brief: "Check for a new version but don't install",
        default: false,
      },
      force: {
        kind: "boolean",
        brief: "Reinstall even if already on the latest version",
        default: false,
      },
      version: {
        kind: "parsed",
        parse: String,
        optional: true,
        brief: "Install a specific version (e.g. 0.1.1)",
      },
    },
  },
  async func(this: void, flags: UpgradeFlags) {
    try {
      await runUpgrade(defaultDeps, flags);
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  },
});
