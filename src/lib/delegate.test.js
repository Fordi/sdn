import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findLocalInstall } from "./delegate.js";

const makeProjectWithLocalInstall = (packageName = "@fordi-org/sdn") => {
  const root = mkdtempSync(join(tmpdir(), "sdn-delegate-test-"));
  const scope = packageName.includes("/") ? packageName.split("/")[0] : null;
  const pkgDir = scope
    ? join(root, "node_modules", scope, packageName.split("/")[1])
    : join(root, "node_modules", packageName);
  mkdirSync(pkgDir, { recursive: true });
  writeFileSync(join(pkgDir, "package.json"), JSON.stringify({ name: packageName, version: "0.0.1" }), "utf8");
  return { root, pkgDir };
};

describe("findLocalInstall", () => {
  it("returns null when the package is not installed anywhere reachable from cwd", () => {
    const isolated = mkdtempSync(join(tmpdir(), "sdn-delegate-test-none-"));
    try {
      assert.equal(findLocalInstall(isolated, "/some/own/root", "@fordi-org/sdn"), null);
    } finally {
      rmSync(isolated, { recursive: true, force: true });
    }
  });

  it("returns the local install's root when one is found and it differs from ownRoot", () => {
    const { root, pkgDir } = makeProjectWithLocalInstall();
    try {
      const found = findLocalInstall(root, "/some/other/root", "@fordi-org/sdn");
      assert.equal(found, pkgDir);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("returns null when the resolved local install is the same as ownRoot", () => {
    const { root, pkgDir } = makeProjectWithLocalInstall();
    try {
      assert.equal(findLocalInstall(root, pkgDir, "@fordi-org/sdn"), null);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("walks up from a nested working directory to find node_modules", () => {
    const { root, pkgDir } = makeProjectWithLocalInstall();
    const nested = join(root, "src", "deep", "nested");
    mkdirSync(nested, { recursive: true });
    try {
      assert.equal(findLocalInstall(nested, "/some/other/root", "@fordi-org/sdn"), pkgDir);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("propagates a resolution error that isn't MODULE_NOT_FOUND", () => {
    const brokenRequire = {
      resolve: () => {
        const err = new Error("permission denied");
        err.code = "EACCES";
        throw err;
      },
    };
    assert.throws(
      () => findLocalInstall("/tmp", "/some/other/root", "@fordi-org/sdn", { require: brokenRequire }),
      /permission denied/
    );
  });
});
