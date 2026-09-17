#!/usr/bin/env node
import { resolve } from "node:path";
import nodemon from "nodemon";
import { getConfig } from "../lib/config.js";
import { createHook } from "../lib/hooks.js";

const { config: project } = getConfig(process.argv[2] ?? process.cwd());
const hook = createHook(process.argv[2] ?? process.cwd());

// init/quit are awaited by their callers below, so a rejection there
// correctly stops startup/shutdown. The rest fire-and-forget, so their
// hook calls are wrapped here instead of crashing the service via an
// unhandled rejection if a hook throws or rejects.
const fire = (promise) => {
  Promise.resolve(promise).catch((err) => {
    console.error(`Service ${project.name} hook failed:`, err);
  });
};

await hook("init", project);

nodemon({
  script: resolve(project.root, project.main),
  args: process.argv.slice(3),
});

nodemon.on("start", () => {
  console.log(`Service ${project.name} is running.`);
  fire(hook("running", null));
}).on("quit", async () => {
  console.log(`Service ${project.name} has quit.`);
  await hook("quit", null);
  process.exit();
}).on("restart", () => {
  console.log(`Service ${project.name} will restart.`);
  fire(hook.bump("restart", null));
}).on("exit", () => {
  console.log(`Service ${project.name} exited cleanly.`);
  fire(hook("exit", null));
}).on("crash", () => {
  console.log(`Service ${project.name} crashed.`);
  fire(hook("crash", null));
}).on("config:update", () => {
  console.log(`Service ${project.name} nodemon config has changed.`);
  fire(hook.bump("configUpdate", null));
});
