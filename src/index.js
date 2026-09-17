#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { basename, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { PACKAGE, config } from "./lib/config.js";
import { findLocalInstall } from "./lib/delegate.js";

let cmd = process.argv[2];
if (!cmd) {
  console.warn(`${basename(process.argv[1])} {command} ...`);
  process.exit(-1);
}

const localRoot = findLocalInstall(process.cwd(), config.root, PACKAGE.name);
if (localRoot) {
  const localEntry = resolve(localRoot, "src/index.js");
  const result = spawnSync(process.execPath, [localEntry, ...process.argv.slice(2)], { stdio: "inherit" });
  process.exit(result.status ?? 1);
}

const script = fileURLToPath(new URL(`./service/${cmd}.js`, import.meta.url));
process.argv.splice(1, 2, script);
await import(script);
