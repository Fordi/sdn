#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

import { getConfig } from "../lib/config.js";

const { config: project } = getConfig(process.cwd());

const systemdFile = resolve(process.env.HOME, '.config', 'systemd', 'user', `${project.name}.service`);

if (existsSync(systemdFile)) {
    rmSync(systemdFile);
    spawnSync('systemctl', ['--user', 'daemon-reload'], { stdio: "inherit" });
    console.log(`Removed ${systemdFile}`);
} else {
  console.warn(`No service file at ${systemdFile}`);
}
