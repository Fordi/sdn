#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";

import { config, getConfig } from "../lib/config.js";
import { buildSystemdUnit, renderSystemdUnit } from "../lib/systemdUnit.js";

const { config: project } = getConfig(process.cwd());
const ownName = basename(import.meta.url, '.js');
const systemd = buildSystemdUnit(project, config);
const serviceContent = renderSystemdUnit(systemd);

const serviceFile = resolve(project.root, `${project.name}.service`);
const systemdFile = resolve(process.env.HOME, '.config', 'systemd', 'user', `${project.name}.service`);

writeFileSync(serviceFile, serviceContent, "utf8");

if (existsSync(systemdFile)) {
  if (!process.argv.includes('--force')) {
    console.warn(`${systemdFile} already exists; use "npx ${config.name} ${ownName} --force" to overwrite`);
    process.exit();
  } else {
    rmSync(systemdFile);
    spawnSync('systemctl', ['--user', 'daemon-reload'], { stdio: "inherit" });
  }
}
spawnSync('systemctl', ['--user', 'link', serviceFile], { stdio: "inherit" });
