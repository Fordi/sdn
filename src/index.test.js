import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runCli } from "./index.js";

describe("runCli", () => {
  it("warns and exits with -1 when no command is given", async () => {
    const warnings = [];
    const exits = [];
    await runCli({
      argv: ["node", "/path/to/sdn"],
      execPath: "node",
      cwd: "/some/project",
      warn: (msg) => warnings.push(msg),
      exit: (code) => exits.push(code),
      findLocalInstall: () => null,
      config: { root: "/own/root" },
      PACKAGE: { name: "@fordi-org/sdn" },
    });
    assert.deepEqual(warnings, ["sdn {command} ..."]);
    assert.deepEqual(exits, [-1]);
  });

  it("does not run a service script when no command is given", async () => {
    let ran = false;
    await runCli({
      argv: ["node", "/path/to/sdn"],
      execPath: "node",
      cwd: "/some/project",
      warn: () => {},
      exit: () => {},
      findLocalInstall: () => null,
      config: { root: "/own/root" },
      PACKAGE: { name: "@fordi-org/sdn" },
      runScript: async () => { ran = true; },
    });
    assert.equal(ran, false);
  });

  it("delegates to a local install when one is found, and exits with its status", async () => {
    const spawnCalls = [];
    const exits = [];
    await runCli({
      argv: ["node", "/path/to/sdn", "start", "extra-arg"],
      execPath: "/usr/bin/node",
      cwd: "/some/project",
      exit: (code) => exits.push(code),
      findLocalInstall: () => "/some/project/node_modules/@fordi-org/sdn",
      spawnSync: (cmd, args, opts) => {
        spawnCalls.push({ cmd, args, opts });
        return { status: 0 };
      },
      config: { root: "/own/root" },
      PACKAGE: { name: "@fordi-org/sdn" },
      runScript: async () => { throw new Error("should not run a script when delegating"); },
    });
    assert.equal(spawnCalls.length, 1);
    assert.equal(spawnCalls[0].cmd, "/usr/bin/node");
    assert.deepEqual(spawnCalls[0].args, [
      "/some/project/node_modules/@fordi-org/sdn/src/index.js",
      "start",
      "extra-arg",
    ]);
    assert.deepEqual(spawnCalls[0].opts, { stdio: "inherit" });
    assert.deepEqual(exits, [0]);
  });

  it("exits with 1 when delegation's spawnSync reports no status", async () => {
    const exits = [];
    await runCli({
      argv: ["node", "/path/to/sdn", "start"],
      execPath: "node",
      cwd: "/some/project",
      exit: (code) => exits.push(code),
      findLocalInstall: () => "/some/project/node_modules/@fordi-org/sdn",
      spawnSync: () => ({ status: null }),
      config: { root: "/own/root" },
      PACKAGE: { name: "@fordi-org/sdn" },
    });
    assert.deepEqual(exits, [1]);
  });

  it("runs the matching service script when no local install is found", async () => {
    const ranScripts = [];
    await runCli({
      argv: ["node", "/path/to/sdn", "start"],
      execPath: "node",
      cwd: "/some/project",
      findLocalInstall: () => null,
      config: { root: "/own/root" },
      PACKAGE: { name: "@fordi-org/sdn" },
      serviceScriptUrl: (cmd) => new URL(`file:///fake/service/${cmd}.js`),
      runScript: async (script) => { ranScripts.push(script); },
    });
    assert.deepEqual(ranScripts, ["/fake/service/start.js"]);
  });

  it("does not call spawnSync when no local install is found", async () => {
    const spawnCalls = [];
    await runCli({
      argv: ["node", "/path/to/sdn", "start"],
      execPath: "node",
      cwd: "/some/project",
      findLocalInstall: () => null,
      spawnSync: (...args) => { spawnCalls.push(args); return { status: 0 }; },
      config: { root: "/own/root" },
      PACKAGE: { name: "@fordi-org/sdn" },
      runScript: async () => {},
    });
    assert.deepEqual(spawnCalls, []);
  });
});
