import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runNodeScript } from "../testSupport.js";

const here = resolve(dirname(fileURLToPath(import.meta.url)), "../../src/lib");
const runMain = join(here, "runMain.js");

const makeProject = ({ mainBody, name = "runmainapp" } = {}) => {
  const root = mkdtempSync(join(tmpdir(), "sdn-runmain-test-"));
  const appData = mkdtempSync(join(tmpdir(), "sdn-runmain-test-appdata-"));
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify(
      { name, description: "d", main: "app.js", type: "module", config: { appData } },
      null,
      2
    ),
    "utf8"
  );
  writeFileSync(join(root, "app.js"), mainBody, "utf8");
  return { root, appData };
};

describe("runMain (the crash-instrumented entry point nodemon actually runs)", () => {
  it("imports and runs the project's configured main script", () => {
    const { root, appData } = makeProject({
      mainBody: "console.log('main ran');",
    });
    try {
      const result = runNodeScript(runMain, { args: [root] });
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /main ran/);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(appData, { recursive: true, force: true });
    }
  });

  it("passes extra argv through to the main script untouched", () => {
    const { root, appData } = makeProject({
      mainBody: "console.log(JSON.stringify(process.argv.slice(2)));",
    });
    try {
      const result = runNodeScript(runMain, { args: [root, "--flag", "value"] });
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(JSON.parse(result.stdout.trim()), ["--flag", "value"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(appData, { recursive: true, force: true });
    }
  });

  it("installs the crash handler so an uncaught exception in main is stowed to lastCrash.json", () => {
    const { root, appData } = makeProject({
      mainBody: "throw new Error('boom from main');",
    });
    try {
      const result = runNodeScript(runMain, { args: [root] });
      assert.notEqual(result.status, 0);
      const lastCrashFile = join(appData, "lastCrash.json");
      assert.ok(existsSync(lastCrashFile), "expected lastCrash.json to be written");
      const report = JSON.parse(readFileSync(lastCrashFile, "utf8"));
      assert.equal(report.type, "uncaughtException");
      assert.match(report.error.message, /boom from main/);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(appData, { recursive: true, force: true });
    }
  });

  it("clears a stale crash report from a previous run before starting main", () => {
    const { root, appData } = makeProject({
      mainBody: "console.log('clean run');",
    });
    mkdirSync(appData, { recursive: true });
    writeFileSync(join(appData, "lastCrash.json"), JSON.stringify({ stale: true }), "utf8");
    try {
      const result = runNodeScript(runMain, { args: [root] });
      assert.equal(result.status, 0, result.stderr);
      assert.ok(!existsSync(join(appData, "lastCrash.json")));
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(appData, { recursive: true, force: true });
    }
  });
});
