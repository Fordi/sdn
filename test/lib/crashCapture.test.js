import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runNodeScript } from "../testSupport.js";
import { readLastCrash, clearLastCrash } from "../../src/lib/crashCapture.js";

const here = resolve(dirname(fileURLToPath(import.meta.url)), "../../src/lib");
const crashCaptureModule = join(here, "crashCapture.js");

const makeProject = () => {
  const root = mkdtempSync(join(tmpdir(), "sdn-crash-test-"));
  const appData = mkdtempSync(join(tmpdir(), "sdn-crash-test-appdata-"));
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({ name: "crashapp", description: "d", main: "app.js", config: { appData } }, null, 2),
    "utf8"
  );
  return { root, appData };
};

// installCrashHandler intentionally reproduces Node's default
// uncaughtException/unhandledRejection behavior (print + exit(1)) after
// stowing the report, since attaching any listener for those events
// otherwise suppresses that default. That means exercising it for real has
// to happen in a subprocess, not by invoking the listener in-process (which
// would tear down the test runner).
const makeCrashingScript = (root, { trigger }) =>
  [
    `import { installCrashHandler } from ${JSON.stringify(crashCaptureModule)};`,
    `installCrashHandler(${JSON.stringify(root)});`,
    trigger,
  ].join("\n");

const writeAndRun = (root, appData, trigger) => {
  const script = join(appData, "trigger.mjs");
  writeFileSync(script, makeCrashingScript(root, { trigger }), "utf8");
  return runNodeScript(script);
};

describe("crashCapture", () => {
  it("readLastCrash returns null when nothing has been stowed", () => {
    const { root, appData } = makeProject();
    try {
      assert.equal(readLastCrash(root), null);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(appData, { recursive: true, force: true });
    }
  });

  it("stows an uncaughtException and exits nonzero, as Node would by default", () => {
    const { root, appData } = makeProject();
    try {
      const result = writeAndRun(root, appData, "throw new Error('boom');");
      assert.notEqual(result.status, 0);
      const last = readLastCrash(root);
      assert.equal(last.type, "uncaughtException");
      assert.equal(last.error.message, "boom");
      assert.equal(last.error.name, "Error");
      assert.ok(last.error.stack.includes("boom"));
      assert.ok(last.time);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(appData, { recursive: true, force: true });
    }
  });

  it("stows an unhandledRejection and exits nonzero, as Node would by default", () => {
    const { root, appData } = makeProject();
    try {
      const result = writeAndRun(root, appData, "Promise.reject(new Error('rejected'));");
      assert.notEqual(result.status, 0);
      const last = readLastCrash(root);
      assert.equal(last.type, "unhandledRejection");
      assert.equal(last.error.message, "rejected");
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(appData, { recursive: true, force: true });
    }
  });

  it("serializes a non-Error rejection reason as a plain message", () => {
    const { root, appData } = makeProject();
    try {
      const result = writeAndRun(root, appData, "Promise.reject('just a string reason');");
      assert.notEqual(result.status, 0);
      const last = readLastCrash(root);
      assert.equal(last.error.message, "just a string reason");
      assert.equal(last.error.name, undefined);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(appData, { recursive: true, force: true });
    }
  });

  it("uninstall removes the listeners so a later exception is not stowed", () => {
    const { root, appData } = makeProject();
    const script = join(appData, "trigger.mjs");
    writeFileSync(
      script,
      [
        `import { installCrashHandler } from ${JSON.stringify(crashCaptureModule)};`,
        `const uninstall = installCrashHandler(${JSON.stringify(root)});`,
        "uninstall();",
        "throw new Error('should not be stowed');",
      ].join("\n"),
      "utf8"
    );
    try {
      const result = runNodeScript(script);
      assert.notEqual(result.status, 0);
      assert.equal(readLastCrash(root), null);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(appData, { recursive: true, force: true });
    }
  });

  it("clears a stale crash report as part of installing the handler", () => {
    const { root, appData } = makeProject();
    mkdirSync(appData, { recursive: true });
    writeFileSync(join(appData, "lastCrash.json"), JSON.stringify({ stale: true }), "utf8");
    try {
      assert.ok(existsSync(join(appData, "lastCrash.json")));
      const result = writeAndRun(root, appData, "console.log('booted clean');");
      assert.equal(result.status, 0, result.stderr);
      assert.equal(readLastCrash(root), null);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(appData, { recursive: true, force: true });
    }
  });

  it("clearLastCrash removes a stowed report", () => {
    const { root, appData } = makeProject();
    try {
      writeAndRun(root, appData, "throw new Error('boom');");
      assert.ok(readLastCrash(root));
      clearLastCrash(root);
      assert.equal(readLastCrash(root), null);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(appData, { recursive: true, force: true });
    }
  });

  it("clearLastCrash does not throw when there is nothing to clear", () => {
    const { root, appData } = makeProject();
    try {
      assert.doesNotThrow(() => clearLastCrash(root));
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(appData, { recursive: true, force: true });
    }
  });
});
