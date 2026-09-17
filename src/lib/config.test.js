import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getConfig } from "./config.js";

const makeFixture = (pkg, { extraFiles = {} } = {}) => {
  const root = mkdtempSync(join(tmpdir(), "sdn-config-test-"));
  writeFileSync(join(root, "package.json"), JSON.stringify(pkg, null, 2), "utf8");
  for (const [relPath, contents] of Object.entries(extraFiles)) {
    writeFileSync(join(root, relPath), contents, "utf8");
  }
  return root;
};

describe("getConfig", () => {
  it("throws when no package.json is found walking up to root", () => {
    const isolated = mkdtempSync(join(tmpdir(), "sdn-config-test-noroot-"));
    const nested = join(isolated, "a", "b", "c");
    mkdirSync(nested, { recursive: true });
    try {
      assert.throws(() => getConfig(nested), /Not in an npm project/);
    } finally {
      rmSync(isolated, { recursive: true, force: true });
    }
  });

  it("walks up from a nested directory to find package.json", () => {
    const root = makeFixture({ name: "unscoped-app", description: "desc", main: "main.js" });
    const nested = join(root, "nested", "deeper");
    mkdirSync(nested, { recursive: true });
    try {
      const { config } = getConfig(nested);
      assert.equal(config.root, root);
      assert.equal(config.name, "unscoped-app");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("splits a scoped package name into name and org", () => {
    const root = makeFixture({ name: "@fordi-org/sdn", description: "d", main: "m.js" });
    try {
      const { config } = getConfig(root);
      assert.equal(config.name, "sdn");
      assert.equal(config.org, "fordi-org");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("leaves org undefined for an unscoped package name", () => {
    const root = makeFixture({ name: "plain-name", description: "d", main: "m.js" });
    try {
      const { config } = getConfig(root);
      assert.equal(config.name, "plain-name");
      assert.equal(config.org, undefined);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("defaults config.from to package.json when unset", () => {
    const root = makeFixture({ name: "app", description: "d", main: "m.js" });
    try {
      const { config } = getConfig(root);
      assert.equal(config.from, "package.json");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("merges an external config file named by config.from", () => {
    const root = makeFixture(
      { name: "app", description: "d", main: "m.js", config: { from: "extra.json" } },
      { extraFiles: { "extra.json": JSON.stringify({ from: "extra.json", extraKey: "extraVal" }) } }
    );
    try {
      const { config } = getConfig(root);
      assert.equal(config.from, "extra.json");
      assert.equal(config.extraKey, "extraVal");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("falls back to package.json when config.from points at a missing file", () => {
    const root = makeFixture({
      name: "app",
      description: "d",
      main: "m.js",
      config: { from: "missing.json", custom: "value" },
    });
    try {
      const { config } = getConfig(root);
      assert.equal(config.from, "package.json");
      assert.equal(config.custom, "value");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("freezes both config and PACKAGE", () => {
    const root = makeFixture({ name: "app", description: "d", main: "m.js" });
    try {
      const { config, PACKAGE } = getConfig(root);
      assert.throws(() => { config.name = "changed"; });
      assert.throws(() => { PACKAGE.name = "changed"; });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("config.package mirrors the original package.json fields", () => {
    const root = makeFixture({ name: "app", description: "d", main: "m.js" });
    try {
      const { config } = getConfig(root);
      assert.equal(config.package.name, "app");
      assert.equal(config.package.main, "m.js");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("ConfigError", () => {
  it("formats a message with 'needed' fields", () => {
    const root = makeFixture({ name: "app", description: "d", main: "m.js" });
    try {
      const { config, ConfigError } = getConfig(root);
      const err = new ConfigError("Missing stuff", { foo: "a string", bar: "a number" });
      assert.match(err.message, /Missing stuff; Please add the following to package\.json/);
      assert.match(err.message, /"foo": a string/);
      assert.match(err.message, /"bar": a number/);
      assert.ok(config.Error === ConfigError);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("formats a plain message without 'needed' fields", () => {
    const root = makeFixture({ name: "app", description: "d", main: "m.js" });
    try {
      const { ConfigError } = getConfig(root);
      const err = new ConfigError("Something is wrong");
      assert.equal(err.message, "Something is wrong; please check package.json");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
})
