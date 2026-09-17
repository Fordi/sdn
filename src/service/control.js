#!/usr/bin/env node
import { getConfig } from "../lib/config.js";
import { systemctl } from "../lib/systemctl.js";
import { isMain } from "../lib/isMain.js";

const { config: project } = getConfig(process.cwd());

export const control = (args) => systemctl(project, args);

if (isMain(import.meta.url)) {
  control(process.argv.slice(2));
}
