import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { mkdtempSync, symlinkSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isMain } from "../../src/lib/isMain.js";

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

  it("returns true when argv[1] is a symlink to the currently running script", () => {
    const dir = mkdtempSync(join(tmpdir(), "isMain-"));
    const realScript = join(dir, "real-script.js");
    const linkScript = join(dir, "link-script.js");
    writeFileSync(realScript, "");
    symlinkSync(realScript, linkScript);

    const originalArgv1 = process.argv[1];
    process.argv[1] = linkScript;
    try {
      assert.equal(isMain(pathToFileURL(realScript).href), true);
    } finally {
      process.argv[1] = originalArgv1;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
