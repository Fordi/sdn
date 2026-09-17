#!/usr/bin/env node
import { resolve } from "node:path";
import nodemon from "nodemon";
import { getConfig } from "../lib/config.js";
import { createHook } from "../lib/hooks.js";

const { config: project } = getConfig(process.argv[2] ?? process.cwd());
const hook = createHook(process.argv[2] ?? process.cwd());

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
  console.log(`Service ${project.name} will restart.`);
  hook.bump("restart", null);
}).on("exit", () => {
  console.log(`Service ${project.name} exited cleanly.`);
  hook("exit", null);
}).on("crash", () => {
  console.log(`Service ${project.name} crashed.`);
  hook("crash", null);
}).on("config:update", () => {
  console.log(`Service ${project.name} nodemon config has changed.`);
  hook.bump("config:update", null);
});
