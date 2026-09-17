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
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnNodeScript, killProcessGroup } from "./testSupport.js";

const here = dirname(fileURLToPath(import.meta.url));
const serviceIndex = join(here, "index.js");

const makeServiceFixture = ({ appBody, name = "svcapp" } = {}) => {
  const root = mkdtempSync(join(tmpdir(), "sdn-service-test-"));
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify(
      {
        name,
        description: "d",
        main: "app.js",
        type: "module",
        config: { hooks: "./hooks.js" },
      },
      null,
      2,
    ),
    "utf8",
  );
  writeFileSync(join(root, "app.js"), appBody, "utf8");
  writeFileSync(
    join(root, "hooks.js"),
    [
      "import { appendFileSync } from 'node:fs';",
      "const log = process.env.SDN_TEST_HOOK_LOG;",
      "const record = (event) => (info) => appendFileSync(log, JSON.stringify({ event, info }) + '\\n');",
      "export const init = record('init');",
      "export const running = record('running');",
      "export const quit = record('quit');",
      "export const restart = record('restart');",
      "export const exit = record('exit');",
      "export const crash = record('crash');",
      "const configUpdate = record('config:update');",
      "export { configUpdate as 'config:update' };",
    ].join("\n"),
    "utf8",
  );
  return root;
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
  it("fires init, config:update, and running hooks when the watched app starts", async (t) => {
    const root = makeServiceFixture({
      appBody: "console.log('up'); setInterval(() => {}, 1000);",
    });
    const log = makeHookLog();
    const child = spawnNodeScript(serviceIndex, {
      args: [root],
      env: { SDN_TEST_HOOK_LOG: log },
    });
    t.after(() => {
      killProcessGroup(child);
      cleanup(root, dirname(log));
    });
    const gotRunning = await waitFor(() =>
      readHookEvents(log).includes("running"),
    );
    assert.ok(gotRunning, "expected a 'running' hook event");
    const events = readHookEvents(log);
    assert.deepEqual(events, ["init", "config:update", "running"]);
  });

  it("fires the quit hook and exits when sent SIGINT", async (t) => {
    const root = makeServiceFixture({
      appBody: "console.log('up'); setInterval(() => {}, 1000);",
    });
    const log = makeHookLog();
    const child = spawnNodeScript(serviceIndex, {
      args: [root],
      env: { SDN_TEST_HOOK_LOG: log },
    });
    t.after(() => {
      killProcessGroup(child);
      cleanup(root, dirname(log));
    });
    await waitFor(() => readHookEvents(log).includes("running"));
    const exited = new Promise((resolve) => child.once("exit", resolve));
    killProcessGroup(child, "SIGINT");
    await exited;
    assert.deepEqual(readHookEvents(log), [
      "init",
      "config:update",
      "running",
      "quit",
    ]);
  });

  it("fires the crash hook when the watched app exits with a non-zero code", async (t) => {
    const root = makeServiceFixture({
      appBody: "console.log('dying'); process.exit(1);",
    });
    const log = makeHookLog();
    const child = spawnNodeScript(serviceIndex, {
      args: [root],
      env: { SDN_TEST_HOOK_LOG: log },
    });
    t.after(() => {
      killProcessGroup(child);
      cleanup(root, dirname(log));
    });
    const gotCrash = await waitFor(() =>
      readHookEvents(log).includes("crash"),
    );
    assert.ok(gotCrash, "expected a 'crash' hook event");
  });
});
