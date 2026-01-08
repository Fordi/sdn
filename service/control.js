#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { getConfig } from "../lib/config.js";
import { shellQuote } from "../lib/shellQuote.js";

const { config: project } = getConfig(process.cwd());

export function systemctl([cmd, ...args]) {
  const argv = ['systemctl', '--user', ...(cmd ? [cmd, project.name] : []), ...args];
  console.info(`> ${shellQuote(argv)}`);
  return spawnSync(argv[0], argv.slice(1), { stdio: "inherit" });
}

if (fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  systemctl(process.argv.slice(2));
}