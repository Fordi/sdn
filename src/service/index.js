#!/usr/bin/env node
import { mkdirSync, watch } from "node:fs";
import { basename, dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import nodemon from "nodemon";
import { getConfig } from "../lib/config.js";
import { createHook } from "../lib/hooks.js";
import { readLastCrash } from "../lib/crashCapture.js";

const where = process.argv[2] ?? process.cwd();
const { config: project } = getConfig(where);
const hook = createHook(where);

await hook("init", project);

const runMain = resolve(dirname(fileURLToPath(import.meta.url)), "../lib/runMain.js");

nodemon({
  script: runMain,
  args: [where, ...process.argv.slice(3)],
});

// Config can live outside the project's own code (appData, an external
// config.from file, or a getConfig.relative()-resolved path), so those
// sources are watched separately from nodemon's own watch list (which only
// covers project.root). A change to any of them restarts the watched
// process so it picks up the new config on its next boot.
const restartOnChange = (label) => (eventType, filename) => {
  if (filename && basename(filename) === "lastCrash.json") {
    return;
  }
  console.log(`Service ${project.name} ${label} changed; restarting.`);
  nodemon.restart();
};

// appData holds config the app can be reconfigured with at runtime (e.g.
// appData/config.json). lastCrash.json is excluded since it's written by the
// crashed child itself -- watching it would restart the service every time
// it crashes, on top of nodemon's own crash handling below.
mkdirSync(project.appData, { recursive: true });
watch(project.appData, { recursive: true }, restartOnChange("appData"));

for (const watchPath of project.watchPaths) {
  if (watchPath === project.appData || watchPath.startsWith(project.appData + sep)) {
    continue;
  }
  if (watchPath === project.root || watchPath.startsWith(project.root + sep)) {
    continue;
  }
  watch(watchPath, restartOnChange(watchPath));
}

nodemon.on("start", async () => {
  console.log(`Service ${project.name} is running.`);
  await hook("running", null);
}).on("quit", async () => {
  console.log(`Service ${project.name} has quit.`);
  await hook("quit", null);
  process.exit();
}).on("restart", async () => {
  console.log(`Service ${project.name} will restart.`);
  await hook.bump("restart", null);
}).on("exit", async () => {
  console.log(`Service ${project.name} exited cleanly.`);
  await hook("exit", null);
}).on("crash", async () => {
  console.log(`Service ${project.name} crashed.`);
  const lastCrash = readLastCrash(where);
  const restart = await hook("crash", lastCrash);
  if (restart === true) {
    console.log("App requested restart");
    nodemon.restart();
  } else if (restart === false || (typeof restart === "number" && Number.isInteger(restart) && restart !== 0)) {
    console.log("App requested shutdown");
    process.exit(restart === false ? 1 : restart);
  } else {
    console.log("Awaiting file changes before restarting");
  }
}).on("config:update", async () => {
  console.log(`Service ${project.name} nodemon config has changed.`);
  await hook.bump("configUpdate", null);
});
