#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";

import { config, getConfig } from "../lib/config.js";
import { shellQuote } from "../lib/shellQuote.js";

const { config: project } = getConfig(process.cwd());
const ownName = basename(import.meta.url, '.js');
const systemd = {
  ...project.systemd,
  Unit: {
    Description: project.description,
    After: ["network.target"],
    ...project.systemd?.Unit
  },
  Service: {
    Type: "simple",
    ...project.systemd?.Service,
    WorkingDirectory: project.root,
    ExecStart: shellQuote(
      resolve(config.root, "service/node"),
      resolve(config.root, "service/index.js"),
      resolve(project.root)
    ),
  },
  Install: {
    WantedBy: ["multi-user.target"],
    ...project.systemd?.Install,
  },
};

const serviceContent = Object.entries(systemd).map(
  ([heading, values]) => [
    `[${heading}]`,
    ...Object.entries(values).map(([name, value]) =>
      Array.isArray(value)
        ? value.map((v) => `${name}=${v}`).join('\n')
        : `${name}=${value}`
    )
  ].join('\n')
).join('\n\n');

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
