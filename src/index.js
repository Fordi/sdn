#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { basename, resolve } from "node:path";
import { spawnSync as defaultSpawnSync } from "node:child_process";
import { PACKAGE as defaultPackage, config as defaultConfig } from "./lib/config.js";
import { findLocalInstall as defaultFindLocalInstall } from "./lib/delegate.js";
import { isMain } from "./lib/isMain.js";

export async function runCli({
  argv,
  execPath,
  cwd,
  warn = console.warn,
  exit = (code) => process.exit(code),
  spawnSync = defaultSpawnSync,
  findLocalInstall = defaultFindLocalInstall,
  config = defaultConfig,
  PACKAGE = defaultPackage,
  serviceScriptUrl = (cmd) => new URL(`./service/${cmd}.js`, import.meta.url),
  runScript = async (script) => {
    argv.splice(1, 2, script);
    await import(script);
  },
} = {}) {
  const cmd = argv[2];
  if (!cmd) {
    warn(`${basename(argv[1])} {command} ...`);
    exit(-1);
    return;
  }

  const localRoot = findLocalInstall(cwd, config.root, PACKAGE.name);
  if (localRoot) {
    const localEntry = resolve(localRoot, "src/index.js");
    const result = spawnSync(execPath, [localEntry, ...argv.slice(2)], { stdio: "inherit" });
    exit(result.status ?? 1);
    return;
  }

  const script = fileURLToPath(serviceScriptUrl(cmd));
  await runScript(script);
}

if (isMain(import.meta.url)) {
  await runCli({ argv: process.argv, execPath: process.execPath, cwd: process.cwd() });
}
