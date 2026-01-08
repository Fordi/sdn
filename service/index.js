#!/usr/bin/env node
import { resolve } from "node:path";
import nodemon from "nodemon";
import { getConfig } from "../lib/config.js";

const { config: project } = getConfig(process.argv[2] ?? process.cwd());

process.title = project.name;

nodemon({
  script: resolve(project.root, project.main),
  args: process.argv.slice(3),
});

nodemon.on("start", () => {
  console.log(`Service ${project.name} is running.`);
}).on("quit", () => {
  console.log(`Service ${project.name} has quit.`);
  process.exit();
}).on("restart", () => {
  console.log(`Service ${project.name} will restart.`);
}).on("exit", () => {
  console.log(`Service ${project.name} exited cleanly.`);
}).on("crash", () => {
  console.log(`Service ${project.name} crashed.`);
}).on("config:update", () => {
  console.log(`Service ${project.name} nodemon config has changed.`);
});
