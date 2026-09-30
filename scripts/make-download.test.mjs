import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const roots = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "phraseloop-package-test-"));
  roots.push(root);
  function file(name, text, executable = false) {
    const target = path.join(root, name);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, text, { mode: executable ? 0o755 : 0o644 });
  }
  file("package.json", JSON.stringify({ version: "1.2.3" }));
  file("bin/uname", '#!/bin/sh\ncase "$1" in -s) echo Darwin;; -m) echo arm64;; esac\n', true);
  file("bin/stat", '#!/bin/sh\necho "${FIXTURE_DMG_BYTES:-13}"\n', true);
  const env = { ...process.env, PATH: `${root}/bin:${process.env.PATH}`, PHRASELOOP_SKIP_MAC_CLEAN_INSTALL: "1" };
  return { root, file, env };
}

describe("macOS packaging scripts", () => {
  it("preserves live dev files and cache while removing stale production output", () => {
    const f = fixture();
    f.file("electron/build-app.sh", readFileSync(new URL("../electron/build-app.sh", import.meta.url), "utf8"));
    f.file("scripts/fix-native-rpaths.mjs", "// No native dependencies in this fixture.\n");
    // Stop at the build boundary: exercise the real cleanup, never package or sign.
    f.file("bin/npm", "#!/bin/sh\nexit 37\n", true);
    f.file(".next/dev/routes-manifest.json", "live-dev-manifest");
    f.file(".next/cache/compiler", "cached");
    f.file(".next/standalone/server.js", "stale-server");
    f.file(".next/BUILD_ID", "stale-build");
    const result = spawnSync("bash", ["electron/build-app.sh"], { cwd: f.root, env: f.env, encoding: "utf8" });
    expect(result.status, result.stderr).toBe(37);
    expect(readFileSync(path.join(f.root, ".next/dev/routes-manifest.json"), "utf8")).toBe("live-dev-manifest");
    expect(readFileSync(path.join(f.root, ".next/cache/compiler"), "utf8")).toBe("cached");
    expect(existsSync(path.join(f.root, ".next/standalone"))).toBe(false);
    expect(existsSync(path.join(f.root, ".next/BUILD_ID"))).toBe(false);
  });

  it("reuses exactly the built DMG without invoking a second image builder", () => {
    const f = fixture();
    f.file("scripts/make-download.sh", readFileSync(new URL("./make-download.sh", import.meta.url), "utf8"));
    f.file("electron/build-app.sh", '#!/bin/sh\nmkdir -p dist/mac-arm64/PhraseLoop.app\nprintf current-image > dist/PhraseLoop-1.2.3.dmg\nprintf stale > dist/0-stale.dmg\n', true);
    f.file("node_modules/.bin/electron-builder", "#!/bin/sh\necho Unexpected duplicate build >&2\nexit 99\n", true);
    const result = spawnSync("bash", ["scripts/make-download.sh"], { cwd: f.root, env: f.env, encoding: "utf8" });
    expect(result.status, result.stderr).toBe(0);
    expect(readdirSync(path.join(f.root, "dist"))).toEqual(["PhraseLoop-mac-arm64.dmg"]);
    expect(readFileSync(path.join(f.root, "dist/PhraseLoop-mac-arm64.dmg"), "utf8")).toBe("current-image");
    expect(result.stdout).toContain("no rebuild");
  });

  it("fails on a missing expected image instead of shipping an unrelated image", () => {
    const f = fixture();
    f.file("scripts/make-download.sh", readFileSync(new URL("./make-download.sh", import.meta.url), "utf8"));
    f.file("electron/build-app.sh", '#!/bin/sh\nmkdir -p dist/mac-arm64/PhraseLoop.app\nprintf stale > dist/old.dmg\n', true);
    const result = spawnSync("bash", ["scripts/make-download.sh"], { cwd: f.root, env: f.env, encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("Build did not produce dist/PhraseLoop-1.2.3.dmg");
    expect(existsSync(path.join(f.root, "dist/old.dmg"))).toBe(true);
  });
});
