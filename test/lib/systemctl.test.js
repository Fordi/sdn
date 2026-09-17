import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { systemctl } from "../../src/lib/systemctl.js";
import { makeFakeSystemctl } from "../testSupport.js";

describe("systemctl", () => {
  it("runs systemctl --user <cmd> <project.name> for a given cmd", (t) => {
    const { binDir, calls } = makeFakeSystemctl();
    const originalPath = process.env.PATH;
    process.env.PATH = `${binDir}:${originalPath}`;
    t.after(() => {
      process.env.PATH = originalPath;
      rmSync(binDir, { recursive: true, force: true });
    });

    systemctl({ name: "myproject" }, ["start"]);
    assert.deepEqual(calls(), ["--user start myproject"]);
  });

  it("omits the project name when cmd is falsy, passing remaining args through", (t) => {
    const { binDir, calls } = makeFakeSystemctl();
    const originalPath = process.env.PATH;
    process.env.PATH = `${binDir}:${originalPath}`;
    t.after(() => {
      process.env.PATH = originalPath;
      rmSync(binDir, { recursive: true, force: true });
    });

    systemctl({ name: "myproject" }, ["", "daemon-reload"]);
    assert.deepEqual(calls(), ["--user daemon-reload"]);
  });

  it("logs the shell-quoted invocation before running it", (t) => {
    t.mock.method(console, "info", () => {});
    const { binDir, calls } = makeFakeSystemctl();
    const originalPath = process.env.PATH;
    process.env.PATH = `${binDir}:${originalPath}`;
    t.after(() => {
      process.env.PATH = originalPath;
      rmSync(binDir, { recursive: true, force: true });
    });

    systemctl({ name: "myproject" }, ["status"]);
    const [line] = console.info.mock.calls[0].arguments;
    assert.equal(line, "> systemctl --user status myproject");
  });
});
