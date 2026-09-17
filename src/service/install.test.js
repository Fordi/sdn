import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { makeProjectFixture, makeFakeHome, makeFakeSystemctl, runNodeScript } from "./testSupport.js";

const here = dirname(fileURLToPath(import.meta.url));
const installScript = join(here, "install.js");

const systemdUserDir = (home) => join(home, ".config", "systemd", "user");

const cleanup = (...dirs) => {
  for (const dir of dirs) {
    rmSync(dir, { recursive: true, force: true });
  }
};

describe("install", () => {
  it("writes a .service file in the project root", () => {
    const root = makeProjectFixture();
    const home = makeFakeHome();
    const { binDir } = makeFakeSystemctl();
    try {
      runNodeScript(installScript, { cwd: root, env: { HOME: home, PATH: `${binDir}:${process.env.PATH}` } });
      const serviceFile = join(root, "myproject.service");
      assert.ok(existsSync(serviceFile));
      const content = readFileSync(serviceFile, "utf8");
      assert.match(content, /\[Unit\]/);
      assert.match(content, /WorkingDirectory=/);
    } finally {
      cleanup(root, home, binDir);
    }
  });

  it("links the service with systemctl when no existing unit file is present", () => {
    const root = makeProjectFixture();
    const home = makeFakeHome();
    const { binDir, calls } = makeFakeSystemctl();
    try {
      runNodeScript(installScript, { cwd: root, env: { HOME: home, PATH: `${binDir}:${process.env.PATH}` } });
      const serviceFile = join(root, "myproject.service");
      assert.deepEqual(calls(), [`--user link ${serviceFile}`]);
    } finally {
      cleanup(root, home, binDir);
    }
  });

  it("warns and exits without overwriting when a unit file already exists and --force is not given", () => {
    const root = makeProjectFixture();
    const home = makeFakeHome();
    const { binDir, calls } = makeFakeSystemctl();
    const userDir = systemdUserDir(home);
    mkdirSync(userDir, { recursive: true });
    const existingUnitFile = join(userDir, "myproject.service");
    writeFileSync(existingUnitFile, "pre-existing content", "utf8");
    try {
      const result = runNodeScript(installScript, { cwd: root, env: { HOME: home, PATH: `${binDir}:${process.env.PATH}` } });
      assert.match(result.stderr, /already exists/);
      assert.deepEqual(calls(), []);
      assert.equal(readFileSync(existingUnitFile, "utf8"), "pre-existing content");
    } finally {
      cleanup(root, home, binDir);
    }
  });

  it("removes the existing unit file, reloads the daemon, and re-links when --force is given", () => {
    const root = makeProjectFixture();
    const home = makeFakeHome();
    const { binDir, calls } = makeFakeSystemctl();
    const userDir = systemdUserDir(home);
    mkdirSync(userDir, { recursive: true });
    const existingUnitFile = join(userDir, "myproject.service");
    writeFileSync(existingUnitFile, "pre-existing content", "utf8");
    try {
      runNodeScript(installScript, {
        cwd: root,
        env: { HOME: home, PATH: `${binDir}:${process.env.PATH}` },
        args: ["--force"],
      });
      assert.ok(!existsSync(existingUnitFile));
      const serviceFile = join(root, "myproject.service");
      assert.deepEqual(calls(), ["--user daemon-reload", `--user link ${serviceFile}`]);
    } finally {
      cleanup(root, home, binDir);
    }
  });
});
