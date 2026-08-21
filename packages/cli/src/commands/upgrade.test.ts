import { describe, it, expect, mock } from "bun:test";
import {
  compareSemver,
  isCompiledBinary,
  resolveAssetName,
  runUpgrade,
  type UpgradeDeps,
} from "./upgrade.js";

function makeDeps(overrides: Partial<UpgradeDeps> = {}): UpgradeDeps {
  return {
    log: mock(() => {}),
    error: mock(() => {}),
    exit: mock((_code: number) => {
      throw new Error("exit called");
    }) as unknown as (code: number) => never,
    fetch: mock() as unknown as typeof fetch,
    execPath: "/usr/local/bin/hubspot",
    currentVersion: "0.1.0",
    platform: "linux",
    arch: "x64",
    writeBinary: mock(async () => {}),
    replaceBinary: mock(async () => {}),
    ...overrides,
  };
}

describe("compareSemver", () => {
  it("returns 0 for equal versions", () => {
    expect(compareSemver("0.1.0", "0.1.0")).toBe(0);
    expect(compareSemver("v0.1.0", "0.1.0")).toBe(0);
  });
  it("orders major/minor/patch correctly", () => {
    expect(compareSemver("0.1.0", "0.1.1")).toBe(-1);
    expect(compareSemver("0.2.0", "0.1.99")).toBe(1);
    expect(compareSemver("1.0.0", "0.99.99")).toBe(1);
  });
  it("treats missing components as zero", () => {
    expect(compareSemver("1", "1.0.0")).toBe(0);
    expect(compareSemver("1.1", "1.0.5")).toBe(1);
  });
});

describe("resolveAssetName", () => {
  it("maps all supported platforms", () => {
    expect(resolveAssetName("linux", "x64")).toBe("hubspot-linux-x64");
    expect(resolveAssetName("linux", "arm64")).toBe("hubspot-linux-arm64");
    expect(resolveAssetName("darwin", "x64")).toBe("hubspot-darwin-x64");
    expect(resolveAssetName("darwin", "arm64")).toBe("hubspot-darwin-arm64");
    expect(resolveAssetName("win32", "x64")).toBe("hubspot-windows-x64.exe");
  });
  it("returns null for unsupported combinations", () => {
    expect(resolveAssetName("freebsd", "x64")).toBeNull();
    expect(resolveAssetName("linux", "ppc64")).toBeNull();
  });
});

describe("isCompiledBinary", () => {
  it("detects compiled binaries by exec basename", () => {
    expect(isCompiledBinary("/usr/local/bin/hubspot")).toBe(true);
    expect(isCompiledBinary("C:/Users/x/hubspot.exe")).toBe(true);
    expect(isCompiledBinary("/home/u/.local/bin/hubspot")).toBe(true);
  });
  it("rejects node/bun/npx", () => {
    expect(isCompiledBinary("/usr/bin/node")).toBe(false);
    expect(isCompiledBinary("/usr/local/bin/bun")).toBe(false);
    expect(isCompiledBinary("/usr/bin/npx")).toBe(false);
  });
});

