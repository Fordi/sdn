import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { realpathSync } from "node:fs";

export function findLocalInstall(cwd, ownRoot, packageName, { require = createRequire(resolve(cwd, 'x')) } = {}) {
  let resolved;
  try {
    resolved = require.resolve(`${packageName}/package.json`);
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      return null;
    }
    throw e;
  }
  const localRoot = dirname(resolved);
  let realOwnRoot;
  try {
    realOwnRoot = realpathSync(ownRoot);
  } catch (e) {
    realOwnRoot = ownRoot;
  }
  if (realpathSync(localRoot) === realOwnRoot) {
    return null;
  }
  return localRoot;
}
