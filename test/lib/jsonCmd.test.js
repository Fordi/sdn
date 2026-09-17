import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { jsonCmd } from "../../src/lib/jsonCmd.js";

const collect = async (cmd, args) => {
  const results = [];
  for await (const value of jsonCmd(cmd, args)) {
    results.push(value);
  }
  return results;
};

describe("jsonCmd", () => {
  it("yields one parsed value per newline-delimited JSON line of stdout", async () => {
    const results = await collect("node", [
      "-e",
      "console.log(JSON.stringify({a:1})); console.log(JSON.stringify({b:2}));",
    ]);
    assert.deepEqual(results, [{ a: 1 }, { b: 2 }]);
  });

  it("yields a final line even without a trailing newline", async () => {
    const results = await collect("node", ["-e", "process.stdout.write(JSON.stringify({a:1}))"]);
    assert.deepEqual(results, [{ a: 1 }]);
  });

  it("yields a parseError object for a non-JSON line instead of throwing", async () => {
    const results = await collect("node", ["-e", "console.log('not json')"]);
    assert.equal(results.length, 1);
    assert.ok(results[0].parseError instanceof SyntaxError);
    assert.equal(results[0].input, "not json\n");
  });

  it("reads JSON lines from both stdout and stderr", async () => {
    const results = await collect("node", [
      "-e",
      "console.error(JSON.stringify({err:true})); console.log(JSON.stringify({out:true}));",
    ]);
    assert.equal(results.length, 2);
    assert.deepEqual(
      results.sort((a, b) => a.err === b.err ? 0 : a.err ? -1 : 1),
      [{ err: true }, { out: true }]
    );
  });

  it("yields nothing for a process with no output", async () => {
    const results = await collect("node", ["-e", ""]);
    assert.deepEqual(results, []);
  });

  it("completes cleanly even when the process exits with a non-zero code", async () => {
    const results = await collect("node", ["-e", "console.log(JSON.stringify({a:1})); process.exit(3);"]);
    assert.deepEqual(results, [{ a: 1 }]);
  });
});
