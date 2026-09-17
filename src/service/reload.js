#!/usr/bin/env node
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { systemctl } from "./control.js";

if (fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  systemctl(['', 'daemon-reload']);
}
