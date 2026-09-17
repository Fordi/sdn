import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

const makeFixture = () => {
  const root = mkdtempSync(join(tmpdir(), "sdn-alias-test-"));
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({ name: "myproject", description: "d", main: "index.js" }, null, 2),
    "utf8"
  );
  return root;
};

const makeFakeSystemctl = () => {
  const binDir = mkdtempSync(join(tmpdir(), "sdn-alias-bin-"));
  const script = join(binDir, "systemctl");
  writeFileSync(script, "#!/usr/bin/env bash\necho \"$@\"\n", "utf8");
  chmodSync(script, 0o755);
  return binDir;
};

const runAlias = (name, root, binDir) => {
  const result = spawnSync(process.execPath, [join(here, `${name}.js`)], {
    cwd: root,
    env: { ...process.env, PATH: `${binDir}:${process.env.PATH}` },
    encoding: "utf8",
  });
  return result.stdout.trim().split("\n").pop();
};

describe("service command aliases", () => {
  it("start calls systemctl --user start <name>", () => {
    const root = makeFixture();
    const binDir = makeFakeSystemctl();
    try {
      assert.equal(runAlias("start", root, binDir), "--user start myproject");
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(binDir, { recursive: true, force: true });
    }
  });

  it("stop calls systemctl --user stop <name>", () => {
    const root = makeFixture();
    const binDir = makeFakeSystemctl();
    try {
      assert.equal(runAlias("stop", root, binDir), "--user stop myproject");
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(binDir, { recursive: true, force: true });
    }
  });

  it("restart calls systemctl --user restart <name>", () => {
    const root = makeFixture();
    const binDir = makeFakeSystemctl();
    try {
      assert.equal(runAlias("restart", root, binDir), "--user restart myproject");
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(binDir, { recursive: true, force: true });
    }
  });

  it("status calls systemctl --user status <name>", () => {
    const root = makeFixture();
    const binDir = makeFakeSystemctl();
    try {
      assert.equal(runAlias("status", root, binDir), "--user status myproject");
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(binDir, { recursive: true, force: true });
    }
  });

  it("reload calls systemctl --user daemon-reload (not scoped to the service)", () => {
    const root = makeFixture();
    const binDir = makeFakeSystemctl();
    try {
      assert.equal(runAlias("reload", root, binDir), "--user daemon-reload");
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(binDir, { recursive: true, force: true });
    }
  });
});
