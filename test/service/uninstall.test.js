import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { makeProjectFixture, makeFakeHome, makeFakeSystemctl, runNodeScript } from "../testSupport.js";

const here = resolve(dirname(fileURLToPath(import.meta.url)), "../../src/service");
const uninstallScript = join(here, "uninstall.js");

const systemdUserDir = (home) => join(home, ".config", "systemd", "user");

const cleanup = (...dirs) => {
  for (const dir of dirs) {
    rmSync(dir, { recursive: true, force: true });
  }
};

describe("uninstall", () => {
  it("removes the unit file and reloads the daemon when one exists", () => {
    const root = makeProjectFixture();
    const home = makeFakeHome();
    const { binDir, calls } = makeFakeSystemctl();
    const userDir = systemdUserDir(home);
    mkdirSync(userDir, { recursive: true });
    const unitFile = join(userDir, "myproject.service");
    writeFileSync(unitFile, "content", "utf8");
    try {
      const result = runNodeScript(uninstallScript, { cwd: root, env: { HOME: home, PATH: `${binDir}:${process.env.PATH}` } });
      assert.ok(!existsSync(unitFile));
      assert.deepEqual(calls(), ["--user daemon-reload"]);
      assert.match(result.stdout, /Removed/);
    } finally {
      cleanup(root, home, binDir);
    }
  });

  it("warns and does not call systemctl when no unit file exists", () => {
    const root = makeProjectFixture();
    const home = makeFakeHome();
    const { binDir, calls } = makeFakeSystemctl();
    try {
      const result = runNodeScript(uninstallScript, { cwd: root, env: { HOME: home, PATH: `${binDir}:${process.env.PATH}` } });
      assert.match(result.stderr, /No service file at/);
      assert.deepEqual(calls(), []);
    } finally {
      cleanup(root, home, binDir);
    }
  });
});
