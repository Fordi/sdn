import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  readFileSync,
  existsSync,
  writeFileSync,
  mkdtempSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnNodeScript, killProcessGroup } from "../testSupport.js";

const here = resolve(dirname(fileURLToPath(import.meta.url)), "../../src/service");
const serviceIndex = join(here, "index.js");

const makeServiceFixture = ({ appBody, name = "svcapp", hooksBody, appData } = {}) => {
  const root = mkdtempSync(join(tmpdir(), "sdn-service-test-"));
  appData = appData ?? mkdtempSync(join(tmpdir(), "sdn-service-test-appdata-"));
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify(
      {
        name,
        description: "d",
        main: "app.js",
        type: "module",
        config: { hooks: "./hooks.js", appData },
      },
      null,
      2,
    ),
    "utf8",
  );
  writeFileSync(join(root, "app.js"), appBody, "utf8");
  writeFileSync(
    join(root, "hooks.js"),
    hooksBody ?? [
      "import { appendFileSync } from 'node:fs';",
      "const log = process.env.SDN_TEST_HOOK_LOG;",
      "const record = (event) => (info) => appendFileSync(log, JSON.stringify({ event, info }) + '\\n');",
      "export const init = record('init');",
      "export const running = record('running');",
      "export const quit = record('quit');",
      "export const restart = record('restart');",
      "export const exit = record('exit');",
      "export const crash = record('crash');",
      "export const configUpdate = record('configUpdate');",
    ].join("\n"),
    "utf8",
  );
  return { root, appData };
};

const makeHookLog = () =>
  join(mkdtempSync(join(tmpdir(), "sdn-service-log-")), "hooks.log");

const readHookEvents = (log) =>
  existsSync(log)
    ? readFileSync(log, "utf8")
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line).event)
    : [];

const waitFor = async (
  predicate,
  { timeoutMs = 5000, intervalMs = 50 } = {},
) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
};

const cleanup = (...dirs) => {
  for (const dir of dirs) {
    rmSync(dir, { recursive: true, force: true });
  }
};

describe("service/index (the nodemon-backed service supervisor)", () => {
  it("fires init, configUpdate, and running hooks when the watched app starts", async (t) => {
    const { root, appData } = makeServiceFixture({
      appBody: "console.log('up'); setInterval(() => {}, 1000);",
    });
    const log = makeHookLog();
    const child = spawnNodeScript(serviceIndex, {
      args: [root],
      env: { SDN_TEST_HOOK_LOG: log },
    });
    t.after(() => {
      killProcessGroup(child);
      cleanup(root, appData, dirname(log));
    });
    const gotRunning = await waitFor(() =>
      readHookEvents(log).includes("running"),
    );
    assert.ok(gotRunning, "expected a 'running' hook event");
    const events = readHookEvents(log);
    assert.deepEqual(events, ["init", "configUpdate", "running"]);
  });

  it("fires the quit hook and exits when sent SIGINT", async (t) => {
    const { root, appData } = makeServiceFixture({
      appBody: "console.log('up'); setInterval(() => {}, 1000);",
    });
    const log = makeHookLog();
    const child = spawnNodeScript(serviceIndex, {
      args: [root],
      env: { SDN_TEST_HOOK_LOG: log },
    });
    t.after(() => {
      killProcessGroup(child);
      cleanup(root, appData, dirname(log));
    });
    await waitFor(() => readHookEvents(log).includes("running"));
    const exited = new Promise((resolve) => child.once("exit", resolve));
    killProcessGroup(child, "SIGINT");
    await exited;
    assert.deepEqual(readHookEvents(log), [
      "init",
      "configUpdate",
      "running",
      "quit",
    ]);
  });

  it("fires the crash hook when the watched app exits with a non-zero code", async (t) => {
    const { root, appData } = makeServiceFixture({
      appBody: "console.log('dying'); process.exit(1);",
    });
    const log = makeHookLog();
    const child = spawnNodeScript(serviceIndex, {
      args: [root],
      env: { SDN_TEST_HOOK_LOG: log },
    });
    t.after(() => {
      killProcessGroup(child);
      cleanup(root, appData, dirname(log));
    });
    const gotCrash = await waitFor(() =>
      readHookEvents(log).includes("crash"),
    );
    assert.ok(gotCrash, "expected a 'crash' hook event");
  });

  it("survives a rejecting async hook on a fire-and-forget event instead of crashing", async (t) => {
    const { root, appData } = makeServiceFixture({
      appBody: "console.log('up'); setInterval(() => {}, 1000);",
      hooksBody: [
        "export const running = async () => { throw new Error('running hook broke'); };",
      ].join("\n"),
    });
    const child = spawnNodeScript(serviceIndex, { args: [root] });
    t.after(() => {
      killProcessGroup(child);
      cleanup(root, appData);
    });

    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk; });

    const loggedFailure = await waitFor(() => stderr.includes("running hook broke"));
    assert.ok(loggedFailure, `expected the hook failure to be logged; got stderr: ${JSON.stringify(stderr)}`);

    // Give an unhandled rejection a moment to crash the process, if it were
    // going to -- then confirm it's still alive rather than merely that it
    // eventually exits (which would also be true of a crash).
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(child.exitCode, null, "expected the service to still be running, not crashed");

    const exited = new Promise((resolve) => child.once("exit", resolve));
    killProcessGroup(child, "SIGINT");
    await exited;
  });

  it("restarts the watched process when a file is written to appData", async (t) => {
    const { root, appData } = makeServiceFixture({
      appBody: "console.log('up'); setInterval(() => {}, 1000);",
    });
    const log = makeHookLog();
    const child = spawnNodeScript(serviceIndex, {
      args: [root],
      env: { SDN_TEST_HOOK_LOG: log },
    });
    t.after(() => {
      killProcessGroup(child);
      cleanup(root, appData, dirname(log));
    });

    await waitFor(() => readHookEvents(log).includes("running"));
    writeFileSync(join(appData, "config.json"), JSON.stringify({ custom: "value" }), "utf8");

    const restarted = await waitFor(() => readHookEvents(log).includes("restart"));
    assert.ok(restarted, `expected a 'restart' hook event; got ${JSON.stringify(readHookEvents(log))}`);
  });

  it("does not restart the watched process when only lastCrash.json changes in appData", async (t) => {
    const { root, appData } = makeServiceFixture({
      appBody: "console.log('up'); setInterval(() => {}, 1000);",
    });
    const log = makeHookLog();
    const child = spawnNodeScript(serviceIndex, {
      args: [root],
      env: { SDN_TEST_HOOK_LOG: log },
    });
    t.after(() => {
      killProcessGroup(child);
      cleanup(root, appData, dirname(log));
    });

    await waitFor(() => readHookEvents(log).includes("running"));
    writeFileSync(join(appData, "lastCrash.json"), JSON.stringify({ stale: true }), "utf8");

    // Give the watcher a chance to fire, if it were going to.
    await new Promise((r) => setTimeout(r, 300));
    assert.ok(
      !readHookEvents(log).includes("restart"),
      "expected no 'restart' hook event from a lastCrash.json change",
    );
  });
});
