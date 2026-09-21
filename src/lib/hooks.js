import { statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { getConfig as defaultGetConfig } from "./config.js";

export function createHook(where, getConfig = defaultGetConfig) {
  let version = 0;

  const hook = async (event, info) => {
    if (statSync(where).isFile()) {
      where = dirname(where);
    }
    const { config: project } = getConfig(where);
    if (project.hooks) {
      const hooksFile = new URL(project.hooks, pathToFileURL(resolve(project.root, 'package.json')));
      hooksFile.searchParams.set('version', version);
      const hooksModule = await import(hooksFile);
      if (event in hooksModule) {
        return await hooksModule[event](info);
      }
    }
  };

  hook.bump = (event, info) => {
    version++;
    return hook(event, info);
  };

  return hook;
}
