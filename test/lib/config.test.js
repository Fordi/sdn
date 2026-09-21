import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { getConfig } from "../../src/lib/config.js";

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

describe("getConfig appData", () => {
  it("defaults appData to ~/.local/state/{name}", () => {
    const root = makeFixture({ name: "app", description: "d", main: "m.js" });
    try {
      const { config } = getConfig(root);
      assert.equal(config.appData, resolve(homedir(), ".local", "state", "app"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("uses the scoped-stripped name for the default appData dir", () => {
    const root = makeFixture({ name: "@fordi-org/sdn", description: "d", main: "m.js" });
    try {
      const { config } = getConfig(root);
      assert.equal(config.appData, resolve(homedir(), ".local", "state", "sdn"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("honors an explicit appData override in config", () => {
    const appData = mkdtempSync(join(tmpdir(), "sdn-appdata-test-"));
    const root = makeFixture({ name: "app", description: "d", main: "m.js", config: { appData } });
    try {
      const { config } = getConfig(root);
      assert.equal(config.appData, appData);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(appData, { recursive: true, force: true });
    }
  });

  it("deep-merges appData/config.json over the base config", () => {
    const appData = mkdtempSync(join(tmpdir(), "sdn-appdata-test-"));
    writeFileSync(
      join(appData, "config.json"),
      JSON.stringify({ nested: { a: 1 }, top: "overridden" }),
      "utf8"
    );
    const root = makeFixture({
      name: "app",
      description: "d",
      main: "m.js",
      config: { appData, top: "original", nested: { a: 0, b: 2 } },
    });
    try {
      const { config } = getConfig(root);
      assert.equal(config.top, "overridden");
      assert.deepEqual(config.nested, { a: 1, b: 2 });
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(appData, { recursive: true, force: true });
    }
  });

  it("does not fail when appData/config.json is absent", () => {
    const appData = mkdtempSync(join(tmpdir(), "sdn-appdata-test-"));
    const root = makeFixture({ name: "app", description: "d", main: "m.js", config: { appData } });
    try {
      assert.doesNotThrow(() => getConfig(root));
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(appData, { recursive: true, force: true });
    }
  });
});

describe("getConfig preprocess", () => {
  it("defaults to identity when no preprocess function is given", () => {
    const root = makeFixture({ name: "app", description: "d", main: "m.js", config: { custom: "value" } });
    try {
      const { config } = getConfig(root);
      assert.equal(config.custom, "value");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("preprocesses the package.json inline config block with its own path", () => {
    const root = makeFixture({ name: "app", description: "d", main: "m.js", config: { rel: "./x" } });
    const calls = [];
    try {
      const { config } = getConfig(root, (obj, path) => {
        calls.push(path);
        return obj;
      });
      assert.equal(calls[0], resolve(root, "package.json"));
      assert.equal(config.rel, "./x");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("preprocesses the config.from file with its own path", () => {
    const root = makeFixture(
      { name: "app", description: "d", main: "m.js", config: { from: "extra.json" } },
      { extraFiles: { "extra.json": JSON.stringify({ from: "extra.json", rel: "./y" }) } }
    );
    const calls = [];
    try {
      getConfig(root, (obj, path) => {
        calls.push(path);
        return obj;
      });
      assert.deepEqual(calls, [
        resolve(root, "package.json"),
        resolve(root, "extra.json"),
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("preprocesses the appData/config.json overlay with its own path", () => {
    const appData = mkdtempSync(join(tmpdir(), "sdn-appdata-test-"));
    writeFileSync(join(appData, "config.json"), JSON.stringify({ rel: "./z" }), "utf8");
    const root = makeFixture({ name: "app", description: "d", main: "m.js", config: { appData } });
    const calls = [];
    try {
      getConfig(root, (obj, path) => {
        calls.push(path);
        return obj;
      });
      assert.deepEqual(calls, [
        resolve(root, "package.json"),
        resolve(appData, "config.json"),
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(appData, { recursive: true, force: true });
    }
  });

  it("uses the object returned by preprocess, allowing fields to be rewritten (e.g. resolved relative to their source file)", () => {
    const root = makeFixture({
      name: "app",
      description: "d",
      main: "m.js",
      config: { from: "extra.json" },
    }, {
      extraFiles: { "extra.json": JSON.stringify({ from: "extra.json", rel: "./sub" }) },
    });
    try {
      const { config } = getConfig(root, (obj, path) =>
        obj.rel ? { ...obj, rel: resolve(dirname(path), obj.rel) } : obj
      );
      assert.equal(config.rel, resolve(root, "sub"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("getConfig.relative", () => {
  // getConfig.relative() registers dotted paths in module-level, process-global
  // state (it's meant to be called once at app bootstrap, not toggled per
  // call) -- so each test below registers its own uniquely-named path to
  // avoid interfering with other tests in this file or process.

  it("resolves a top-level registered path relative to package.json's directory", () => {
    getConfig.relative("relTop1");
    const root = makeFixture({ name: "app", description: "d", main: "m.js", config: { relTop1: "./sub/thing" } });
    try {
      const { config } = getConfig(root);
      assert.equal(config.relTop1, resolve(root, "sub/thing"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("resolves a nested dotted path", () => {
    getConfig.relative("nested1.rel");
    const root = makeFixture({
      name: "app", description: "d", main: "m.js",
      config: { nested1: { rel: "./nested/path" } },
    });
    try {
      const { config } = getConfig(root);
      assert.equal(config.nested1.rel, resolve(root, "nested/path"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("leaves an unregistered path untouched", () => {
    const root = makeFixture({ name: "app", description: "d", main: "m.js", config: { untouched1: "./x" } });
    try {
      const { config } = getConfig(root);
      assert.equal(config.untouched1, "./x");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does nothing when the registered path is absent from a given layer", () => {
    getConfig.relative("maybeAbsent1");
    const root = makeFixture({ name: "app", description: "d", main: "m.js" });
    try {
      assert.doesNotThrow(() => getConfig(root));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("relativizes each layer against its own source file, not package.json for all of them", () => {
    getConfig.relative("relLayer1");
    const root = makeFixture(
      { name: "app", description: "d", main: "m.js", config: { from: "extra.json" } },
      { extraFiles: { "extra.json": JSON.stringify({ from: "extra.json", relLayer1: "./from-extra" }) } }
    );
    try {
      const { config } = getConfig(root);
      assert.equal(config.relLayer1, resolve(root, "from-extra"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("relativizes the appData/config.json overlay against the appData directory", () => {
    getConfig.relative("relLayer2");
    const appData = mkdtempSync(join(tmpdir(), "sdn-appdata-test-"));
    mkdirSync(join(appData, "sub"), { recursive: true });
    writeFileSync(join(appData, "config.json"), JSON.stringify({ relLayer2: "./sub" }), "utf8");
    const root = makeFixture({ name: "app", description: "d", main: "m.js", config: { appData } });
    try {
      const { config } = getConfig(root);
      assert.equal(config.relLayer2, resolve(appData, "sub"));
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(appData, { recursive: true, force: true });
    }
  });

  it("runs relativization before the caller's preprocess function", () => {
    getConfig.relative("relThenPre1");
    const root = makeFixture({ name: "app", description: "d", main: "m.js", config: { relThenPre1: "./sub" } });
    const seen = [];
    try {
      getConfig(root, (obj) => {
        seen.push(obj.relThenPre1);
        return obj;
      });
      assert.equal(seen[0], resolve(root, "sub"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("getConfig watchPaths", () => {
  it("is empty when config.from is unset and nothing is relativized", () => {
    const root = makeFixture({ name: "app", description: "d", main: "m.js" });
    try {
      const { config } = getConfig(root);
      assert.deepEqual(config.watchPaths, []);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("includes the config.from file when set", () => {
    const root = makeFixture(
      { name: "app", description: "d", main: "m.js", config: { from: "extra.json" } },
      { extraFiles: { "extra.json": JSON.stringify({ from: "extra.json" }) } }
    );
    try {
      const { config } = getConfig(root);
      assert.deepEqual(config.watchPaths, [resolve(root, "extra.json")]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("includes the resolved value of each relativized path", () => {
    getConfig.relative("watchRel1");
    const root = makeFixture({ name: "app", description: "d", main: "m.js", config: { watchRel1: "./sub" } });
    try {
      const { config } = getConfig(root);
      assert.deepEqual(config.watchPaths, [resolve(root, "sub")]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("collects paths from every layer they appear in", () => {
    getConfig.relative("watchRel2");
    const appData = mkdtempSync(join(tmpdir(), "sdn-appdata-test-"));
    writeFileSync(join(appData, "config.json"), JSON.stringify({ watchRel2: "./from-appdata" }), "utf8");
    const root = makeFixture(
      { name: "app", description: "d", main: "m.js", config: { from: "extra.json", appData } },
      { extraFiles: { "extra.json": JSON.stringify({ from: "extra.json" }) } }
    );
    try {
      const { config } = getConfig(root);
      assert.ok(config.watchPaths.includes(resolve(root, "extra.json")));
      assert.ok(config.watchPaths.includes(resolve(appData, "from-appdata")));
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(appData, { recursive: true, force: true });
    }
  });

  it("is frozen", () => {
    const root = makeFixture({ name: "app", description: "d", main: "m.js" });
    try {
      const { config } = getConfig(root);
      assert.throws(() => { config.watchPaths.push("nope"); });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("getConfig.setRoot", () => {
  // getConfig.setRoot() mutates a single module-level default, so every test
  // here must restore it in `finally` or later tests (including in other
  // files run in this same process) that call getConfig() with no argument
  // would silently pick up a stale root.

  it("is used as root when getConfig() is called with no argument", () => {
    const root = makeFixture({ name: "app", description: "d", main: "m.js" });
    try {
      getConfig.setRoot(root);
      const { config } = getConfig();
      assert.equal(config.root, root);
    } finally {
      getConfig.setRoot(undefined);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("is used when getConfig(undefined) is called explicitly", () => {
    const root = makeFixture({ name: "app", description: "d", main: "m.js" });
    try {
      getConfig.setRoot(root);
      const { config } = getConfig(undefined);
      assert.equal(config.root, root);
    } finally {
      getConfig.setRoot(undefined);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not override an explicitly passed root", () => {
    const defaultProject = makeFixture({ name: "default-app", description: "d", main: "m.js" });
    const explicitProject = makeFixture({ name: "explicit-app", description: "d", main: "m.js" });
    try {
      getConfig.setRoot(defaultProject);
      const { config } = getConfig(explicitProject);
      assert.equal(config.root, explicitProject);
      assert.equal(config.name, "explicit-app");
    } finally {
      getConfig.setRoot(undefined);
      rmSync(defaultProject, { recursive: true, force: true });
      rmSync(explicitProject, { recursive: true, force: true });
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
