import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHook } from "../../src/lib/hooks.js";

const makeProject = ({ hooksBody, hooksPath = "hooks.js", packageExtra = {} } = {}) => {
  const root = mkdtempSync(join(tmpdir(), "sdn-hooks-test-"));
  const pkg = {
    name: "fixture-project",
    version: "1.0.0",
    main: "index.js",
    ...packageExtra,
  };
  if (hooksBody !== undefined) {
    pkg.config = { hooks: `./${hooksPath}`, ...(packageExtra.config ?? {}) };
    mkdirSync(join(root, ...hooksPath.split("/").slice(0, -1)), { recursive: true });
    writeFileSync(join(root, hooksPath), hooksBody, "utf8");
  }
  writeFileSync(join(root, "package.json"), JSON.stringify(pkg, null, 2), "utf8");
  return root;
};

describe("createHook", () => {
  it("fires the matching exported handler with the given info", async () => {
    const calls = [];
    const root = makeProject({
      hooksBody: `export const running = (info) => { globalThis.__hookCalls.push(["running", info]); };`,
    });
    globalThis.__hookCalls = calls;
    try {
      const hook = createHook(root);
      await hook("running", { pid: 123 });
      assert.deepEqual(calls, [["running", { pid: 123 }]]);
    } finally {
      delete globalThis.__hookCalls;
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("silently skips events with no matching export", async () => {
    const root = makeProject({
      hooksBody: `export const running = () => { throw new Error("should not be called"); };`,
    });
    try {
      const hook = createHook(root);
      await assert.doesNotReject(() => hook("crash", null));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does nothing when the project has no hooks configured", async () => {
    const root = makeProject();
    try {
      const hook = createHook(root);
      await assert.doesNotReject(() => hook("running", null));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("resolves the hooks file relative to the project root, not a nested subdirectory passed in", async () => {
    const calls = [];
    const root = makeProject({
      hooksPath: "service/hooks.js",
      hooksBody: `export const running = (info) => { globalThis.__hookCalls.push(["running", info]); };`,
    });
    globalThis.__hookCalls = calls;
    const nested = join(root, "src", "nested");
    mkdirSync(nested, { recursive: true });
    try {
      const hook = createHook(nested);
      await hook("running", "ok");
      assert.deepEqual(calls, [["running", "ok"]]);
    } finally {
      delete globalThis.__hookCalls;
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("accepts a file path and resolves hooks relative to its containing project", async () => {
    const calls = [];
    const root = makeProject({
      hooksBody: `export const running = (info) => { globalThis.__hookCalls.push(["running", info]); };`,
    });
    globalThis.__hookCalls = calls;
    const entryFile = join(root, "index.js");
    writeFileSync(entryFile, "// entry point\n", "utf8");
    try {
      const hook = createHook(entryFile);
      await hook("running", null);
      assert.deepEqual(calls, [["running", null]]);
    } finally {
      delete globalThis.__hookCalls;
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("awaits an async handler before resolving", async () => {
    const root = makeProject({
      hooksBody: [
        "export const running = async (info) => {",
        "  await new Promise((r) => setTimeout(r, 20));",
        "  globalThis.__hookCalls.push(info);",
        "};",
      ].join("\n"),
    });
    globalThis.__hookCalls = [];
    try {
      const hook = createHook(root);
      await hook("running", "done");
      assert.deepEqual(globalThis.__hookCalls, ["done"]);
    } finally {
      delete globalThis.__hookCalls;
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("propagates a rejection from an async handler to the caller", async () => {
    const root = makeProject({
      hooksBody: `export const crash = async () => { throw new Error("handler blew up"); };`,
    });
    try {
      const hook = createHook(root);
      await assert.rejects(() => hook("crash", null), /handler blew up/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("bump() changes the version query param so edited hook files are re-imported", async () => {
    const root = makeProject({
      hooksBody: `export const running = (info) => { globalThis.__hookCalls.push(info); };`,
    });
    globalThis.__hookCalls = [];
    try {
      const hook = createHook(root);
      await hook("running", "v0");
      writeFileSync(
        join(root, "hooks.js"),
        `export const running = (info) => { globalThis.__hookCalls.push("v1:" + info); };`,
        "utf8"
      );
      await hook.bump("running", "v1");
      assert.deepEqual(globalThis.__hookCalls, ["v0", "v1:v1"]);
    } finally {
      delete globalThis.__hookCalls;
      rmSync(root, { recursive: true, force: true });
    }
  });
});
