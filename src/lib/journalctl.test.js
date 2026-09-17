import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { journalctl } from "./journalctl.js";

describe("journalctl", () => {
  it("returns an async generator without spawning a process until iterated", (t) => {
    t.mock.method(console, "info", () => {});
    const gen = journalctl({ name: "myproject" });
    assert.equal(typeof gen.next, "function");
    assert.equal(console.info.mock.callCount(), 1);
  });

  it("logs a journalctl invocation scoped to the project's unit name", (t) => {
    t.mock.method(console, "info", () => {});
    journalctl({ name: "myproject" });
    const [line] = console.info.mock.calls[0].arguments;
    assert.equal(line, "> journalctl --user-unit myproject -o json -e -f");
  });

  it("adds a --user-unit flag for each entry in project.otherUnits", (t) => {
    t.mock.method(console, "info", () => {});
    journalctl({ name: "myproject", otherUnits: ["sidecar", "worker"] });
    const [line] = console.info.mock.calls[0].arguments;
    assert.equal(
      line,
      "> journalctl --user-unit myproject --user-unit sidecar --user-unit worker -o json -e -f"
    );
  });
});
