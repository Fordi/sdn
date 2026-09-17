import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function getConfig(root) {
  while (!existsSync(resolve(root, 'package.json')) && root !== '/') {
    root = dirname(root);
  }
  if (root === '/') {
    throw new Error("Not in an npm project");
  }
  
  const readJson = (rootRelPath) => JSON.parse(readFileSync(resolve(root, rootRelPath)), 'utf8')
  const { config = {}, ...PACKAGE } = readJson("package.json");

  if (config.from) {
    try {
      Object.assign(config, readJson(config.from));
    } catch (e) {
      console.info(`No ${config.from}, though one is configured from package.json`);
      config.from = 'package.json';
    }
  } else {
    config.from = "package.json";
  }

  [config.name, config.org = undefined] = PACKAGE.name.replace(/^@/, '').split('/').reverse();
  config.description = PACKAGE.description;
  config.root = root;
  config.main = PACKAGE.main;
  config.package = Object.freeze(PACKAGE);

  
  class ConfigError extends Error {
    constructor(message, needed) {
      super(needed ? `${message}; Please add the following to ${config.from}:\n  ${
        Object.entries(needed).map(([name, desc]) => `${JSON.stringify(name)}: ${desc}`).join('\n  ')
      }\n` : `${message}; please check ${config.from}`);
    }
  }
  
  config.Error = ConfigError;
  
  Object.freeze(config);
  Object.freeze(PACKAGE);
  
  return { config, PACKAGE, ConfigError };
}

const { config, PACKAGE, ConfigError } = getConfig(fileURLToPath(new URL("./..", import.meta.url)).replace(/\/$/, ''));

export { config, PACKAGE, ConfigError, getConfig };