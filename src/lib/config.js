import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge(base, overrides) {
  const result = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    result[key] = isPlainObject(value) && isPlainObject(result[key])
      ? deepMerge(result[key], value)
      : value;
  }
  return result;
}

const relativePaths = new Set();
let defaultRoot;

function relativize(obj, sourceFile, resolvedPaths) {
  for (const dottedPath of relativePaths) {
    const keys = dottedPath.split('.');
    const lastKey = keys.pop();
    let target = obj;
    for (const key of keys) {
      if (!isPlainObject(target[key])) {
        target = undefined;
        break;
      }
      target = target[key];
    }
    if (target && typeof target[lastKey] === 'string') {
      target[lastKey] = resolve(dirname(sourceFile), target[lastKey]);
      resolvedPaths.push(target[lastKey]);
    }
  }
  return obj;
}

function getConfig(root = defaultRoot, preprocess = (obj) => obj) {
  while (!existsSync(resolve(root, 'package.json')) && root !== '/') {
    root = dirname(root);
  }
  if (root === '/') {
    throw new Error("Not in an npm project");
  }

  const readJson = (rootRelPath) => JSON.parse(readFileSync(resolve(root, rootRelPath)), 'utf8')
  const packageJsonFile = resolve(root, 'package.json');
  const { config: rawConfig = {}, ...PACKAGE } = readJson("package.json");
  const watchPaths = [];
  const config = preprocess(relativize(rawConfig, packageJsonFile, watchPaths), packageJsonFile);

  if (config.from) {
    try {
      const configFromFile = resolve(root, config.from);
      Object.assign(config, preprocess(relativize(readJson(config.from), configFromFile, watchPaths), configFromFile));
      watchPaths.push(configFromFile);
    } catch (e) {
      console.info(`No ${config.from}, though one is configured from package.json`);
      config.from = 'package.json';
    }
  } else {
    config.from = "package.json";
  }

  [config.name, config.org = undefined] = PACKAGE.name.replace(/^@/, '').split('/').reverse();

  if (!config.appData) {
    config.appData = resolve(homedir(), ".local", "state", config.name);
  }

  const appDataConfigFile = resolve(config.appData, "config.json");
  if (existsSync(appDataConfigFile)) {
    const appDataConfig = preprocess(relativize(JSON.parse(readFileSync(appDataConfigFile, 'utf8')), appDataConfigFile, watchPaths), appDataConfigFile);
    Object.assign(config, deepMerge(config, appDataConfig));
  }

  config.description = PACKAGE.description;
  config.root = root;
  config.main = PACKAGE.main;
  config.package = Object.freeze(PACKAGE);
  config.watchPaths = Object.freeze(watchPaths);

  
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

getConfig.relative = (...dottedPaths) => {
  for (const dottedPath of dottedPaths) {
    relativePaths.add(dottedPath);
  }
  return getConfig;
};

getConfig.setRoot = (root) => {
  defaultRoot = root;
  return getConfig;
};

const { config, PACKAGE, ConfigError } = getConfig(fileURLToPath(new URL("./..", import.meta.url)).replace(/\/$/, ''));

export { config, PACKAGE, ConfigError, getConfig };