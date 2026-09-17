import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { makeProjectFixture, makeFakeSystemctl, runNodeScript } from "./testSupport.js";

const here = dirname(fileURLToPath(import.meta.url));

const runAlias = (name, root, binDir) =>
  runNodeScript(join(here, `${name}.js`), { cwd: root, env: { PATH: `${binDir}:${process.env.PATH}` } });

describe("service command aliases", () => {
  it("start calls systemctl --user start <name>", () => {
    const root = makeProjectFixture();
    const { binDir, calls } = makeFakeSystemctl();
    try {
      runAlias("start", root, binDir);
      assert.deepEqual(calls(), ["--user start myproject"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(binDir, { recursive: true, force: true });
    }
  });

  it("stop calls systemctl --user stop <name>", () => {
    const root = makeProjectFixture();
    const { binDir, calls } = makeFakeSystemctl();
    try {
      runAlias("stop", root, binDir);
      assert.deepEqual(calls(), ["--user stop myproject"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(binDir, { recursive: true, force: true });
    }
  });

  it("restart calls systemctl --user restart <name>", () => {
    const root = makeProjectFixture();
    const { binDir, calls } = makeFakeSystemctl();
    try {
      runAlias("restart", root, binDir);
      assert.deepEqual(calls(), ["--user restart myproject"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(binDir, { recursive: true, force: true });
    }
  });

  it("status calls systemctl --user status <name>", () => {
    const root = makeProjectFixture();
    const { binDir, calls } = makeFakeSystemctl();
    try {
      runAlias("status", root, binDir);
      assert.deepEqual(calls(), ["--user status myproject"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(binDir, { recursive: true, force: true });
    }
  });

  it("reload calls systemctl --user daemon-reload (not scoped to the service)", () => {
    const root = makeProjectFixture();
    const { binDir, calls } = makeFakeSystemctl();
    try {
      runAlias("reload", root, binDir);
      assert.deepEqual(calls(), ["--user daemon-reload"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(binDir, { recursive: true, force: true });
    }
  });
});
