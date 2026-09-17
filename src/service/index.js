#!/usr/bin/env node
import { dirname, resolve } from "node:path";
import nodemon from "nodemon";
import { getConfig } from "../lib/config.js";
import { statSync } from "node:fs";
import { pathToFileURL } from "node:url";

const { config: project } = getConfig(process.argv[2] ?? process.cwd());
let version = 0;

const hook = async (event, info) => {
  let where = process.argv[2] ?? process.cwd();
  if (statSync(where).isFile()) {
    where = dirname(where);
  }
  const { config: project } = getConfig(where);
  if (project.hooks) {
    const hooksFile = new URL(project.hooks, pathToFileURL(resolve(where, 'package.json')));
    hooksFile.searchParams.set('version', version);
    const hooksModule = await import(hooksFile);
    if (event in hooksModule) {
      hooksModule[event](info);
    }
  }
}

await hook("init", project);

nodemon({
  script: resolve(project.root, project.main),
  args: process.argv.slice(3),
});

nodemon.on("start", () => {
  console.log(`Service ${project.name} is running.`);
  hook("running", null);
}).on("quit", async () => {
  console.log(`Service ${project.name} has quit.`);
  await hook("quit", null);
  process.exit();
}).on("restart", () => {
  version++;
  console.log(`Service ${project.name} will restart.`);
  hook("restart", null);
}).on("exit", () => {
  console.log(`Service ${project.name} exited cleanly.`);
  hook("exit", null);
}).on("crash", () => {
  console.log(`Service ${project.name} crashed.`);
  hook("crash", null);
}).on("config:update", () => {
  version++;
  console.log(`Service ${project.name} nodemon config has changed.`);
  hook("config:update", null);
});