describe("runUpgrade", () => {
  it("refuses when not running as compiled binary", async () => {
    const deps = makeDeps({ execPath: "/usr/bin/node" });
    await expect(
      runUpgrade(deps, { check: false, force: false, version: undefined }),
    ).rejects.toThrow("exit called");
    expect(deps.exit).toHaveBeenCalledWith(1);
    expect(deps.error).toHaveBeenCalledWith(
      expect.stringContaining("only supported on the standalone binary"),
    );
  });

  it("refuses when platform has no prebuilt binary", async () => {
    const deps = makeDeps({ platform: "freebsd" as NodeJS.Platform });
    await expect(
      runUpgrade(deps, { check: false, force: false, version: undefined }),
    ).rejects.toThrow("exit called");
    expect(deps.exit).toHaveBeenCalledWith(1);
    expect(deps.error).toHaveBeenCalledWith(expect.stringContaining("No prebuilt binary"));
  });

  it("reports up-to-date in --check mode", async () => {
    const fetchMock = mock(async () =>
      new Response(JSON.stringify({ tag_name: "v0.1.0" }), { status: 200 }),
    );
    const deps = makeDeps({ fetch: fetchMock as unknown as typeof fetch });
    await runUpgrade(deps, { check: true, force: false, version: undefined });
    expect(deps.log).toHaveBeenCalledWith("You are on the latest version.");
    expect(deps.writeBinary).not.toHaveBeenCalled();
    expect(deps.replaceBinary).not.toHaveBeenCalled();
  });

  it("reports update-available in --check mode", async () => {
    const fetchMock = mock(async () =>
      new Response(JSON.stringify({ tag_name: "v0.2.0" }), { status: 200 }),
    );
    const deps = makeDeps({ fetch: fetchMock as unknown as typeof fetch });
    await runUpgrade(deps, { check: true, force: false, version: undefined });
    expect(deps.log).toHaveBeenCalledWith(
      "Update available. Run `hubspot upgrade` to install.",
    );
    expect(deps.writeBinary).not.toHaveBeenCalled();
  });

  it("skips install when already on latest and --force is not set", async () => {
    const fetchMock = mock(async () =>
      new Response(JSON.stringify({ tag_name: "v0.1.0" }), { status: 200 }),
    );
    const deps = makeDeps({ fetch: fetchMock as unknown as typeof fetch });
    await runUpgrade(deps, { check: false, force: false, version: undefined });
    expect(deps.log).toHaveBeenCalledWith("Already on the latest version.");
    expect(deps.writeBinary).not.toHaveBeenCalled();
  });

  it("downloads, verifies, and replaces binary on real upgrade", async () => {
    const { createHash } = await import("node:crypto");
    const payload = Buffer.from("fake-binary-contents");
    const sha = createHash("sha256").update(payload).digest("hex");

    const fetchMock = mock(async (input: unknown) => {
      const url = String(input);
      if (url.includes("/releases/latest")) {
        return new Response(JSON.stringify({ tag_name: "v0.2.0" }), { status: 200 });
      }
      if (url.endsWith(".sha256")) {
        return new Response(`${sha}  hubspot-linux-x64\n`, { status: 200 });
      }
      return new Response(payload, { status: 200 });
    });

    const deps = makeDeps({ fetch: fetchMock as unknown as typeof fetch });
    await runUpgrade(deps, { check: false, force: false, version: undefined });

    expect(deps.writeBinary).toHaveBeenCalledTimes(1);
    expect(deps.replaceBinary).toHaveBeenCalledTimes(1);
    expect(deps.log).toHaveBeenCalledWith("Upgraded to 0.2.0.");
  });

  it("rejects binary with mismatched sha256", async () => {
    const fetchMock = mock(async (input: unknown) => {
      const url = String(input);
      if (url.includes("/releases/latest")) {
        return new Response(JSON.stringify({ tag_name: "v0.2.0" }), { status: 200 });
      }
      if (url.endsWith(".sha256")) {
        return new Response("deadbeef  hubspot-linux-x64\n", { status: 200 });
      }
      return new Response(Buffer.from("tampered"), { status: 200 });
    });
    const deps = makeDeps({ fetch: fetchMock as unknown as typeof fetch });
    await expect(
      runUpgrade(deps, { check: false, force: false, version: undefined }),
    ).rejects.toThrow(/Checksum mismatch/);
    expect(deps.writeBinary).not.toHaveBeenCalled();
  });

  it("honors --version flag to install a specific version", async () => {
    const { createHash } = await import("node:crypto");
    const payload = Buffer.from("pinned-binary");
    const sha = createHash("sha256").update(payload).digest("hex");
    const urls: string[] = [];

    const fetchMock = mock(async (input: unknown) => {
      const url = String(input);
      urls.push(url);
      if (url.endsWith(".sha256")) {
        return new Response(`${sha}  x\n`, { status: 200 });
      }
      return new Response(payload, { status: 200 });
    });

    const deps = makeDeps({ fetch: fetchMock as unknown as typeof fetch });
    await runUpgrade(deps, { check: false, force: false, version: "0.1.1" });

    // Should hit the download URLs directly, never the /releases/latest endpoint.
    expect(urls.some((u) => u.includes("/releases/latest"))).toBe(false);
    expect(urls.some((u) => u.includes("/download/v0.1.1/"))).toBe(true);
    expect(deps.replaceBinary).toHaveBeenCalledTimes(1);
  });
});
