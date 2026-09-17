import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { isMain } from "./isMain.js";

describe("isMain", () => {
  it("returns true when the given URL resolves to the currently running script", () => {
    const originalArgv1 = process.argv[1];
    process.argv[1] = "/tmp/some/script.js";
    try {
      assert.equal(isMain(pathToFileURL("/tmp/some/script.js").href), true);
    } finally {
      process.argv[1] = originalArgv1;
    }
  });

  it("returns false when the given URL does not match the running script", () => {
    const originalArgv1 = process.argv[1];
    process.argv[1] = "/tmp/some/other-script.js";
    try {
      assert.equal(isMain(pathToFileURL("/tmp/some/script.js").href), false);
    } finally {
      process.argv[1] = originalArgv1;
    }
  });
});
