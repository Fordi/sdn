#!/usr/bin/env node
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { getConfig } from "./config.js";
import { installCrashHandler } from "./crashCapture.js";

const where = process.argv[2] ?? process.cwd();
const { config: project } = getConfig(where);

installCrashHandler(where);
const main = resolve(project.root, project.main);
process.argv = [process.argv[0], main, ...process.argv.slice(3)];

await import(pathToFileURL(main));
